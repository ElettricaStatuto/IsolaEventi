import { Router, type IRouter } from "express";
import { and, gte, lte, ilike, sql, eq } from "drizzle-orm";
import { db, eventsTable, rejectedEventsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  ListEventsResponse,
  GetEventParams,
  GetEventResponse,
  GetEventStatsResponse,
  RefreshEventsResponse,
  PreviewEventsResponse,
  ApproveEventsBody,
  ApproveEventsResponse,
  ListRejectedEventsResponse,
  RestoreRejectedEventParams,
} from "@workspace/api-zod";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import { logger } from "../lib/logger";
import { requireAdminKey } from "../middlewares/auth";

const execFileAsync = promisify(execFile);

const router: IRouter = Router();

router.get("/events", async (req, res): Promise<void> => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date_from, date_to, luogo, titolo, fonte } = parsed.data;

  // Filtro eventi più vecchi di 3 mesi
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 3);
  const cutoffString = cutoffDate.toISOString().split("T")[0];

  const conditions = [];
  conditions.push(gte(eventsTable.dataInizio, cutoffString));

  if (date_from && date_from > cutoffString) {
    conditions.push(gte(eventsTable.dataInizio, date_from));
  } else if (date_from) {
    // If date_from is provided but older than cutoff, we still rely on cutoff
  }
  
  if (date_to) conditions.push(lte(eventsTable.dataInizio, date_to));
  if (luogo) conditions.push(ilike(eventsTable.luogo, `%${luogo}%`));
  if (titolo) conditions.push(ilike(eventsTable.titolo, `%${titolo}%`));
  if (fonte) conditions.push(ilike(eventsTable.fonte, `%${fonte}%`));

  const rows = await db
    .select()
    .from(eventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(eventsTable.dataInizio);

  const mapped = rows.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    data_inizio: r.dataInizio,
    data_fine: r.dataFine,
    luogo: r.luogo,
    latitudine: r.latitudine,
    longitudine: r.longitudine,
    link: r.link,
    descrizione: r.descrizione,
    immagine: r.immagine,
    fonte: r.fonte,
    testo_estratto: r.testoEstratto,
    parent_id: r.parentId,
    aggiornato_il: r.aggiornatoIl.toISOString(),
  }));

  res.json(ListEventsResponse.parse(mapped));
});

router.get("/events/stats", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const [totaleRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable);

  const [coordRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(
      and(
        sql`${eventsTable.latitudine} is not null`,
        sql`${eventsTable.longitudine} is not null`
      )
    );

  const [prossRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.dataInizio, today),
        lte(eventsTable.dataInizio, in7)
      )
    );

  const luoghiRows = await db
    .select({
      luogo: eventsTable.luogo,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(sql`${eventsTable.luogo} is not null`)
    .groupBy(eventsTable.luogo)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const stats = {
    totale: totaleRow?.count ?? 0,
    con_coordinate: coordRow?.count ?? 0,
    prossimi_7_giorni: prossRow?.count ?? 0,
    luoghi: luoghiRows
      .filter((r) => r.luogo != null)
      .map((r) => ({ luogo: r.luogo as string, count: r.count })),
  };

  res.json(GetEventStatsResponse.parse(stats));
});

router.post("/events/refresh", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting events refresh via Python scraper");

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");

  try {
    const { stdout, stderr } = await execFileAsync("python", [scraperScript], {
      timeout: 300000,
      env: { ...process.env },
      cwd: workspaceRoot,
    });

    req.log.info({ stdout: stdout.slice(0, 500) }, "Scraper output");
    if (stderr) req.log.warn({ stderr: stderr.slice(0, 200) }, "Scraper stderr");

    let nuovi = 0, aggiornati = 0, errori = 0;
    const jsonMatch = stdout.match(/\{.*"nuovi".*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      nuovi = parsed.nuovi ?? 0;
      aggiornati = parsed.aggiornati ?? 0;
      errori = parsed.errori ?? 0;
    }

    res.json(
      RefreshEventsResponse.parse({
        success: true,
        nuovi,
        aggiornati,
        errori,
        messaggio: `Scraping completato: ${nuovi} nuovi, ${aggiornati} aggiornati`,
      })
    );
  } catch (err) {
    req.log.error({ err }, "Scraper failed");
    res.json(
      RefreshEventsResponse.parse({
        success: false,
        nuovi: 0,
        aggiornati: 0,
        errori: 1,
        messaggio: String(err),
      })
    );
  }
});

