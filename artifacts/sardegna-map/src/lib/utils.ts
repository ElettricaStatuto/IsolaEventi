import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAssetUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  if (relativePath.startsWith("http")) return relativePath;
  const baseUrl = import.meta.env.VITE_API_URL || "";
  return baseUrl ? `${baseUrl.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}` : relativePath;
}

export function getEventImageUrl(immagine: string | null | undefined): string | null {
  if (!immagine) return null;
  if (immagine.startsWith("http")) return immagine;
  return getAssetUrl(`/api/event-images/${immagine}`);
}

/**
 * Link diretto a Google Maps sul punto esatto dell'evento. Richiede
 * coordinate precise (gia' derivate dal geocoding sul luogo specifico,
 * es. "Città, Piazza/Via/Locale") - se mancano, ritorna null: niente
 * fallback su una ricerca testuale generica, meglio nessun link che uno
 * poco affidabile.
 */
export function googleMapsUrl(
  latitudine: number | null | undefined,
  longitudine: number | null | undefined
): string | null {
  if (latitudine == null || longitudine == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitudine},${longitudine}`;
}

/**
 * Cerca nella lista `social_contatti` (URL/contatti liberi trovati dall'AI)
 * il primo link verso una piattaforma specifica. Ritorna null se non c'e'.
 */
export function findSocialLink(
  socialContatti: string[] | null | undefined,
  platform: "facebook" | "instagram"
): string | null {
  if (!socialContatti) return null;
  const host = platform === "facebook" ? "facebook.com" : "instagram.com";
  return socialContatti.find((s) => s.toLowerCase().includes(host)) || null;
}

/**
 * Formatta una durata in minuti come "1h 34min" (o solo "34 min" se sotto
 * l'ora) invece del numero grezzo di minuti — più leggibile per i tempi di
 * percorrenza stimati.
 */
export function formatDurata(minutiTotali: number): string {
  const minuti = Math.round(minutiTotali);
  const ore = Math.floor(minuti / 60);
  const restoMinuti = minuti % 60;
  if (ore === 0) return `${restoMinuti} min`;
  return `${ore}h ${restoMinuti}min`;
}

