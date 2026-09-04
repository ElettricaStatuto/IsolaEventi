import { Router, type IRouter } from "express";
import { and, gte, lte, ilike, sql, eq, isNull, inArray } from "drizzle-orm";
import { db, eventsTable, rejectedEventsTable, pendingEventsTable, rawScrapesTable, aiAnalysisTable } from "@workspace/db";
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
import fs from "fs";
import multer from "multer";
import { isCloudinaryConfigured } from "../lib/cloudinary";

const upload = multer({ dest: "data/uploads/" });
const execFileAsync = promisify(execFile);

function getPythonExecutable(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  return process.platform === "win32" ? "python" : "python3";
}

// Registra il documento AI completo e non modificato (schema unificato v2.0)
// cosi' come restituito da Gemini, indipendentemente dalle colonne "operative".
async function recordAiAnalysis(
  documentoAi: any,
  ids: { pendingEventId?: number | null; eventId?: number | null }
): Promise<void> {
  if (!documentoAi || typeof documentoAi !== "object") return;
  try {
    await db.insert(aiAnalysisTable).values({
      pendingEventId: ids.pendingEventId ?? null,
      eventId: ids.eventId ?? null,
      schemaVersion: documentoAi.schema_version ?? null,
      metadatiOperazioni: documentoAi.metadati_operazioni ?? null,
      gestioneGerarchia: documentoAi.gestione_gerarchia ?? null,
      datiCuratiAi: documentoAi.dati_curati_ai ?? null,
      diarioDiBordoAi: documentoAi.diario_di_bordo_ai ?? null,
      listaSottoEventiEstratti: documentoAi.lista_sotto_eventi_estratti ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to record ai_analysis row");
  }
}

// Fonte unica di verita' per la mappatura da un evento "grezzo" (snake_case,
// prodotto da scraper/AI in Python) ai campi condivisi tra pending_events ed
// events. Ogni punto del codice che scrive un evento passa da qui, cosi' un
// campo nuovo o dimenticato si aggiunge in un solo posto invece che in ognuno
// dei blocchi di insert/update sparsi nel file.
function buildCoreEventValues(ev: any) {
  return {
    titolo: ev.titolo || "Evento Senza Titolo",
    titoloOriginale: ev.titolo_originale || ev.titolo || null,
    categoria: ev.categoria || null,
    dataInizio: ev.data_inizio || null,
    dataFine: ev.data_fine || null,
    dateOriginali: ev.date_originali || null,
    oraInizio: ev.ora_inizio || null,
    oraFine: ev.ora_fine || null,
    luogo: ev.luogo || null,
    luogoOriginale: ev.luogo_originale || ev.luogo || null,
    latitudine: ev.latitudine ?? null,
    longitudine: ev.longitudine ?? null,
    link: ev.link || null,
    linkOrganizzatore: ev.link_organizzatore || null,
    linkBiglietti: ev.link_biglietti || null,
    descrizione: ev.descrizione || null,
    immagine: ev.immagine || null,
    fonte: ev.fonte || "",
    testoEstratto: ev.testo_estratto || null,
    isFestival: ev.is_festival ?? false,
    isIngressoGratuito: ev.is_ingresso_gratuito ?? false,
    isEvento: ev.is_evento ?? true,
    tags: ev.tags || null,
    artisti: ev.artisti || null,
    bioArtisti: ev.bio_artisti || null,
    socialContatti: ev.social_contatti || null,
    dettagliDominio: ev.dettagli_dominio || null,
    dettagliExtra: ev.dettagli_extra || null,
  };
}

function calculateTitleSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const str1 = s1.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const str2 = s2.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.85;

  let longer = str1.length > str2.length ? str1 : str2;
  let shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;

  // Simple character overlap ratio
  let matchCount = 0;
  const shorterChars = new Set(shorter.split(""));
  for (const char of longer.split("")) {
    if (shorterChars.has(char)) matchCount++;
  }
  return matchCount / longer.length;
}

const router: IRouter = Router();

function getFestivalDateRange(parentInizio: string | null, parentFine: string | null, sottoEventi: any[]) {
  let minDate = parentInizio;
  let maxDate = parentFine || parentInizio;

  const dates = sottoEventi
    .flatMap((se) => [se.data_inizio, se.data_fine || se.data_inizio])
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));

  if (dates.length > 0) {
    dates.sort();
    const minSotto = dates[0];
    const maxSotto = dates[dates.length - 1];

    if (!minDate || minSotto < minDate) {
      minDate = minSotto;
    }
    if (!maxDate || maxSotto > maxDate) {
      maxDate = maxSotto;
    }
  }

  return { dataInizio: minDate, dataFine: maxDate };
}

