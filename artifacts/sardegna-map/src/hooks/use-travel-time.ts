import { useState } from "react";

/**
 * Stima del tempo di percorrenza in auto dalla posizione dell'utente
 * all'evento, via il backend (che a sua volta chiama OpenRouteService).
 * La posizione viene richiesta SOLO su azione esplicita dell'utente
 * (chiamando `calcola()`), mai in automatico all'apertura della scheda -
 * il permesso del browser e' un'interruzione che va chiesta con uno scopo
 * chiaro, non di sorpresa.
 */

export interface TravelTimeResult {
  durataMinuti: number;
  distanzaKm: number;
}

export type TravelTimeState = "idle" | "richiedendo_posizione" | "calcolando" | "pronto" | "errore";

export function useTravelTime(destLat: number | null | undefined, destLng: number | null | undefined) {
  const [state, setState] = useState<TravelTimeState>("idle");
  const [result, setResult] = useState<TravelTimeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calcola = () => {
    if (destLat == null || destLng == null) return;
    if (!("geolocation" in navigator)) {
      setErrorMessage("Il tuo browser non supporta la geolocalizzazione.");
      setState("errore");
      return;
    }

    setState("richiedendo_posizione");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState("calcolando");
        const { latitude, longitude } = position.coords;
        const url = `/api/directions?originLat=${latitude}&originLng=${longitude}&destLat=${destLat}&destLng=${destLng}`;

        fetch(url)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error("richiesta fallita"))))
          .then((data) => {
            if (typeof data.durata_minuti !== "number" || typeof data.distanza_km !== "number") {
              throw new Error("risposta inattesa");
            }
            setResult({ durataMinuti: data.durata_minuti, distanzaKm: data.distanza_km });
            setState("pronto");
          })
          .catch(() => {
            setErrorMessage("Non sono riuscito a calcolare il tempo di percorrenza. Riprova più tardi.");
            setState("errore");
          });
      },
      (geoError) => {
        setErrorMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Permesso di posizione negato: senza la tua posizione non posso stimare la distanza."
            : "Non sono riuscito a determinare la tua posizione."
        );
        setState("errore");
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  return { state, result, errorMessage, calcola };
}
