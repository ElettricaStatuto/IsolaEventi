import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Stima del tempo di percorrenza in auto tra due punti, via OpenRouteService
// (gratuito fino a 2000 richieste/giorno). La chiave resta lato server -
// non viene mai esposta al browser, come per la chiave Gemini.
router.get("/directions", async (req, res): Promise<void> => {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Servizio di instradamento non configurato" });
    return;
  }

  const originLat = parseFloat(String(req.query.originLat));
  const originLng = parseFloat(String(req.query.originLng));
  const destLat = parseFloat(String(req.query.destLat));
  const destLng = parseFloat(String(req.query.destLng));

  if ([originLat, originLng, destLat, destLng].some((n) => Number.isNaN(n))) {
    res.status(400).json({ error: "Coordinate di origine/destinazione mancanti o non valide" });
    return;
  }

  try {
    const orsResponse = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      // ORS vuole le coordinate come [longitudine, latitudine], ordine invertito
      // rispetto a come le teniamo noi ovunque nel resto del progetto.
      body: JSON.stringify({
        coordinates: [
          [originLng, originLat],
          [destLng, destLat],
        ],
      }),
    });

    if (!orsResponse.ok) {
      const errBody = await orsResponse.text();
      req.log.warn({ status: orsResponse.status, errBody }, "OpenRouteService ha risposto con un errore");
      res.status(502).json({ error: "Impossibile calcolare il percorso" });
      return;
    }

    const data: any = await orsResponse.json();
    const summary = data?.routes?.[0]?.summary;
    if (!summary || typeof summary.duration !== "number" || typeof summary.distance !== "number") {
      res.status(502).json({ error: "Risposta del servizio di instradamento inattesa" });
      return;
    }

    res.json({
      durata_minuti: Math.round(summary.duration / 60),
      distanza_km: Math.round((summary.distance / 1000) * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Errore nel calcolo del percorso");
    res.status(502).json({ error: "Impossibile calcolare il percorso" });
  }
});

export default router;
