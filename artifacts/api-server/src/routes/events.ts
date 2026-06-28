import { Router, type IRouter } from "express";
import { and, gte, lte, ilike, sql } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  ListEventsResponse,
  GetEventParams,
  GetEventResponse,
  GetEventStatsResponse,
  RefreshEventsResponse,
} from "@workspace/api-zod";
import { execFile } from "child_process";
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

  const { date_from, date_to, luogo } = parsed.data;

  const conditions = [];
  if (date_from) conditions.push(gte(eventsTable.dataInizio, date_from));
  if (date_to) conditions.push(lte(eventsTable.dataInizio, date_to));
  if (luogo) conditions.push(ilike(eventsTable.luogo, `%${luogo}%`));

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
    fonte: r.fonte,
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
    .limit(10);

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

router.post("/events/refresh", async (req, res): Promise<void> => {
  req.log.info("Starting events refresh via Python scraper");

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");

  try {
    const { stdout, stderr } = await execFileAsync("python3", [scraperScript], {
      timeout: 120000,
      env: { ...process.env },
      cwd: workspaceRoot,
    });

    req.log.info({ stdout: stdout.slice(0, 500) }, "Scraper output");
    if (stderr) req.log.warn({ stderr: stderr.slice(0, 200) }, "Scraper stderr");

    // Parse result from stdout JSON line
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
      fonte: row.fonte,
      aggiornato_il: row.aggiornatoIl.toISOString(),
    })
  );
});

export default router;
