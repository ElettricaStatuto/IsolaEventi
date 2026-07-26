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

