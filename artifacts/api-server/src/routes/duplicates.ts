import { Router } from "express";
import { db, eventsTable, ignoredDuplicatesTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { requireAdminKey } from "../middlewares/auth.js";

const router = Router();

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

// 1. Find duplicates
router.post("/duplicates/find", requireAdminKey, async (req, res): Promise<void> => {
  const { use_proxy } = req.body;
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");

  try {
    // A. Load preview events
    let previews: any[] = [];
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, "utf8");
      previews = JSON.parse(data).map((ev: any, idx: number) => ({
        ...ev,
        id_key: `prev-${idx}`, // Keep reference to original index in cache
        is_pending: true,
      }));
    }

    // B. Load published/analyzed events
    const published = await db.select().from(eventsTable);
    const dbEvents = published.map(ev => ({
      ...ev,
      id_key: `pub-${ev.id}`,
      is_pending: false,
      // map DB date object to string if necessary
      dataInizio: ev.dataInizio ? String(ev.dataInizio) : null,
    }));

    const allEvents = [...previews, ...dbEvents];

    // C. Group all events by date
    const groupsByDate: { [date: string]: any[] } = {};
    for (const ev of allEvents) {
      const date = ev.dataInizio || ev.data_inizio;
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
            events[i].titolo || events[i].titolo_originale || "",
            events[j].titolo || events[j].titolo_originale || ""
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
            titolo: ev.titolo || ev.titolo_originale,
            luogo: ev.luogo,
            descrizione: ev.descrizione,
          })),
        });
      }
    }

    if (suspiciousGroups.length === 0) {
      res.json({ success: true, duplicates: [] });
      return;
    }

    // E. Send suspicious groups to Python AI script for confirmation
    const pyScript = path.resolve(workspaceRoot, "scraper/find_duplicates.py");
    const child = spawn("python", [pyScript], {
      cwd: workspaceRoot,
      env: { ...process.env },
    });

    child.stdin.write(JSON.stringify({ groups: suspiciousGroups, use_proxy }));
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
    const filteredPairs = [];

    for (const item of confirmedPairs) {
      // Find the two actual event objects
      const ev1 = allEvents.find(e => e.id_key === item.pair[0]);
      const ev2 = allEvents.find(e => e.id_key === item.pair[1]);
      if (!ev1 || !ev2) continue;

      const t1 = ev1.titolo || ev1.titolo_originale;
      const t2 = ev2.titolo || ev2.titolo_originale;

      const isIgnored = ignored.some(ign => 
        (ign.titolo1 === t1 && ign.titolo2 === t2) || 
        (ign.titolo1 === t2 && ign.titolo2 === t1)
      );

      if (!isIgnored) {
        filteredPairs.push({
          date: item.date,
          event1: ev1,
          event2: ev2,
        });
      }
    }

    res.json({ success: true, duplicates: filteredPairs });
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

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");

  try {
    // A. Parse which events to delete
    const deleteKeys = [event1_id_key, event2_id_key];
    const prevIndicesToDelete = new Set<number>();
    const dbIdsToDelete: number[] = [];

    for (const key of deleteKeys) {
      if (key.startsWith("prev-")) {
        prevIndicesToDelete.add(parseInt(key.replace("prev-", ""), 10));
      } else if (key.startsWith("pub-")) {
        dbIdsToDelete.push(parseInt(key.replace("pub-", ""), 10));
      }
    }

    // B. If any was a preview in cache, remove it from cache
    if (prevIndicesToDelete.size > 0 && fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, "utf8");
      const previews = JSON.parse(data);
      const nextPreviews = previews.filter((_: any, idx: number) => !prevIndicesToDelete.has(idx));
      fs.writeFileSync(cacheFile, JSON.stringify(nextPreviews, null, 2), "utf8");
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

export default router;
