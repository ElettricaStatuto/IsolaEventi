import { Router, type IRouter } from "express";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { db, puntiInteresseTable, puntiInteressePendingTable } from "@workspace/db";
import { requireAdminKey } from "../middlewares/auth";

const router: IRouter = Router();

function distanzaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Punti di interesse pubblicati vicino a un punto (l'evento, o in futuro
// l'utente). Filtro grezzo per bounding box in SQL (veloce, indicizzabile),
// poi distanza precisa e ordinamento in JS - stesso approccio gia' usato
// per gli eventi, niente PostGIS per un volume di dati di questa scala.
router.get("/punti-interesse", async (req, res): Promise<void> => {
  const lat = parseFloat(String(req.query.lat));
  const lon = parseFloat(String(req.query.lon));
  const raggioKm = req.query.raggioKm ? parseFloat(String(req.query.raggioKm)) : 15;

  if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(raggioKm)) {
    res.status(400).json({ error: "Coordinate lat/lon (o raggioKm) mancanti o non valide" });
    return;
  }

  const deltaLat = raggioKm / 111;
  const deltaLon = raggioKm / (111 * Math.cos((lat * Math.PI) / 180));

  try {
    const righe = await db
      .select()
      .from(puntiInteresseTable)
      .where(
        and(
          gte(puntiInteresseTable.latitudine, lat - deltaLat),
          lte(puntiInteresseTable.latitudine, lat + deltaLat),
          gte(puntiInteresseTable.longitudine, lon - deltaLon),
          lte(puntiInteresseTable.longitudine, lon + deltaLon)
        )
      );

    const risultato = righe
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        comune: p.comune,
        latitudine: p.latitudine,
        longitudine: p.longitudine,
        descrizione: p.descrizione,
        immagine: p.immagine,
        link_esterno: p.linkEsterno,
        is_partner: p.isPartner,
        distanza_km: distanzaKm(lat, lon, p.latitudine, p.longitudine),
      }))
      .filter((p) => p.distanza_km <= raggioKm)
      .sort((a, b) => a.distanza_km - b.distanza_km)
      .slice(0, 20);

    res.json(risultato);
  } catch (err) {
    req.log.error({ err }, "Errore nel recupero dei punti di interesse");
    res.status(500).json({ error: "Errore nel recupero dei punti di interesse" });
  }
});

// ── Amministrazione: revisione dei punti importati da OpenStreetMap prima
//    che vadano live, stesso principio usato per gli eventi scrapati. ──

router.get("/admin/punti-interesse-pending", requireAdminKey, async (req, res): Promise<void> => {
  try {
    const righe = await db
      .select()
      .from(puntiInteressePendingTable)
      .orderBy(sql`${puntiInteressePendingTable.categoria} asc, ${puntiInteressePendingTable.nome} asc`);
    res.json({ success: true, punti: righe });
  } catch (err) {
    req.log.error({ err }, "Errore nel recupero dei punti di interesse in revisione");
    res.status(500).json({ success: false, error: "Errore nel recupero dei punti in revisione" });
  }
});

router.post("/admin/punti-interesse-pending/:id/pubblica", requireAdminKey, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ success: false, error: "ID non valido" });
    return;
  }

  try {
    const [pending] = await db
      .select()
      .from(puntiInteressePendingTable)
      .where(eq(puntiInteressePendingTable.id, id));

    if (!pending) {
      res.status(404).json({ success: false, error: "Punto di interesse non trovato" });
      return;
    }

    // Le modifiche fatte in revisione (correggere nome/categoria/comune/
    // descrizione, o segnarlo come partner) sovrascrivono i dati grezzi OSM.
    const overrides = req.body || {};

    await db.transaction(async (tx) => {
      await tx.insert(puntiInteresseTable).values({
        nome: overrides.nome ?? pending.nome,
        categoria: overrides.categoria ?? pending.categoria,
        comune: overrides.comune ?? pending.comune,
        provincia: overrides.provincia ?? pending.provincia,
        latitudine: pending.latitudine,
        longitudine: pending.longitudine,
        descrizione: overrides.descrizione ?? pending.descrizione,
        linkEsterno: overrides.link_esterno ?? pending.linkEsterno,
        isPartner: overrides.is_partner ?? false,
      });
      await tx.delete(puntiInteressePendingTable).where(eq(puntiInteressePendingTable.id, id));
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Errore nella pubblicazione del punto di interesse");
    res.status(500).json({ success: false, error: "Errore nella pubblicazione" });
  }
});

router.delete("/admin/punti-interesse-pending/:id", requireAdminKey, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ success: false, error: "ID non valido" });
    return;
  }

  try {
    await db.delete(puntiInteressePendingTable).where(eq(puntiInteressePendingTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Errore nello scarto del punto di interesse");
    res.status(500).json({ success: false, error: "Errore nello scarto" });
  }
});

export default router;