router.get("/events", async (req, res): Promise<void> => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date_from, date_to, luogo, titolo, fonte, solo_futuri } = parsed.data;

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

  // Nasconde gli eventi gia' terminati: per un festival (con data_fine) conta
  // l'ultimo giorno, non il primo, cosi' resta visibile fino a che non finisce.
  if (solo_futuri) {
    const todayString = new Date().toISOString().split("T")[0];
    conditions.push(sql`COALESCE(${eventsTable.dataFine}, ${eventsTable.dataInizio}) >= ${todayString}`);
  }
  if (luogo) conditions.push(ilike(eventsTable.luogo, `%${luogo}%`));
  if (titolo) conditions.push(ilike(eventsTable.titolo, `%${titolo}%`));
  if (fonte) conditions.push(ilike(eventsTable.fonte, `%${fonte}%`));

  const rows = await db
    .select({
      id: eventsTable.id,
      titolo: eventsTable.titolo,
      categoria: eventsTable.categoria,
      dataInizio: eventsTable.dataInizio,
      dataFine: eventsTable.dataFine,
      luogo: eventsTable.luogo,
      latitudine: eventsTable.latitudine,
      longitudine: eventsTable.longitudine,
      link: eventsTable.link,
      descrizione: eventsTable.descrizione,
      immagine: eventsTable.immagine,
      fonte: eventsTable.fonte,
      testoEstratto: eventsTable.testoEstratto,
      isEvento: eventsTable.isEvento,
      isIngressoGratuito: eventsTable.isIngressoGratuito,
      parentId: eventsTable.parentId,
      tags: eventsTable.tags,
      artisti: eventsTable.artisti,
      dettagliDominio: eventsTable.dettagliDominio,
      dettagliExtra: eventsTable.dettagliExtra,
      aggiornatoIl: eventsTable.aggiornatoIl,
      childrenCount: sql<number>`(SELECT COUNT(*) FROM events c WHERE c.parent_id = ${eventsTable.id})::int`,
    })
    .from(eventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(eventsTable.dataInizio);

  const mapped = rows.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    categoria: r.categoria,
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
    is_evento: r.isEvento,
    is_ingresso_gratuito: r.isIngressoGratuito,
    parent_id: r.parentId,
    tags: r.tags || [],
    artisti: r.artisti || [],
    dettagli_dominio: r.dettagliDominio || null,
    dettagli_extra: r.dettagliExtra || null,
    children_count: r.childrenCount ?? 0,
    aggiornato_il: r.aggiornatoIl.toISOString(),
  }));

  res.json(ListEventsResponse.parse(mapped));
});

