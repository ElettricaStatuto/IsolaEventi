import { useState } from "react";

/**
 * Posizione dell'utente per ordinare gli eventi per vicinanza nella sezione
 * "Vicino a te". A differenza di `use-travel-time` (che chiede la posizione
 * una tantum per un singolo calcolo), qui la posizione viene richiesta UNA
 * VOLTA su azione esplicita e poi ricordata in localStorage, cosi' la
 * sezione funziona subito alle visite successive senza richiedere di nuovo
 * il permesso del browser ogni volta.
 */

const STORAGE_KEY = "sardegna_user_location";

export interface UserPosition {
  lat: number;
  lon: number;
}

export type UserLocationState = "idle" | "richiedendo" | "pronto" | "errore";

function leggiPosizioneSalvata(): UserPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(leggiPosizioneSalvata);
  const [state, setState] = useState<UserLocationState>(position ? "pronto" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const richiedi = () => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("Il tuo browser non supporta la geolocalizzazione.");
      setState("errore");
      return;
    }
    setState("richiedendo");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: UserPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPosition(p);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        setState("pronto");
      },
      (geoError) => {
        setErrorMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Permesso di posizione negato."
            : "Non sono riuscito a determinare la tua posizione."
        );
        setState("errore");
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const dimentica = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPosition(null);
    setState("idle");
  };

  return { position, state, errorMessage, richiedi, dimentica };
}