import fs from "fs";

// Human-in-the-loop: preview events without writing to DB
router.post("/events/refresh/preview", requireAdminKey, (req, res): void => {
  req.log.info("Starting scraper preview (dry-run) with streaming");

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");
  const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");

  res.setHeader("Content-Type", "application/json-lines");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const child = spawn("python", [scraperScript, "--preview"], {
    cwd: workspaceRoot,
    env: { ...process.env },
  });

  let outputBuffer = "";

  child.stdout.on("data", (data) => {
    outputBuffer += data.toString();
    res.write(data);
  });

  child.stderr.on("data", (data) => {
    req.log.warn({ stderr: data.toString() }, "Preview stderr");
  });

  child.on("close", (code) => {
    if (code !== 0) {
      req.log.error({ code }, "Preview failed");
      res.write(JSON.stringify({ success: false, nuovi: 0, aggiornati: 0, errori: 1, messaggio: `Process exited with code ${code}`, events: [] }) + "\n");
    } else {
      // Parse output buffer to find the final events payload and cache it
      try {
        const lines = outputBuffer.split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith("{") && line.includes('"events"')) {
            const parsed = JSON.parse(line);
            if (parsed.events) {
              fs.writeFileSync(cacheFile, JSON.stringify(parsed.events, null, 2), "utf8");
              break;
            }
          }
        }
      } catch (e) {
        req.log.error({ err: e }, "Failed to parse/save preview cache");
      }
    }
    res.end();
  });

  child.on("error", (err) => {
    req.log.error({ err }, "Preview process error");
    res.write(JSON.stringify({ success: false, nuovi: 0, aggiornati: 0, errori: 1, messaggio: String(err), events: [] }) + "\n");
    res.end();
  });
});

router.get("/events/refresh/preview/cache", requireAdminKey, (req, res): void => {
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");
  
  try {
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, "utf8");
      const events = JSON.parse(data);
      res.json({ success: true, events });
    } else {
      res.json({ success: true, events: [] });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to read preview cache");
    res.json({ success: false, events: [], messaggio: String(err) });
  }
});

router.put("/events/refresh/preview/cache", requireAdminKey, (req, res): void => {
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");
  
  try {
    const { events } = req.body;
    if (Array.isArray(events)) {
      fs.writeFileSync(cacheFile, JSON.stringify(events, null, 2), "utf8");
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid events array" });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to write preview cache");
    res.status(500).json({ error: String(err) });
  }
});

// Human-in-the-loop: approve selected events into the database
router.post("/events/approve", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting manual approval of selected events");

  const parsed = ApproveEventsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { events } = parsed.data;
  let nuovi = 0;
  let aggiornati = 0;
  let errori = 0;

  for (const ev of events) {
    try {
      const [existing] = await db
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(
          and(
            sql`${eventsTable.titolo} = ${ev.titolo}`,
            sql`${eventsTable.fonte} = ${ev.fonte || ""}`
          )
        )
        .limit(1);

      if (existing) {
        await db.update(eventsTable)
          .set({
            dataInizio: ev.data_inizio,
            dataFine: ev.data_fine,
            luogo: ev.luogo,
            latitudine: ev.latitudine,
            longitudine: ev.longitudine,
            link: ev.link,
            descrizione: ev.descrizione,
            immagine: ev.immagine,
            aggiornatoIl: new Date(),
          })
          .where(eq(eventsTable.id, existing.id));
        aggiornati++;
      } else {
        await db.insert(eventsTable).values({
          titolo: ev.titolo,
          dataInizio: ev.data_inizio,
          dataFine: ev.data_fine,
          luogo: ev.luogo,
          latitudine: ev.latitudine,
          longitudine: ev.longitudine,
          link: ev.link,
          descrizione: ev.descrizione,
          immagine: ev.immagine,
          fonte: ev.fonte || "",
        });
        nuovi++;
      }
    } catch (e) {
      req.log.error({ err: e, event: ev.titolo }, "Approval insert/update failed");
      errori++;
    }
  }

  res.json(ApproveEventsResponse.parse({
    success: true,
    nuovi,
    aggiornati,
    errori,
    messaggio: `Pubblicati: ${nuovi} nuovi, ${aggiornati} aggiornati`,
  }));
});

