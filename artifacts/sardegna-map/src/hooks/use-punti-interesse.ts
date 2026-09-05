import { useEffect, useState } from "react";

/**
 * Punti di interesse pubblicati vicino a un punto (l'evento). Nessuna
 * posizione dell'utente richiesta qui - a differenza di use-travel-time e
 * use-user-location, questa e' una lista sempre visibile legata al luogo
 * dell'evento, non alla posizione di chi visita il sito.
 */

export interface PuntoInteresse {
  id: number;
  nome: string;
  categoria: string;
  comune: string | null;
  latitudine: number;
  longitudine: number;
  descrizione: string | null;
  immagine: string | null;
  link_esterno: string | null;
  is_partner: boolean;
  distanza_km: number;
}

export function usePuntiInteresseVicini(
  latitudine: number | null | undefined,
  longitudine: number | null | undefined,
  raggioKm: number = 15
): { punti: PuntoInteresse[]; isLoading: boolean } {
  const [punti, setPunti] = useState<PuntoInteresse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPunti([]);
    if (latitudine == null || longitudine == null) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/punti-interesse?lat=${latitudine}&lon=${longitudine}&raggioKm=${raggioKm}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPunti(Array.isArray(data) ? data : []))
      .catch(() => {
        // Nessun punto di interesse mostrato in caso di errore - sezione
        // opzionale, non deve mai rompere la visualizzazione dell'evento.
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [latitudine, longitudine, raggioKm]);

  return { punti, isLoading };
}

/**
 * Punti di interesse pubblicati lungo un percorso reale gia' calcolato
 * (non in linea d'aria) - da usare solo dopo che l'utente ha calcolato il
 * tempo di percorrenza verso l'evento, mai prima.
 */
export function usePuntiInteresseLungoStrada(
  percorso: [number, number][] | null | undefined,
  raggioKm: number = 3
): { punti: PuntoInteresse[]; isLoading: boolean } {
  const [punti, setPunti] = useState<PuntoInteresse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPunti([]);
    if (!percorso || percorso.length < 2) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/punti-interesse/lungo-strada`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percorso, raggioKm }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPunti(Array.isArray(data) ? data : []))
      .catch(() => {
        // Sezione opzionale, non deve mai rompere la visualizzazione dell'evento.
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percorso, raggioKm]);

  return { punti, isLoading };
}
