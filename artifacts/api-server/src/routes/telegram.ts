import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router: IRouter = Router();

async function getPreviewCache(cacheFile: string): Promise<any[]> {
  if (!fs.existsSync(cacheFile)) {
    return [];
  }
  try {
    const raw = await fs.promises.readFile(cacheFile, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

async function savePreviewCache(cacheFile: string, data: any[]) {
  const tempPath = cacheFile + ".tmp";
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.promises.rename(tempPath, cacheFile);
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}

async function downloadTelegramFile(botToken: string, fileId: string, destPath: string) {
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const res = await fetch(getFileUrl);
  const data = await res.json() as any;
  if (!data.ok) {
    throw new Error(`Telegram getFile failed: ${JSON.stringify(data)}`);
  }
  const filePath = data.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: ${fileRes.statusText}`);
  }
  const buffer = await fileRes.arrayBuffer();
  await fs.promises.writeFile(destPath, Buffer.from(buffer));
}

router.post("/telegram-webhook", async (req, res): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!botToken) {
    req.log.error("TELEGRAM_BOT_TOKEN is not set");
    res.status(500).json({ error: "Bot token not configured" });
    return;
  }

  const update = req.body;
  const message = update.message;
  if (!message) {
    res.sendStatus(200);
    return;
  }

  const chatId = message.chat.id;
  const userInfo = message.from || {};
  const username = userInfo.username || "";
  const firstName = userInfo.first_name || "Utente";
  const userDisplay = username ? `@${username}` : firstName;
  const textContent = message.text || message.caption || "";

  try {
    // 1. /start or /help
    if (textContent && (textContent.startsWith("/start") || textContent.startsWith("/help"))) {
      const msg = `👋 *Ciao ${firstName}! Benvenuto su IsolaEventi Bot!* 🎈\n\n` +
        `Invia qui la locandina di un evento in Sardegna!\n\n` +
        `Puoi inviare:\n` +
        `• 📸 *Una Foto / Immagine* della locandina\n` +
        `• 📄 *Un File PDF* dell'evento\n` +
        `• 🔗 *Un Link o Testo* descrittivo dell'evento\n\n` +
        `La tua segnalazione verrà inviata direttamente al nostro pannello di gestione ` +
        `e apparirà nell'area *In Attesa* dell'Admin per essere revisionata e pubblicata sulla mappa! ⭐`;
      await sendTelegramMessage(botToken, chatId, msg);
      res.sendStatus(200);
      return;
    }

    // 2. /status
    if (textContent && textContent.startsWith("/status")) {
      const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
        ? path.resolve(process.cwd(), "../..")
        : process.cwd();
      const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");
      const cache = await getPreviewCache(cacheFile);
      const telegramCount = cache.filter((e: any) => e.fonte?.startsWith("Telegram")).length;

      const msg = `📊 *Stato Sistema IsolaEventi*\n\n` +
        `• Eventi totali in attesa: \`${cache.length}\`\n` +
        `• Segnalazioni da Telegram: \`${telegramCount}\`\n`;
      await sendTelegramMessage(botToken, chatId, msg);
      res.sendStatus(200);
      return;
    }

    // 3. Process photo, document or text
    let imageFilename: string | null = null;
    let eventTitle = `Segnalazione da ${userDisplay}`;
    let eventDesc = `Segnalazione ricevuta via Telegram da ${userDisplay} (ID: ${chatId}).\n`;
    if (textContent) {
      eventDesc += `\nTesto/Didascalia inviata:\n${textContent}`;
    }

    const tempId = `temp_tg_${crypto.randomUUID().slice(0, 8)}`;
    const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
      ? path.resolve(process.cwd(), "../..")
      : process.cwd();
    const imagesDir = path.resolve(workspaceRoot, "data", "event-images");

    // Assicura che la directory esista
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      // Photo
      const bestPhoto = message.photo[message.photo.length - 1];
      const fileId = bestPhoto.file_id;
      const ext = "jpg";
      imageFilename = `telegram_${Math.floor(Date.now() / 1000)}_${crypto.randomUUID().slice(0, 6)}.${ext}`;
      const destPath = path.join(imagesDir, imageFilename);

      req.log.info(`Downloading Telegram photo to ${imageFilename}`);
      await downloadTelegramFile(botToken, fileId, destPath);

      if (textContent) {
        const cleanCaption = textContent.trim().split("\n")[0];
        if (cleanCaption.length > 5) {
          eventTitle = cleanCaption.slice(0, 70);
        }
      }
    } else if (message.document) {
      // Document
      const doc = message.document;
      const fileId = doc.file_id;
      const origName = doc.file_name || "locandina.pdf";
      const mime = doc.mime_type || "";

      let ext = "pdf";
      if (origName.toLowerCase().includes("png") || mime.includes("png")) {
        ext = "png";
      } else if (origName.toLowerCase().includes("jpg") || origName.toLowerCase().includes("jpeg") || mime.includes("image")) {
        ext = "jpg";
      }

      imageFilename = `telegram_${Math.floor(Date.now() / 1000)}_${crypto.randomUUID().slice(0, 6)}.${ext}`;
      const destPath = path.join(imagesDir, imageFilename);

      req.log.info(`Downloading Telegram document (${origName}) to ${imageFilename}`);
      await downloadTelegramFile(botToken, fileId, destPath);

      eventTitle = `Documento (${origName}) da ${userDisplay}`;
    } else if (textContent) {
      // Plain text/link
      const cleanLines = textContent.split("\n").map((l: string) => l.trim()).filter(Boolean);
      if (cleanLines.length > 0) {
        eventTitle = cleanLines[0].slice(0, 70);
      }
    } else {
      await sendTelegramMessage(botToken, chatId, "ℹ️ Per favore invia una foto, un documento PDF o un testo con i dettagli dell'evento.");
      res.sendStatus(200);
      return;
    }

    // Build raw event object
    const rawEvent = {
      titolo: eventTitle,
      data_inizio: null,
      data_fine: null,
      date_originali: null,
      luogo: null,
      luogo_originale: null,
      latitudine: null,
      longitudine: null,
      link: textContent.includes("http") ? textContent : null,
      descrizione: eventDesc,
      immagine: imageFilename,
      fonte: `Telegram (${userDisplay})`,
      is_new: true,
      testo_estratto: null,
      is_festival: false,
      parent_id: null,
      tags: ["Telegram", "Segnalazione"],
      dettagli_extra: {
        id_key: tempId,
        parent_temp_id: null,
        metodo_estrazione: `Segnalazione Telegram da ${userDisplay}`,
        telegram_user: userDisplay,
        telegram_chat_id: chatId,
        ricevuto_il: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    };

    const cacheFile = path.resolve(workspaceRoot, "preview_cache.json");
    const cache = await getPreviewCache(cacheFile);
    cache.push(rawEvent);
    await savePreviewCache(cacheFile, cache);

    req.log.info(`New Telegram submission saved: '${eventTitle}'`);

    const replyMsg = `✅ *Locandina ricevuta e salvata con successo!* 🎉\n\n` +
      `La tua segnalazione è stata registrata ed è ora visibile nel pannello Admin sotto *'In Attesa'*.\n` +
      `Gli amministratori la revisioneranno e la pubblicheranno sulla mappa degli eventi in Sardegna.\n\n` +
      `Grazie per il tuo contributo! ⭐`;
    await sendTelegramMessage(botToken, chatId, replyMsg);
  } catch (error) {
    req.log.error(error, "Error processing Telegram webhook");
    await sendTelegramMessage(botToken, chatId, "⚠️ Si è verificato un errore durante l'elaborazione. Riprova più tardi.");
  }

  res.sendStatus(200);
});

export default router;