// GET /events/:id/children — restituisce i concerti figli di un festival
router.get("/events/:id/children", async (req, res): Promise<void> => {
  const parentId = parseInt(req.params.id, 10);
  if (isNaN(parentId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  const children = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.parentId, parentId))
    .orderBy(eventsTable.dataInizio);

  const mapped = children.map((r) => ({
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
    parent_id: r.parentId,
    children_count: 0,
    aggiornato_il: r.aggiornatoIl.toISOString(),
  }));

  res.json(mapped);
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

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  res.setHeader("Content-Type", "application/xml");
  try {
    const rows = await db.select({ id: eventsTable.id, titolo: eventsTable.titolo }).from(eventsTable);
    const baseUrl = process.env.FRONTEND_URL || "https://sardegnaeventi.it";
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/stats</loc><priority>0.5</priority></url>\n`;
    
    for (const r of rows) {
      const slug = r.titolo
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      xml += `  <url><loc>${baseUrl}/eventi/${r.id}-${slug}</loc><priority>0.8</priority></url>\n`;
    }
    
    xml += `</urlset>`;
    res.send(xml);
  } catch (e) {
    res.status(500).send("Error generating sitemap");
  }
});

router.get("/robots.txt", (req, res): void => {
  res.setHeader("Content-Type", "text/plain");
  const baseUrl = process.env.FRONTEND_URL || "https://sardegnaeventi.it";
  res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

router.post("/events/refresh", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting events refresh via Python scraper");

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");

  try {
    const { stdout, stderr } = await execFileAsync(getPythonExecutable(), [scraperScript], {
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

// Human-in-the-loop: preview events without writing to DB
router.post("/events/refresh/preview", requireAdminKey, (req, res): void => {
  req.log.info("Starting scraper preview (dry-run) with streaming");

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");

  res.setHeader("Content-Type", "application/json-lines");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sources: string[] = req.body.sources || [];
  const useAiCrawler: boolean = !!req.body.useAiCrawler;
  const args = ["--preview"];
  if (sources.length > 0) {
    args.push("--sources", sources.join(","));
  }
  if (useAiCrawler) {
    args.push("--force-festival");
  }

  const child = spawn(getPythonExecutable(), [scraperScript, ...args], {
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

  child.on("close", async (code) => {
    if (code !== 0) {
      req.log.error({ code }, "Preview failed");
      res.write(JSON.stringify({ success: false, nuovi: 0, aggiornati: 0, errori: 1, messaggio: `Process exited with code ${code}`, events: [] }) + "\n");
    } else {
      // Parse output buffer, cache it, AND persist directly into pending_events table on Neon PostgreSQL
      try {
        const lines = outputBuffer.split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith("{") && line.includes('"events"')) {
            const parsed = JSON.parse(line);
            if (parsed.events && Array.isArray(parsed.events)) {
              // 1. Registra prima il testo grezzo e la scansione completa nella tabella di audit raw_scrapes
              let rawScrapeId: number | null = null;
              try {
                const fullRawText = parsed.raw_text || parsed.events.map((e: any) => `${e.titolo}\n${e.descrizione || ''}`).join('\n\n');
                const [insertedRaw] = await db.insert(rawScrapesTable).values({
                  urlFonte: sources.join(", ") || "Scraper Multi-fonte",
                  testoGrezzo: fullRawText,
                  jsonAiRisposta: parsed,
                }).returning({ id: rawScrapesTable.id });
                if (insertedRaw) rawScrapeId = insertedRaw.id;
              } catch (rawErr) {
                req.log.warn({ rawErr }, "Failed to insert into raw_scrapes");
              }

              // 2. Persistenza diretta ed unificata su Neon PostgreSQL con controllo anti-duplicati
              // (controlla sia gli eventi ancora in attesa sia quelli gia' approvati/pubblicati,
              // altrimenti un evento gia' approvato ricompare come "nuovo" alla scansione successiva)
              const existingPending = await db.select({
                titolo: pendingEventsTable.titolo,
                dataInizio: pendingEventsTable.dataInizio,
                luogo: pendingEventsTable.luogo
              }).from(pendingEventsTable);
              const existingPublished = await db.select({
                titolo: eventsTable.titolo,
                dataInizio: eventsTable.dataInizio,
              }).from(eventsTable);

              for (const ev of parsed.events) {
                try {
                  const evTitle = ev.titolo || "Evento da Scraper";
                  const evDate = ev.data_inizio || null;

                  // Controlla se esiste già un evento simile nello stesso giorno (in attesa o pubblicato)
                  const isDuplicateOf = (ex: { titolo: string; dataInizio: string | null }) => {
                    const sameDate = (ex.dataInizio === evDate) || (!ex.dataInizio && !evDate);
                    const titleSim = calculateTitleSimilarity(ex.titolo, evTitle);
                    return sameDate && titleSim >= 0.80;
                  };
                  const isDuplicate = existingPending.some(isDuplicateOf) || existingPublished.some(isDuplicateOf);

                  if (isDuplicate) {
                    req.log.info({ title: evTitle }, "Skipping duplicate event in pending_events");
                    continue;
                  }

                  const [insertedPending] = await db.insert(pendingEventsTable).values({
                    ...buildCoreEventValues(ev),
                    titolo: evTitle,
                    fonte: ev.fonte || "Scraper Multi-fonte",
                    parentTempId: ev.dettagli_extra?.parent_temp_id || null,
                    rawScrapeId: rawScrapeId,
                    sottoEventi: ev.sotto_eventi || null,
                  }).returning({ id: pendingEventsTable.id });

                  if (insertedPending) {
                    await recordAiAnalysis(ev.documento_ai, { pendingEventId: insertedPending.id });
                  }

                  existingPending.push({ titolo: evTitle, dataInizio: evDate, luogo: ev.luogo || null });
                } catch (dbErr) {
                  req.log.warn({ dbErr, title: ev.titolo }, "Failed to persist preview event into pending_events table");
                }
              }
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

router.get("/events/admin-stats", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const [totaleRow] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable);
    
    const [analizzatiRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventsTable)
      .where(sql`${eventsTable.testoEstratto} is not null`);
      
    const [grezziRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventsTable)
      .where(sql`${eventsTable.testoEstratto} is null`);
      
    const [rifiutatiRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rejectedEventsTable);
      
    const [senzaCoordinateRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventsTable)
      .where(
        sql`${eventsTable.latitudine} is null OR ${eventsTable.longitudine} is null`
      );

    // Dati per fonte
    const fontiRows = await db
      .select({
        fonte: eventsTable.fonte,
        totale: sql<number>`count(*)::int`,
        analizzati: sql<number>`count(*) filter (where ${eventsTable.testoEstratto} is not null)::int`
      })
      .from(eventsTable)
      .groupBy(eventsTable.fonte)
      .orderBy(sql`count(*) desc`);

    // Top tags - eseguiamo in JS per evitare problemi con array unnest in Drizzle base
    const tagRows = await db.select({ tags: eventsTable.tags }).from(eventsTable).where(sql`${eventsTable.tags} is not null`);
    const tagCounts: Record<string, number> = {};
    for (const row of tagRows) {
      if (row.tags && Array.isArray(row.tags)) {
        for (const t of row.tags) {
          if (!t) continue;
          const cleanTag = t.trim().toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      }
    }
    
    // Sort and limit tags to top 15
    const sortedTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.json({
      success: true,
      data: {
        totale_pubblicati: totaleRow?.count ?? 0,
        totale_analizzati: analizzatiRow?.count ?? 0,
        totale_grezzi: grezziRow?.count ?? 0,
        totale_rifiutati: rifiutatiRow?.count ?? 0,
        senza_coordinate: senzaCoordinateRow?.count ?? 0,
        fonti: fontiRows.map(r => ({
          fonte: r.fonte || "Sconosciuta",
          totale: r.totale,
          analizzati: r.analizzati
        })),
        top_tags: sortedTags
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load admin stats");
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get("/events/pending", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(pendingEventsTable).orderBy(sql`${pendingEventsTable.creatoIl} desc`);
    const formattedEvents = rows.map(r => ({
      id: r.id,
      titolo: r.titolo,
      titolo_originale: r.titoloOriginale,
      categoria: r.categoria,
      data_inizio: r.dataInizio,
      data_fine: r.dataFine,
      date_originali: r.dateOriginali,
      ora_inizio: r.oraInizio,
      ora_fine: r.oraFine,
      luogo: r.luogo,
      luogo_originale: r.luogoOriginale,
      latitudine: r.latitudine,
      longitudine: r.longitudine,
      link: r.link,
      link_organizzatore: r.linkOrganizzatore,
      link_biglietti: r.linkBiglietti,
      descrizione: r.descrizione,
      immagine: r.immagine,
      fonte: r.fonte,
      testo_estratto: r.testoEstratto,
      is_festival: r.isFestival,
      is_ingresso_gratuito: r.isIngressoGratuito,
      is_evento: r.isEvento,
      is_new: true,
      parent_id: null,
      parent_temp_id: r.parentTempId,
      tags: r.tags || [],
      artisti: r.artisti || [],
      bio_artisti: r.bioArtisti || [],
      social_contatti: r.socialContatti || [],
      dettagli_dominio: r.dettagliDominio || null,
      dettagli_extra: r.dettagliExtra || {},
      sotto_eventi: r.sottoEventi || []
    }));
    res.json({ success: true, events: formattedEvents });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch pending events from DB");
    res.json({ success: false, events: [], error: String(err) });
  }
});

router.delete("/events/pending/:id", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid ID" });
      return;
    }
    await db.delete(pendingEventsTable).where(eq(pendingEventsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete pending event");
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/scrape-url", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting scraper preview for generic URL");

  const { url, maxLinks, forceFestival } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "No URL provided" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");

  try {
    const pythonArgs = [scraperScript, "--preview", "--url", url];
    if (maxLinks !== undefined) pythonArgs.push("--max-links", String(maxLinks));
    if (forceFestival) pythonArgs.push("--force-festival");

    const { stdout, stderr } = await execFileAsync(getPythonExecutable(), pythonArgs, {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env },
      cwd: workspaceRoot,
    });

    if (stderr) req.log.warn({ stderr }, "Generic Scraper stderr");

    const lines = stdout.split("\n");
    let resultJson: any = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.includes('"events"')) {
        try {
          resultJson = JSON.parse(line);
          break;
        } catch (e) {}
      }
    }

    if (resultJson && resultJson.success && Array.isArray(resultJson.events)) {
      // 1. Registra prima il testo grezzo e la scansione completa nella tabella di audit raw_scrapes
      let rawScrapeId: number | null = null;
      try {
        const fullRawText = resultJson.raw_text || resultJson.events.map((e: any) => `${e.titolo}\n${e.descrizione || ''}`).join('\n\n');
        const [insertedRaw] = await db.insert(rawScrapesTable).values({
          urlFonte: url,
          testoGrezzo: fullRawText,
          jsonAiRisposta: resultJson,
        }).returning({ id: rawScrapesTable.id });
        if (insertedRaw) rawScrapeId = insertedRaw.id;
      } catch (rawErr) {
        req.log.warn({ rawErr }, "Failed to insert into raw_scrapes");
      }

      // 2. Persistenza su Neon PostgreSQL con controllo anti-duplicati
      // (controlla sia gli eventi ancora in attesa sia quelli gia' approvati/pubblicati)
      const existingPending = await db.select({
        titolo: pendingEventsTable.titolo,
        dataInizio: pendingEventsTable.dataInizio,
        luogo: pendingEventsTable.luogo
      }).from(pendingEventsTable);
      const existingPublished = await db.select({
        titolo: eventsTable.titolo,
        dataInizio: eventsTable.dataInizio,
      }).from(eventsTable);

      for (const ev of resultJson.events) {
        try {
          const evTitle = ev.titolo || "Evento Scrapato";
          const evDate = ev.data_inizio || null;

          const isDuplicateOf = (ex: { titolo: string; dataInizio: string | null }) => {
            const sameDate = (ex.dataInizio === evDate) || (!ex.dataInizio && !evDate);
            const titleSim = calculateTitleSimilarity(ex.titolo, evTitle);
            return sameDate && titleSim >= 0.80;
          };
          const isDuplicate = existingPending.some(isDuplicateOf) || existingPublished.some(isDuplicateOf);

          if (isDuplicate) {
            req.log.info({ title: evTitle }, "Skipping duplicate event in pending_events");
            continue;
          }

          const [insertedPending] = await db.insert(pendingEventsTable).values({
            ...buildCoreEventValues(ev),
            titolo: evTitle,
            link: ev.link || url,
            fonte: ev.fonte || "Scraper URL",
            parentTempId: ev.dettagli_extra?.parent_temp_id || null,
            rawScrapeId: rawScrapeId,
            sottoEventi: ev.sotto_eventi || null,
          }).returning({ id: pendingEventsTable.id });

          if (insertedPending) {
            await recordAiAnalysis(ev.documento_ai, { pendingEventId: insertedPending.id });
          }

          existingPending.push({ titolo: evTitle, dataInizio: evDate, luogo: ev.luogo || null });
        } catch (dbErr) {
          req.log.warn({ dbErr, title: ev.titolo }, "Failed to save scraped event into pending_events table");
        }
      }
      res.json({ success: true, events: resultJson.events });
    } else {
      res.json({ success: false, message: "No events found or parsing failed." });
    }
  } catch (err) {
    req.log.error({ err }, "Generic Scraper failed");
    res.json({ success: false, message: String(err) });
  }
});

router.get("/events/crawler-logs", requireAdminKey, (req, res): void => {
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const logsBaseDir = path.resolve(workspaceRoot, "scraper", "crawler_ai");

  try {
    if (!fs.existsSync(logsBaseDir)) {
      res.json({ success: true, folders: [] });
      return;
    }

    const entries = fs.readdirSync(logsBaseDir, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => {
        const folderPath = path.join(logsBaseDir, e.name);
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".txt") || f.endsWith(".json"));
        const stat = fs.statSync(folderPath);
        return {
          name: e.name,
          updatedAt: stat.mtime,
          files
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json({ success: true, folders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get("/events/crawler-logs/content", requireAdminKey, (req, res): void => {
  const { folder, file } = req.query;
  if (!folder || !file || typeof folder !== "string" || typeof file !== "string") {
    res.status(400).json({ error: "Mancano i parametri folder o file" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const safeFolder = path.basename(folder);
  const safeFile = path.basename(file);
  const targetPath = path.resolve(workspaceRoot, "scraper", "crawler_ai", safeFolder, safeFile);

  try {
    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: "File di log non trovato" });
      return;
    }

    const content = fs.readFileSync(targetPath, "utf8");
    res.json({ success: true, folder: safeFolder, file: safeFile, content });
  } catch (err: any) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/upload-image", requireAdminKey, upload.single("file"), async (req, res): Promise<void> => {
  req.log.info("Starting image upload");

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Nessuna immagine caricata" });
    return;
  }

  const absoluteUploadPath = path.resolve(process.cwd(), file.path);

  // Se Cloudinary è configurato, carica lì e restituisci l'URL permanente
  if (isCloudinaryConfigured()) {
    try {
      const { uploadToCloudinary } = await import("../lib/cloudinary");
      const cloudUrl = await uploadToCloudinary(absoluteUploadPath, "isola-eventi");
      req.log.info(`Image uploaded to Cloudinary: ${cloudUrl}`);
      res.json({ success: true, fileName: cloudUrl });
      return;
    } catch (e) {
      req.log.error({ err: e }, "Cloudinary upload failed, falling back to disk");
    }
  }

  // Fallback: salva su disco locale
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const ext = path.extname(file.originalname) || ".jpg";
  const safeName = "manual_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + ext;
  
  const destDir = path.resolve(workspaceRoot, "data", "event-images");
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const destPath = path.join(destDir, safeName);
  
  try {
    fs.renameSync(absoluteUploadPath, destPath);
    res.json({ success: true, fileName: safeName });
  } catch(e) {
    req.log.error({err: e}, "Failed to move uploaded image");
    res.status(500).json({ error: "Impossibile salvare l'immagine" });
  }
});


router.post("/events/upload-pdf", requireAdminKey, upload.single("file"), async (req, res): Promise<void> => {
  req.log.info("Starting scraper preview for uploaded PDF");

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Nessun file PDF caricato" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const scraperScript = path.resolve(workspaceRoot, "scraper_runner.py");
  const absolutePdfPath = path.resolve(process.cwd(), file.path);
  
  // Rinomina il file temporaneo con il nome originale in modo che pypdf veda il vero nome
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const renamedPdfPath = path.resolve(path.dirname(absolutePdfPath), safeName);
  
  try {
    fs.renameSync(absolutePdfPath, renamedPdfPath);
  } catch(e) {
    req.log.warn({err: e}, "Failed to rename uploaded PDF");
  }

  try {
    const { stdout, stderr } = await execFileAsync(getPythonExecutable(), [scraperScript, "--preview", "--pdf", renamedPdfPath], {
      timeout: 120000,
      env: { ...process.env },
      cwd: workspaceRoot,
    });

    if (stderr) req.log.warn({ stderr }, "PDF Scraper stderr");

    const lines = stdout.split("\n");
    let resultJson: any = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.includes('"events"')) {
        try {
          resultJson = JSON.parse(line);
          break;
        } catch (e) {}
      }
    }

    // Pulisci il file caricato dopo l'uso
    try {
      if (fs.existsSync(absolutePdfPath)) fs.unlinkSync(absolutePdfPath);
      if (fs.existsSync(renamedPdfPath)) fs.unlinkSync(renamedPdfPath);
    } catch (e) {
      req.log.warn({ err: e }, "Failed to remove uploaded PDF");
    }

    if (resultJson && resultJson.success && Array.isArray(resultJson.events)) {
      for (const ev of resultJson.events) {
        try {
          const [insertedPending] = await db.insert(pendingEventsTable).values({
            ...buildCoreEventValues(ev),
            titolo: ev.titolo || "Evento da PDF",
            fonte: ev.fonte || "Estrattore PDF",
            parentTempId: ev.dettagli_extra?.parent_temp_id || null,
            sottoEventi: ev.sotto_eventi || null,
          }).returning({ id: pendingEventsTable.id });

          if (insertedPending) {
            await recordAiAnalysis(ev.documento_ai, { pendingEventId: insertedPending.id });
          }
        } catch (dbErr) {
          req.log.warn({ dbErr, title: ev.titolo }, "Failed to save PDF event into pending_events table");
        }
      }
      res.json({ success: true, events: resultJson.events });
    } else {
      res.json({ success: false, message: "Nessun evento trovato o estrazione fallita." });
    }
  } catch (err) {
    req.log.error({ err }, "PDF Scraper failed");
    res.json({ success: false, message: String(err) });
  }
});

// Sincronizza le modifiche fatte in UI sugli eventi "In Attesa" direttamente su Neon
// (pending_events): aggiorna per id se già presente, altrimenti per dettagli_extra.id_key,
// altrimenti inserisce una nuova riga. Nessun file locale coinvolto.
router.put("/events/refresh/preview/cache", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      res.status(400).json({ error: "Invalid events array" });
      return;
    }

    for (const ev of events) {
      const values = {
        ...buildCoreEventValues(ev),
        parentTempId: ev.dettagli_extra?.parent_temp_id || null,
        sottoEventi: ev.sotto_eventi || null,
      };

      try {
        if (typeof ev.id === "number") {
          await db.update(pendingEventsTable).set(values).where(eq(pendingEventsTable.id, ev.id));
          await recordAiAnalysis(ev.documento_ai, { pendingEventId: ev.id });
          continue;
        }

        const idKey = ev.dettagli_extra?.id_key;
        if (idKey) {
          const [existing] = await db
            .select({ id: pendingEventsTable.id })
            .from(pendingEventsTable)
            .where(sql`${pendingEventsTable.dettagliExtra}->>'id_key' = ${idKey}`);
          if (existing) {
            await db.update(pendingEventsTable).set(values).where(eq(pendingEventsTable.id, existing.id));
            await recordAiAnalysis(ev.documento_ai, { pendingEventId: existing.id });
            continue;
          }
        }

        const [insertedPending] = await db.insert(pendingEventsTable).values(values).returning({ id: pendingEventsTable.id });
        if (insertedPending) {
          await recordAiAnalysis(ev.documento_ai, { pendingEventId: insertedPending.id });
        }
      } catch (evErr) {
        req.log.warn({ evErr, title: ev.titolo }, "Failed to sync one pending event");
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to sync pending events to DB");
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Geocoding helper: chiama il geocoder Nominatim via Python se mancano le
// coordinate. Usa la stessa funzione geocode() di scraper_runner.py.
// ---------------------------------------------------------------------------
async function geocodeIfMissing(ev: any, workspaceRoot: string, log: any): Promise<{ latitudine: number | null; longitudine: number | null }> {
  // Se ha già entrambe le coordinate, non fare nulla
  if (ev.latitudine != null && ev.longitudine != null) {
    return { latitudine: ev.latitudine, longitudine: ev.longitudine };
  }

  const luogo = ev.luogo;
  if (!luogo) {
    return { latitudine: null, longitudine: null };
  }

  try {
    // Chiama un piccolo script Python inline che usa la funzione geocode() di scraper_runner
    const geocodeScript = `
import sys, os
sys.path.insert(0, r'${workspaceRoot.replace(/\\/g, '/')}') 
try:
    from scraper_runner import geocode
    result = geocode(sys.argv[1])
    if result:
        print(f"{result[0]},{result[1]}")
    else:
        print("null")
except Exception as e:
    print("null")
`;
    const { stdout } = await execFileAsync(getPythonExecutable(), ["-c", geocodeScript, luogo], {
      timeout: 15000,
      cwd: workspaceRoot,
    });
    const out = stdout.trim();
    if (out && out !== "null" && out.includes(",")) {
      const [lat, lon] = out.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        log.info({ luogo, lat, lon }, "Geocoding automatico riuscito");
        return { latitudine: lat, longitudine: lon };
      }
    }
  } catch (err) {
    log.warn({ err, luogo }, "Geocoding automatico fallito");
  }

  return { latitudine: null, longitudine: null };
}

function normalizeTitle(title: string): string {
  if (!title) return "";
  const stopWords = new Set(["festa", "sagra", "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "dal", "dallo", "dalla", "dai", "dagli", "dalle", "nel", "nello", "nella", "nei", "negli", "nelle", "sul", "sullo", "sulla", "sui", "sugli", "sulle", "col", "coi"]);
  
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ") // remove punctuation
    .split(/\s+/)
    .filter(word => word && !stopWords.has(word))
    .join(" ")
    .trim();
}

function areTitlesSimilar(t1: string, t2: string): boolean {
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  
  const words1 = new Set(n1.split(" "));
  const words2 = new Set(n2.split(" "));
  
  let intersectionCount = 0;
  for (const w of words1) {
    if (words2.has(w)) {
      intersectionCount++;
    }
  }
  
  const unionSize = words1.size + words2.size - intersectionCount;
  if (unionSize === 0) return false;
  
  const jaccard = intersectionCount / unionSize;
  return jaccard >= 0.70;
}

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

  try {
    // Carica tutti gli eventi principali esistenti in memoria per la deduplica sfocata
    const existingEvents = await db
      .select({ id: eventsTable.id, titolo: eventsTable.titolo })
      .from(eventsTable);

    const tempIdMap: Record<string, number> = {};

    const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
      ? path.resolve(process.cwd(), "../..")
      : process.cwd();

    // First pass: Process parents (those without parent_temp_id)
    const parents = (events as any[]).filter(ev => !ev.dettagli_extra?.parent_temp_id);
    const children = (events as any[]).filter(ev => ev.dettagli_extra?.parent_temp_id);

    // Geocoding automatico: riempi lat/lon su tutti gli eventi che ne sono privi
    req.log.info("Avvio geocoding automatico per eventi senza coordinate...");
    for (const ev of [...parents, ...children]) {
      if (ev.latitudine == null || ev.longitudine == null) {
        const coords = await geocodeIfMissing(ev, workspaceRoot, req.log);
        ev.latitudine = coords.latitudine;
        ev.longitudine = coords.longitudine;
      }
    }

    for (const ev of parents) {
      try {
        const match = existingEvents.find(e => areTitlesSimilar(ev.titolo, e.titolo));
        const existingId = match?.id;

        // Since we flattened, sotto_eventi is empty, getFestivalDateRange just returns the event's dates
        let { dataInizio, dataFine } = getFestivalDateRange(ev.data_inizio, ev.data_fine, []);

        if (existingId) {
          if (ev.dettagli_extra?.id_key) tempIdMap[ev.dettagli_extra.id_key] = existingId;
          const { fonte: _fonte, ...coreValues } = buildCoreEventValues(ev);
          await db.update(eventsTable)
            .set({
              ...coreValues,
              dataInizio,
              dataFine,
              parentId: ev.parent_id || null,
              aggiornatoIl: new Date(),
            })
            .where(eq(eventsTable.id, existingId));

          aggiornati++;
        } else {
          const [inserted] = await db.insert(eventsTable).values({
            ...buildCoreEventValues(ev),
            dataInizio,
            dataFine,
            parentId: ev.parent_id || null,
          }).returning({ id: eventsTable.id });

          const parentId = inserted?.id;
          if (parentId) {
            if (ev.dettagli_extra?.id_key) tempIdMap[ev.dettagli_extra.id_key] = parentId;
            existingEvents.push({ id: parentId, titolo: ev.titolo });
          }
          nuovi++;
        }
      } catch (err) {
        req.log.error({ err, ev }, "Error processing parent event approval");
        errori++;
      }
    }

    // Second pass: Process children (those with parent_temp_id)
    for (const ev of children) {
      try {
        const match = existingEvents.find(e => areTitlesSimilar(ev.titolo, e.titolo));
        const existingId = match?.id;

        // Link to real parent ID if available in the map
        let mappedParentId = tempIdMap[ev.dettagli_extra.parent_temp_id] || ev.parent_id || null;
        if (!mappedParentId && ev.dettagli_extra.parent_temp_id) {
          const [foundParent] = await db
            .select({ id: eventsTable.id })
            .from(eventsTable)
            .where(sql`${eventsTable.dettagliExtra}->>'id_key' = ${ev.dettagli_extra.parent_temp_id}`);
          if (foundParent) {
            mappedParentId = foundParent.id;
          }
        }

        if (existingId) {
          const { fonte: _fonte, ...coreValues } = buildCoreEventValues(ev);
          await db.update(eventsTable)
            .set({
              ...coreValues,
              isFestival: false,
              parentId: mappedParentId,
              aggiornatoIl: new Date(),
            })
            .where(eq(eventsTable.id, existingId));

          aggiornati++;
        } else {
          await db.insert(eventsTable).values({
            ...buildCoreEventValues(ev),
            isFestival: false,
            parentId: mappedParentId,
          });
          nuovi++;
        }
      } catch (err) {
        req.log.error({ err, ev }, "Error processing child event approval");
        errori++;
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch existing events for duplicate checking");
    errori = events.length;
  }

  res.json(ApproveEventsResponse.parse({
    success: true,
    nuovi,
    aggiornati,
    errori,
    messaggio: `Pubblicati: ${nuovi} nuovi, ${aggiornati} aggiornati`,
  }));
});

// Archivia la segnalazione Telegram originale (pre-analisi AI) nella tabella di audit
// raw_scrapes su Neon, per non perdere il testo grezzo una volta che l'AI lo arricchisce.
async function archiveTelegramSubmission(ev: any): Promise<void> {
  try {
    if (!ev.titolo?.startsWith("Segnalazione da") && !ev.fonte?.startsWith("Telegram")) {
      return;
    }
    const idKey = ev.dettagli_extra?.id_key;
    if (idKey) {
      const [existing] = await db
        .select({ id: rawScrapesTable.id })
        .from(rawScrapesTable)
        .where(sql`${rawScrapesTable.jsonAiRisposta}->'dettagli_extra'->>'id_key' = ${idKey}`);
      if (existing) return;
    }
    await db.insert(rawScrapesTable).values({
      urlFonte: ev.fonte || "Telegram",
      testoGrezzo: `${ev.titolo}\n${ev.descrizione || ""}`,
      jsonAiRisposta: ev,
    });
  } catch (err) {
    console.error("Errore salvataggio archivio telegram:", err);
  }
}

router.post("/events/analyze", requireAdminKey, async (req, res): Promise<void> => {
  req.log.info("Starting on-demand AI analysis for events");

  const { events, target, mode = "analyze" } = req.body;
  if (!events || !Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "No events provided" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  // Archivia le segnalazioni originali Telegram prima dell'analisi
  for (const ev of events) {
    await archiveTelegramSubmission(ev);
  }

  const aiScript = path.resolve(workspaceRoot, "scraper/run_ai.py");

  try {
    const child = spawn(getPythonExecutable(), [aiScript], {
      cwd: workspaceRoot,
      env: { ...process.env },
    });

    child.stdin.write(JSON.stringify({ events, target, mode }));
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
        // code null = process killed externally (e.g. SIGTERM), treat as success to not block
        if (code === 0 || code === null) resolve();
        else reject(new Error(`Python script exited with code ${code}. Stderr: ${stderrData}`));
      });
      child.on("error", reject);
    });

    let results = [];
    try {
      const nonLogLines = stdoutData.split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('{"log":'))
        .join("");
      results = JSON.parse(nonLogLines);
    } catch (e) {
      throw new Error(`Failed to parse Python output: ${stdoutData}`);
    }

    let errori = 0;
    for (const r of results) {
      if (r.error) {
        errori++;
        req.log.error({ err: r.error, event_id: r.id, tmp_id: r.tmp_id }, "AI analysis failed for event");
      } else if (r.is_extracted && r.parent_id) {
        // Mode "extract" returns flat extracted sub-events
        try {
          const [parent] = await db.select().from(eventsTable).where(eq(eventsTable.id, r.parent_id));
          if (parent) {
            await db.insert(eventsTable).values({
              titolo: r.titolo || "Evento Senza Titolo",
              titoloOriginale: r.titolo || "Evento Senza Titolo",
              categoria: r.categoria || parent.categoria || null,
              dataInizio: r.data_inizio && !isNaN(new Date(r.data_inizio).getTime()) ? r.data_inizio : parent.dataInizio,
              dataFine: r.data_fine && !isNaN(new Date(r.data_fine).getTime()) ? r.data_fine : parent.dataFine,
              oraInizio: r.ora_inizio || null,
              oraFine: r.ora_fine || null,
              luogo: r.luogo || parent.luogo,
              luogoOriginale: r.luogo || parent.luogoOriginale || parent.luogo,
              descrizione: r.testo_estratto || "",
              parentId: parent.id,
              fonte: parent.fonte,
              link: r.link_organizzatore || r.link_biglietti || parent.link,
              linkOrganizzatore: parent.linkOrganizzatore || null,
              linkBiglietti: parent.linkBiglietti || null,
              isFestival: false,
              isIngressoGratuito: r.is_ingresso_gratuito ?? parent.isIngressoGratuito ?? false,
              isEvento: r.is_evento ?? true,
              artisti: r.artisti || null,
              dettagliDominio: r.dettagli_dominio || null,
              immagine: r.immagine || parent.immagine,
            });
          }
        } catch (e) {
          req.log.error({ err: e, parent_id: r.parent_id }, "Failed to save AI extracted sub-event to DB");
          errori++;
        }
      } else if (r.id) {
        // If it has a real DB ID, update the DB directly
        try {
          // First fetch the parent event to check current dates and details
          const [parent] = await db.select().from(eventsTable).where(eq(eventsTable.id, r.id));
          if (parent) {
            const aiDataInizio = r.data_inizio && !isNaN(new Date(r.data_inizio).getTime()) ? r.data_inizio : null;
            const aiDataFine = r.data_fine && !isNaN(new Date(r.data_fine).getTime()) ? r.data_fine : null;
            let { dataInizio, dataFine } = getFestivalDateRange(
              aiDataInizio || parent.dataInizio,
              aiDataFine || parent.dataFine,
              r.sotto_eventi || []
            );

            await db.update(eventsTable)
              .set({
                titolo: r.titolo || parent.titolo,
                titoloOriginale: parent.titoloOriginale || parent.titolo,
                categoria: r.categoria || parent.categoria || null,
                testoEstratto: r.testo_estratto,
                linkOrganizzatore: r.link_organizzatore || parent.linkOrganizzatore || null,
                linkBiglietti: r.link_biglietti || parent.linkBiglietti || null,
                oraInizio: r.ora_inizio || parent.oraInizio || null,
                oraFine: r.ora_fine || parent.oraFine || null,
                isFestival: r.is_festival ?? parent.isFestival ?? false,
                isIngressoGratuito: r.is_ingresso_gratuito ?? parent.isIngressoGratuito ?? false,
                isEvento: r.is_evento ?? parent.isEvento ?? true,
                tags: r.tags || parent.tags || null,
                artisti: r.artisti || parent.artisti || null,
                bioArtisti: r.bio_artisti || parent.bioArtisti || null,
                socialContatti: r.social_contatti || parent.socialContatti || null,
                dettagliDominio: r.dettagli_dominio || parent.dettagliDominio || null,
                dettagliExtra: r.dettagli_extra || parent.dettagliExtra || null,
                descrizione: r.testo_grezzo_url || parent.descrizione,
                dataInizio: dataInizio,
                dataFine: dataFine,
                luogo: r.luogo || parent.luogo,
                aggiornatoIl: new Date(),
              })
              .where(eq(eventsTable.id, r.id));

            await recordAiAnalysis(r.documento_ai, { eventId: r.id });

            // We can also insert sotto_eventi if it's a festival, but since this
            // event is already published, we should create the sub-events in the DB
            if (r.is_festival && r.sotto_eventi && r.sotto_eventi.length > 0) {
              // Delete old sub-events to prevent duplicates
              await db.delete(eventsTable).where(eq(eventsTable.parentId, parent.id));
              for (const se of r.sotto_eventi) {
                await db.insert(eventsTable).values({
                  titolo: se.titolo ? `${r.titolo || parent.titolo} - ${se.titolo}` : `${r.titolo || parent.titolo}`,
                  titoloOriginale: se.titolo || null,
                  categoria: se.categoria || r.categoria || parent.categoria || null,
                  dataInizio: se.data_inizio,
                  dataFine: se.data_fine || se.data_inizio,
                  dateOriginali: se.date_testuali || null,
                  oraInizio: se.ora_inizio || null,
                  oraFine: se.ora_fine || null,
                  luogo: se.luogo || parent.luogo,
                  luogoOriginale: se.luogo || parent.luogoOriginale || parent.luogo,
                  descrizione: se.testo_estratto || null,
                  testoEstratto: se.testo_estratto || null,
                  parentId: parent.id,
                  fonte: parent.fonte,
                  linkOrganizzatore: se.link_organizzatore || r.link_organizzatore || parent.linkOrganizzatore || null,
                  linkBiglietti: se.link_biglietti || r.link_biglietti || parent.linkBiglietti || null,
                  isFestival: false,
                  isIngressoGratuito: se.is_ingresso_gratuito ?? r.is_ingresso_gratuito ?? false,
                  isEvento: se.is_evento ?? true,
                  tags: se.tags || r.tags || null,
                  artisti: se.artisti || null,
                  bioArtisti: se.approfondimenti_extra?.bio_artisti || null,
                  socialContatti: se.approfondimenti_extra?.social_contatti || null,
                  dettagliDominio: se.dettagli_dominio || null,
                  immagine: se.immagine || parent.immagine,
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

router.delete("/events/bulk", requireAdminKey, async (req, res): Promise<void> => {
  const { ids, record_rejected } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "No ids provided" });
    return;
  }

  try {
    if (record_rejected) {
      const rows = await db.select().from(eventsTable).where(inArray(eventsTable.id, ids));
      const toInsert = rows.map(r => ({
        titolo: r.titolo,
        fonte: r.fonte,
        motivo: "Rifiutato dall'admin in bulk",
      }));
      if (toInsert.length > 0) {
        await db.insert(rejectedEventsTable).values(toInsert);
      }
    }
    
    await db.delete(eventsTable).where(inArray(eventsTable.id, ids));
    req.log.info({ count: ids.length }, "Events bulk deleted");
    res.json({ success: true, message: `${ids.length} eventi eliminati` });
  } catch (e) {
    req.log.error({ err: e }, "Bulk delete failed");
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

router.delete("/events/rejected/bulk", requireAdminKey, async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "No ids provided" });
    return;
  }

  try {
    await db.delete(rejectedEventsTable).where(inArray(rejectedEventsTable.id, ids));
    req.log.info({ count: ids.length }, "Rejected events bulk deleted");
    res.json({ success: true, message: `${ids.length} eventi scartati eliminati definitivamente` });
  } catch (e) {
    req.log.error({ err: e }, "Bulk restore/delete rejected events failed");
    res.status(500).json({ error: String(e) });
  }
});

router.post("/events/rejected/bulk-add", requireAdminKey, async (req, res): Promise<void> => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "No events provided" });
    return;
  }

  try {
    const toInsert = events.map((e: any) => ({
      titolo: e.titolo,
      fonte: e.fonte || "Sconosciuta",
      motivo: "Rifiutato in bulk (Scarta)",
    }));
    await db.insert(rejectedEventsTable).values(toInsert);
    req.log.info({ count: events.length }, "Added events to rejected blacklist");
    res.json({ success: true, message: `${events.length} eventi aggiunti alla blacklist` });
  } catch (e) {
    req.log.error({ err: e }, "Failed to bulk add to rejected");
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
      categoria: row.categoria,
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
      is_evento: row.isEvento,
      is_ingresso_gratuito: row.isIngressoGratuito,
      parent_id: row.parentId,
      tags: row.tags || [],
      artisti: row.artisti || [],
      dettagli_dominio: row.dettagliDominio || null,
      dettagli_extra: row.dettagliExtra || null,
      aggiornato_il: row.aggiornatoIl.toISOString(),
    })
  );
});

router.put("/events/:id", requireAdminKey, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const data = req.body;
    let { dataInizio, dataFine } = getFestivalDateRange(data.data_inizio, data.data_fine, data.sotto_eventi || []);
    
    // We only update the core fields that could be modified by the admin
    await db.update(eventsTable)
      .set({
        titolo: data.titolo,
        dataInizio: dataInizio,
        dataFine: dataFine,
        luogo: data.luogo,
        latitudine: data.latitudine,
        longitudine: data.longitudine,
        link: data.link,
        descrizione: data.descrizione,
        immagine: data.immagine,
        fonte: data.fonte,
        testoEstratto: data.testo_estratto,
        parentId: data.parent_id,
        tags: data.tags,
        dettagliExtra: data.dettagli_extra,
        linkOrganizzatore: data.link_organizzatore,
        aggiornatoIl: new Date(),
      })
      .where(eq(eventsTable.id, id));

    res.json({ success: true, message: "Evento aggiornato con successo" });
  } catch (e) {
    req.log.error({ err: e }, "Update event failed");
    res.status(500).json({ error: String(e) });
  }
});

export default router;
