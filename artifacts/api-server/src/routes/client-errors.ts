import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, clientErrorsTable } from "@workspace/db";
import { requireAdminKey } from "../middlewares/auth";

const router: IRouter = Router();

// Limiti di lunghezza generosi ma non illimitati: un errore JS puo' avere
// stack trace lunghissimi (soprattutto minificati/con sourcemap inline), non
// vogliamo che una richiesta malformata o abusiva riempia il database.
const MAX_LEN = 4000;
function tronca(v: unknown, max = MAX_LEN): string | null {
  if (typeof v !== "string" || !v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

// Endpoint pubblico (nessuna x-admin-key): deve poter ricevere segnalazioni
// da QUALSIASI visitatore che incontra un errore, non solo dagli admin.
router.post("/client-errors", async (req, res): Promise<void> => {
  try {
    const { codice, messaggio, stack, componentStack, url } = req.body ?? {};
    if (!codice || !messaggio) {
      res.status(400).json({ errore: "codice e messaggio sono obbligatori" });
      return;
    }
    await db.insert(clientErrorsTable).values({
      codice: tronca(codice, 32) ?? "??????",
      messaggio: tronca(messaggio) ?? "(vuoto)",
      stack: tronca(stack),
      componentStack: tronca(componentStack),
      url: tronca(String(url ?? ""), 500),
      userAgent: tronca(req.headers["user-agent"], 500),
    });
    res.status(204).end();
  } catch (e) {
    // Non far mai fallire rumorosamente la segnalazione di un errore: se
    // anche questo endpoint ha un problema, l'utente non deve accorgersene.
    console.error("Errore nel salvare una segnalazione client:", e);
    res.status(204).end();
  }
});

// Elenco raggruppato per codice: quanti errori uguali, l'ultimo visto,
// un esempio di stack - per capire a colpo d'occhio quali problemi sono
// piu' diffusi invece di scorrere centinaia di righe identiche.
router.get("/client-errors", requireAdminKey, async (_req, res): Promise<void> => {
  const righe = await db
    .select({
      codice: clientErrorsTable.codice,
      messaggio: clientErrorsTable.messaggio,
      stack: sql<string | null>`(array_agg(${clientErrorsTable.stack} ORDER BY ${clientErrorsTable.creatoIl} DESC))[1]`,
      url: sql<string | null>`(array_agg(${clientErrorsTable.url} ORDER BY ${clientErrorsTable.creatoIl} DESC))[1]`,
      userAgent: sql<string | null>`(array_agg(${clientErrorsTable.userAgent} ORDER BY ${clientErrorsTable.creatoIl} DESC))[1]`,
      occorrenze: sql<number>`count(*)::int`,
      ultimaVolta: sql<string>`max(${clientErrorsTable.creatoIl})`,
      primaVolta: sql<string>`min(${clientErrorsTable.creatoIl})`,
    })
    .from(clientErrorsTable)
    .groupBy(clientErrorsTable.codice, clientErrorsTable.messaggio)
    .orderBy(desc(sql`max(${clientErrorsTable.creatoIl})`))
    .limit(200);

  res.json({ errori: righe });
});

export default router;
