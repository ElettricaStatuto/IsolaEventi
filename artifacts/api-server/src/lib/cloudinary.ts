import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary non configurato: mancano le variabili d'ambiente CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
}

/**
 * Carica un file (dal percorso locale) su Cloudinary e restituisce l'URL pubblico.
 * Il file locale viene cancellato dopo l'upload.
 */
export async function uploadToCloudinary(
  localFilePath: string,
  folder: string = "isola-eventi"
): Promise<string> {
  ensureConfigured();

  const result = await cloudinary.uploader.upload(localFilePath, {
    folder,
    // Ottimizzazioni automatiche: formato WebP, qualità auto, max 1200px larghezza
    transformation: [
      { width: 1200, crop: "limit" },
      { quality: "auto", fetch_format: "auto" },
    ],
    resource_type: "image",
  });

  // Cancella il file locale dopo l'upload riuscito
  try {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch {
    // ignora errori di pulizia
  }

  return result.secure_url;
}

/**
 * Carica un buffer di byte direttamente su Cloudinary (senza scrivere su disco).
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  originalName: string,
  folder: string = "isola-eventi"
): Promise<string> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: originalName.replace(/\.[^/.]+$/, ""), // rimuove estensione
        transformation: [
          { width: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload fallito"));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Restituisce true se Cloudinary è configurato (tutte e 3 le env var presenti).
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}
