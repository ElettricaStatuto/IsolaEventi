import { Router } from "express";
import { db, eventsTable, pendingEventsTable, ignoredDuplicatesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import path from "path";
import { spawn } from "child_process";
import { requireAdminKey } from "../middlewares/auth.js";

const router = Router();

function getPythonExecutable(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  return process.platform === "win32" ? "python" : "python3";
}

// Simple token similarity helper (Dice's Coefficient)
function stringSimilarity(str1: string, str2: string): number {
  const getTokens = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const t1 = new Set(getTokens(str1));
  const t2 = new Set(getTokens(str2));
  if (t1.size === 0 || t2.size === 0) return 0;
  let intersection = 0;
  t1.forEach(t => {
    if (t2.has(t)) intersection++;
  });
  return (2 * intersection) / (t1.size + t2.size);
}

// Logica condivisa di ricerca duplicati (usata sia da /duplicates/find che da
// /duplicates/merge-all, cosi' l'elenco delle coppie e' sempre lo stesso).
async function findDuplicatePairs(): Promise<{ date: string; event1: any; event2: any }[]> {
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  // A. Load pending events from Neon
  const pendingRows = await db.select().from(pendingEventsTable);
  const previews = pendingRows.map((ev) => ({
    ...ev,
    id_key: `pend-${ev.id}`,
    is_pending: true,
  }));

  // B. Load published/analyzed events
  const published = await db.select().from(eventsTable);
  const dbEvents = published.map(ev => ({
    ...ev,
    id_key: `pub-${ev.id}`,
    is_pending: false,
    dataInizio: ev.dataInizio ? String(ev.dataInizio) : null,
  }));

  const allEvents = [...previews, ...dbEvents];

  // C. Group all events by date
  const groupsByDate: { [date: string]: any[] } = {};
  for (const ev of allEvents) {
    const date = ev.dataInizio;
    if (!date) continue;
    if (!groupsByDate[date]) groupsByDate[date] = [];
    groupsByDate[date].push(ev);
  }

  // D. Pre-filter algorithm (Dice's Coefficient on title)
  const suspiciousGroups: { date: string; events: any[] }[] = [];
  for (const [date, events] of Object.entries(groupsByDate)) {
    if (events.length < 2) continue;

    const suspiciousEventsSet = new Set<any>();
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const sim = stringSimilarity(
          events[i].titolo || events[i].titoloOriginale || "",
          events[j].titolo || events[j].titoloOriginale || ""
        );
        if (sim >= 0.3) {
          suspiciousEventsSet.add(events[i]);
          suspiciousEventsSet.add(events[j]);
        }
      }
    }

    if (suspiciousEventsSet.size >= 2) {
      suspiciousGroups.push({
        date,
        events: Array.from(suspiciousEventsSet).map((ev: any) => ({
          id_key: ev.id_key,
          titolo: ev.titolo || ev.titoloOriginale,
          luogo: ev.luogo,
          descrizione: ev.descrizione,
        })),
      });
    }
  }

  if (suspiciousGroups.length === 0) return [];

  // E. Send suspicious groups to Python AI script for confirmation
  const pyScript = path.resolve(workspaceRoot, "scraper/find_duplicates.py");
  const child = spawn(getPythonExecutable(), [pyScript], {
    cwd: workspaceRoot,
    env: { ...process.env },
  });

  child.stdin.write(JSON.stringify({ groups: suspiciousGroups }));
  child.stdin.end();

  let stdoutData = "";
  let stderrData = "";

  child.stdout.on("data", chunk => stdoutData += chunk);
  child.stderr.on("data", chunk => stderrData += chunk);

  await new Promise<void>((resolve, reject) => {
    child.on("close", code => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Python script exited with code ${code}. Stderr: ${stderrData}`));
    });
    child.on("error", reject);
  });

  const aiRes = JSON.parse(stdoutData);
  const confirmedPairs: { date: string; pair: string[] }[] = aiRes.duplicates || [];

  // F. Filter out ignored duplicates from database
  const ignored = await db.select().from(ignoredDuplicatesTable);
  const filteredPairs: { date: string; event1: any; event2: any }[] = [];

  for (const item of confirmedPairs) {
    const ev1 = allEvents.find(e => e.id_key === item.pair[0]);
    const ev2 = allEvents.find(e => e.id_key === item.pair[1]);
    if (!ev1 || !ev2) continue;

    const t1 = ev1.titolo || ev1.titoloOriginale;
    const t2 = ev2.titolo || ev2.titoloOriginale;

    const isIgnored = ignored.some(ign =>
      (ign.titolo1 === t1 && ign.titolo2 === t2) ||
      (ign.titolo1 === t2 && ign.titolo2 === t1)
    );

    if (!isIgnored) {
      filteredPairs.push({ date: item.date, event1: ev1, event2: ev2 });
    }
  }

  return filteredPairs;
}

// Sceglie automaticamente i valori "migliori" tra due eventi duplicati,
// con la stessa logica di default gia' usata dal MergeModal (frontend):
// preferisce i valori non vuoti e le descrizioni piu' lunghe.
function autoSelectMergedEvent(ev1: any, ev2: any, date: string) {
  const desc1 = ev1.descrizione || "";
  const desc2 = ev2.descrizione || "";
  const txt1 = ev1.testoEstratto || ev1.testo_estratto || "";
  const txt2 = ev2.testoEstratto || ev2.testo_estratto || "";

  return {
    titolo: ev1.titolo || ev2.titolo,
    titoloOriginale: ev1.titoloOriginale || ev1.titolo || ev2.titoloOriginale || ev2.titolo,
    categoria: ev1.categoria || ev2.categoria || null,
    dataInizio: date,
    dataFine: date,
    luogo: ev1.luogo || ev2.luogo || null,
    latitudine: ev1.latitudine ?? ev2.latitudine ?? null,
    longitudine: ev1.longitudine ?? ev2.longitudine ?? null,
    link: ev1.link || ev2.link || null,
    linkOrganizzatore: ev1.linkOrganizzatore || ev2.linkOrganizzatore || null,
    linkBiglietti: ev1.linkBiglietti || ev2.linkBiglietti || null,
    descrizione: desc1.length >= desc2.length ? desc1 : desc2,
    testoEstratto: txt1.length >= txt2.length ? txt1 : txt2,
    immagine: ev1.immagine || ev2.immagine || null,
    fonte: Array.from(new Set([ev1.fonte, ev2.fonte].filter(Boolean))).join(", ") || "Fuso",
    tags: Array.from(new Set([...(ev1.tags || []), ...(ev2.tags || [])])),
    artisti: Array.from(new Set([...(ev1.artisti || []), ...(ev2.artisti || [])])),
    isEvento: ev1.isEvento ?? ev2.isEvento ?? true,
    dettagliDominio: ev1.dettagliDominio || ev2.dettagliDominio || null,
    dettagliExtra: { ...(ev1.dettagliExtra || {}), ...(ev2.dettagliExtra || {}) },
  };
}

async function mergeDuplicatePair(ev1IdKey: string, ev2IdKey: string, mergedEvent: any): Promise<void> {
  const deleteKeys = [ev1IdKey, ev2IdKey];
  const pendingIdsToDelete: number[] = [];
  const dbIdsToDelete: number[] = [];

  for (const key of deleteKeys) {
    if (key.startsWith("pend-")) {
      pendingIdsToDelete.push(parseInt(key.replace("pend-", ""), 10));
    } else if (key.startsWith("pub-")) {
      dbIdsToDelete.push(parseInt(key.replace("pub-", ""), 10));
    }
  }

  if (pendingIdsToDelete.length > 0) {
    await db.delete(pendingEventsTable).where(
      or(...pendingIdsToDelete.map(id => eq(pendingEventsTable.id, id)))
    );
  }

  if (dbIdsToDelete.length > 0) {
    await db.delete(eventsTable).where(
      or(...dbIdsToDelete.map(id => eq(eventsTable.id, id)))
    );
  }

  await db.insert(eventsTable).values(mergedEvent);
}

// 1. Find duplicates
router.post("/duplicates/find", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const duplicates = await findDuplicatePairs();
    res.json({ success: true, duplicates });
  } catch (error) {
    req.log.error({ err: error }, "Failed to find duplicates");
    res.status(500).json({ error: String(error) });
  }
});

// 2. Ignore duplicate pair
router.post("/duplicates/ignore", requireAdminKey, async (req, res): Promise<void> => {
  const { title1, title2, date } = req.body;
  if (!title1 || !title2) {
    res.status(400).json({ error: "Missing event titles" });
    return;
  }

  try {
    await db.insert(ignoredDuplicatesTable).values({
      titolo1: title1,
      titolo2: title2,
      data: date || null,
    });
    res.json({ success: true, message: "Coppia contrassegnata come falso allarme" });
  } catch (e) {
    req.log.error({ err: e }, "Failed to ignore duplicate");
    res.status(500).json({ error: String(e) });
  }
});

// 3. Merge events
router.post("/duplicates/merge", requireAdminKey, async (req, res): Promise<void> => {
  const { mergedEvent, event1_id_key, event2_id_key } = req.body;
  if (!mergedEvent || !event1_id_key || !event2_id_key) {
    res.status(400).json({ error: "Missing merge details" });
    return;
  }

  try {
    // A. Parse which events to delete
    const deleteKeys = [event1_id_key, event2_id_key];
    const pendingIdsToDelete: number[] = [];
    const dbIdsToDelete: number[] = [];

    for (const key of deleteKeys) {
      if (key.startsWith("pend-")) {
        pendingIdsToDelete.push(parseInt(key.replace("pend-", ""), 10));
      } else if (key.startsWith("pub-")) {
        dbIdsToDelete.push(parseInt(key.replace("pub-", ""), 10));
      }
    }

    // B. If any was a pending event, remove it from pending_events
    if (pendingIdsToDelete.length > 0) {
      await db.delete(pendingEventsTable).where(
        or(...pendingIdsToDelete.map(id => eq(pendingEventsTable.id, id)))
      );
    }

    // C. If any was a published event in DB, delete it
    if (dbIdsToDelete.length > 0) {
      // Use standard delete
      // We will perform hard delete
      await db.delete(eventsTable).where(
        or(
          ...dbIdsToDelete.map(id => eq(eventsTable.id, id))
        )
      );
    }

    // D. Insert the new merged event to DB (effectively publishing it)
    const [inserted] = await db.insert(eventsTable).values({
      titolo: mergedEvent.titolo,
      titoloOriginale: mergedEvent.titoloOriginale || mergedEvent.titolo,
      categoria: mergedEvent.categoria || null,
      dataInizio: mergedEvent.dataInizio || mergedEvent.data_inizio,
      dataFine: mergedEvent.dataFine || mergedEvent.data_fine || mergedEvent.dataInizio || mergedEvent.data_inizio,
      luogo: mergedEvent.luogo || null,
      latitudine: mergedEvent.latitudine ? parseFloat(mergedEvent.latitudine) : null,
      longitudine: mergedEvent.longitudine ? parseFloat(mergedEvent.longitudine) : null,
      link: mergedEvent.link || null,
      linkOrganizzatore: mergedEvent.linkOrganizzatore || mergedEvent.link_organizzatore || null,
      descrizione: mergedEvent.descrizione || null,
      immagine: mergedEvent.immagine || null,
      fonte: mergedEvent.fonte || "Fuso",
      testoEstratto: mergedEvent.testoEstratto || mergedEvent.testo_estratto || null,
      tags: mergedEvent.tags || [],
      dettagliExtra: mergedEvent.dettagliExtra || mergedEvent.dettagli_extra || {},
    }).returning();

    res.json({ success: true, message: "Eventi fusi con successo", mergedEvent: inserted });
  } catch (e) {
    req.log.error({ err: e }, "Failed to merge events");
    res.status(500).json({ error: String(e) });
  }
});

// 4. Merge ALL confirmed duplicate pairs automatically (nessuna revisione manuale
// campo per campo: per ogni coppia sceglie i valori piu' completi tra i due eventi).
//
// Riceve le coppie gia' trovate da /duplicates/find (il client le ha gia' in mano
// dopo aver premuto "Trova Duplicati"): rifare qui la ricerca da zero raddoppierebbe
// il tempo (incluse le chiamate AI a Gemini per ogni gruppo), rischiando il timeout
// del browser su richieste con molte coppie. Se non vengono passate coppie, la
// ricerca viene comunque eseguita come fallback per compatibilita'.
router.post("/duplicates/merge-all", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const pairs: { date: string; event1: any; event2: any }[] =
      Array.isArray(req.body?.pairs) && req.body.pairs.length > 0
        ? req.body.pairs
        : await findDuplicatePairs();

    let fuse = 0;
    let errori = 0;

    // Esegue le fusioni a piccoli lotti in parallelo invece che una alla volta,
    // per stare ben sotto i tempi di timeout anche con molte coppie.
    const BATCH_SIZE = 8;
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE);
      const risultati = await Promise.allSettled(
        batch.map(pair => {
          const merged = autoSelectMergedEvent(pair.event1, pair.event2, pair.date);
          return mergeDuplicatePair(pair.event1.id_key, pair.event2.id_key, merged);
        })
      );
      for (const r of risultati) {
        if (r.status === "fulfilled") fuse++;
        else {
          errori++;
          req.log.error({ err: r.reason }, "Failed to auto-merge duplicate pair");
        }
      }
    }

    res.json({ success: true, fuse, errori, totale: pairs.length });
  } catch (error) {
    req.log.error({ err: error }, "Failed to auto-merge all duplicates");
    res.status(500).json({ error: String(error) });
  }
});

export default router;