router.post("/events/analyze", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting on-demand AI analysis for events");

  const { events } = req.body;
  if (!events || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "No events provided" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const aiScript = path.resolve(workspaceRoot, "scraper/run_ai.py");

  try {
    const child = spawn("python", [aiScript], {
      cwd: workspaceRoot,
      env: { ...process.env },
    });

    child.stdin.write(JSON.stringify(events));
    child.stdin.end();

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderrData += chunk;
    });

    await new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python script exited with code ${code}. Stderr: ${stderrData}`));
      });
      child.on("error", reject);
    });

    let results = [];
    try {
      results = JSON.parse(stdoutData);
    } catch (e) {
      throw new Error(`Failed to parse Python output: ${stdoutData}`);
    }

    let errori = 0;
    for (const r of results) {
      if (r.error) {
        errori++;
        req.log.error({ err: r.error, event_id: r.id, tmp_id: r.tmp_id }, "AI analysis failed for event");
      } else if (r.id) {
        // If it has a real DB ID, update the DB directly
        try {
          await db.update(eventsTable)
            .set({
              testoEstratto: r.testo_estratto,
              aggiornatoIl: new Date(),
            })
            .where(eq(eventsTable.id, r.id));
            
          // We can also insert sotto_eventi if it's a festival, but since this
          // event is already published, we should create the sub-events in the DB
          if (r.is_festival && r.sotto_eventi && r.sotto_eventi.length > 0) {
            // First fetch the parent event to copy its location and source
            const [parent] = await db.select().from(eventsTable).where(eq(eventsTable.id, r.id));
            if (parent) {
              for (const se of r.sotto_eventi) {
                await db.insert(eventsTable).values({
                  titolo: `${parent.titolo} - ${se.titolo}`,
                  dataInizio: se.data_inizio,
                  dataFine: se.data_fine || se.data_inizio,
                  luogo: se.luogo || parent.luogo,
                  parentId: parent.id,
                  fonte: parent.fonte,
                });
              }
            }
          }
        } catch (e) {
          req.log.error({ err: e, event_id: r.id }, "Failed to save AI results to DB");
          errori++;
        }
      }
    }

    res.json({
      success: true,
      results,
      errori,
      messaggio: `Analisi completata. ${results.length - errori} successi, ${errori} errori.`,
    });
  } catch (err) {
    req.log.error({ err }, "AI analysis endpoint failed");
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/events/:id", requireAdminKey, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const recordRejected = req.body?.record_rejected === true;

  try {
    const [row] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    if (recordRejected) {
      await db.insert(rejectedEventsTable).values({
        titolo: row.titolo,
        fonte: row.fonte,
        motivo: "Rifiutato dall'admin",
      });
      req.log.info({ eventId: id, titolo: row.titolo }, "Event recorded as rejected");
    }

    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    req.log.info({ eventId: id }, "Event deleted");

    res.json({ success: true, message: "Evento eliminato" });
  } catch (e) {
    req.log.error({ err: e }, "Delete failed");
    res.status(500).json({ error: String(e) });
  }
});

router.get("/events/rejected", requireAdminKey, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(rejectedEventsTable)
    .orderBy(sql`${rejectedEventsTable.rifiutatoIl} desc`);

  const mapped = rows.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    fonte: r.fonte,
    motivo: r.motivo,
    rifiutato_il: r.rifiutatoIl.toISOString(),
  }));

  res.json(ListRejectedEventsResponse.parse(mapped));
});

router.delete("/events/rejected/:id", requireAdminKey, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RestoreRejectedEventParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await db.delete(rejectedEventsTable).where(eq(rejectedEventsTable.id, parsed.data.id));
    res.json({ success: true, message: "Evento rimosso dalla blacklist" });
  } catch (e) {
    req.log.error({ err: e }, "Restore rejected event failed");
    res.status(500).json({ error: String(e) });
  }
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetEventParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(eventsTable)
    .where(sql`${eventsTable.id} = ${parsed.data.id}`);

  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(
    GetEventResponse.parse({
      id: row.id,
      titolo: row.titolo,
      data_inizio: row.dataInizio,
      data_fine: row.dataFine,
      luogo: row.luogo,
      latitudine: row.latitudine,
      longitudine: row.longitudine,
      link: row.link,
      descrizione: row.descrizione,
      immagine: row.immagine,
      fonte: row.fonte,
      testo_estratto: row.testoEstratto,
      parent_id: row.parentId,
      aggiornato_il: row.aggiornatoIl.toISOString(),
    })
  );
});

export default router;
