#!/usr/bin/env python3
"""
Bot Telegram per IsolaEventi / SardegnaMap.

Consente a chiunque su Telegram di inviare:
- Foto di locandine (JPG/PNG)
- Documenti locandina (PDF/Immagini)
- Testi o Link a eventi

Il bot salva il file e inserisce la segnalazione come bozza grezza in 'In Attesa'
(in preview_cache.json / database), SENZA chiamare automaticamente l'AI di Gemini.
In questo modo non vengono consumati crediti API in automatico: l'amministratore
dall'Admin Web deciderà quando cliccare su 'Analizza' per elaborare l'evento.

Uso:
  python telegram_bot.py
"""

import json
import logging
import os
import re
import sys
import time
import uuid
from pathlib import Path

# Fix encoding per console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("telegram_bot")

# Directori e percorsi file
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
IMAGES_DIR = BASE_DIR / "data" / "event-images"
PREVIEW_CACHE_PATH = BASE_DIR / "preview_cache.json"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def load_env():
    """Carica le variabili da .env se presenti."""
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))


load_env()

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()


def get_preview_cache() -> list:
    """Legge in modo sicuro preview_cache.json."""
    if not PREVIEW_CACHE_PATH.exists():
        return []
    try:
        with open(PREVIEW_CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"Errore lettura preview_cache.json: {e}")
        return []


def save_preview_cache(cache_data: list):
    """Salva in modo atomico il file preview_cache.json."""
    temp_path = BASE_DIR / "preview_cache.json.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        temp_path.replace(PREVIEW_CACHE_PATH)
    except Exception as e:
        logger.error(f"Errore scrittura preview_cache.json: {e}")


class TelegramBot:
    def __init__(self, token: str):
        self.token = token
        self.api_url = f"https://api.telegram.org/bot{token}"
        self.session = requests.Session()

    def send_message(self, chat_id: int, text: str, parse_mode: str = "Markdown") -> bool:
        """Invia un messaggio a un utente su Telegram."""
        url = f"{self.api_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }
        try:
            resp = self.session.post(url, json=payload, timeout=10)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Errore invio messaggio a chat {chat_id}: {e}")
            return False

    def download_file(self, file_id: str, dest_path: Path) -> bool:
        """Scarica un file dai server di Telegram."""
        try:
            get_file_url = f"{self.api_url}/getFile"
            res = self.session.get(get_file_url, params={"file_id": file_id}, timeout=15)
            data = res.json()
            if not data.get("ok"):
                logger.error(f"Impossibile ottenere file_path Telegram per file_id {file_id}: {data}")
                return False

            file_path = data["result"]["file_path"]
            download_url = f"https://api.telegram.org/file/bot{self.token}/{file_path}"
            
            img_res = self.session.get(download_url, timeout=30)
            if img_res.status_code == 200:
                with open(dest_path, "wb") as f:
                    f.write(img_res.content)
                return True
            else:
                logger.error(f"Errore download file da {download_url}: HTTP {img_res.status_code}")
                return False
        except Exception as e:
            logger.error(f"Eccezione durante download file Telegram: {e}")
            return False

    def handle_update(self, update: dict):
        """Gestisce un singolo aggiornamento ricevuto da Telegram."""
        message = update.get("message")
        if not message:
            return

        chat_id = message["chat"]["id"]
        user_info = message.get("from", {})
        username = user_info.get("username", "")
        first_name = user_info.get("first_name", "Utente")
        user_display = f"@{username}" if username else first_name

        text_content = message.get("text", "") or message.get("caption", "")

        # 1. Comando /start o /help
        if text_content and text_content.startswith(("/start", "/help")):
            msg = (
                f"👋 *Ciao {first_name}! Benvenuto su IsolaEventi Bot!* 🎈\n\n"
                "Invia qui la locandina di un evento in Sardegna!\n\n"
                "Puoi inviare:\n"
                "• 📸 *Una Foto / Immagine* della locandina\n"
                "• 📄 *Un File PDF* dell'evento\n"
                "• 🔗 *Un Link o Testo* descrittivo dell'evento\n\n"
                "La tua segnalazione verrà inviata direttamente al nostro pannello di gestione "
                "e apparirà nell'area *In Attesa* dell'Admin per essere revisionata e pubblicata sulla mappa! ⭐"
            )
            self.send_message(chat_id, msg)
            return

        # 2. Comando /status
        if text_content and text_content.startswith("/status"):
            cache = get_preview_cache()
            telegram_count = sum(1 for e in cache if e.get("fonte", "").startswith("Telegram"))
            msg = (
                f"📊 *Stato Sistema IsolaEventi*\n\n"
                f"• Eventi totali in attesa: `{len(cache)}`\n"
                f"• Segnalazioni da Telegram: `{telegram_count}`\n"
            )
            self.send_message(chat_id, msg)
            return

        # Variabili bozza evento
        image_filename = None
        event_title = f"Segnalazione da {user_display}"
        event_desc = f"Segnalazione ricevuta via Telegram da {user_display} (ID: {chat_id}).\n"
        if text_content:
            event_desc += f"\nTesto/Didascalia inviata:\n{text_content}"

        temp_id = f"temp_tg_{uuid.uuid4().hex[:8]}"

        # 3. Gestione Foto
        if "photo" in message and isinstance(message["photo"], list):
            # Prendi la foto con risoluzione maggiore (l'ultima della lista)
            best_photo = message["photo"][-1]
            file_id = best_photo["file_id"]
            
            ext = "jpg"
            image_filename = f"telegram_{int(time.time())}_{uuid.uuid4().hex[:6]}.{ext}"
            dest_path = IMAGES_DIR / image_filename

            logger.info(f"Ricevuta foto da {user_display}. Download in corso in {image_filename}...")
            if not self.download_file(file_id, dest_path):
                self.send_message(chat_id, "⚠️ Si è verificato un errore durante il salvataggio dell'immagine. Riprova più tardi.")
                return

            if text_content:
                # Se c'è una didascalia, usiamo le prime parole come titolo indicativo
                clean_caption = text_content.strip().split("\n")[0]
                if len(clean_caption) > 5:
                    event_title = clean_caption[:70]

        # 4. Gestione Documento (PDF o Immagine in formato file)
        elif "document" in message:
            doc = message["document"]
            file_id = doc["file_id"]
            orig_name = doc.get("file_name", "locandina.pdf")
            mime = doc.get("mime_type", "")

            ext = "pdf"
            if "png" in orig_name.lower() or "png" in mime:
                ext = "png"
            elif "jpg" in orig_name.lower() or "jpeg" in orig_name.lower() or "image" in mime:
                ext = "jpg"

            image_filename = f"telegram_{int(time.time())}_{uuid.uuid4().hex[:6]}.{ext}"
            dest_path = IMAGES_DIR / image_filename

            logger.info(f"Ricevuto documento ({orig_name}) da {user_display}. Download in {image_filename}...")
            if not self.download_file(file_id, dest_path):
                self.send_message(chat_id, "⚠️ Si è verificato un errore durante il download del documento. Riprova più tardi.")
                return

            event_title = f"Documento ({orig_name}) da {user_display}"

        # 5. Gestione Solo Testo / Link
        elif text_content:
            clean_lines = [l.strip() for l in text_content.split("\n") if l.strip()]
            if clean_lines:
                event_title = clean_lines[0][:70]
        else:
            self.send_message(chat_id, "ℹ️ Per favore invia una foto, un documento PDF o un testo con i dettagli dell'evento.")
            return

        # Costruzione bozza evento grezza per preview_cache.json
        raw_event = {
            "titolo": event_title,
            "data_inizio": None,
            "data_fine": None,
            "date_originali": None,
            "luogo": None,
            "luogo_originale": None,
            "latitudine": None,
            "longitudine": None,
            "link": text_content if "http" in text_content else None,
            "descrizione": event_desc,
            "immagine": image_filename,
            "fonte": f"Telegram ({user_display})",
            "is_new": True,
            "testo_estratto": None,  # Nessuna analisi AI automatica! L'admin deciderà quando cliccare "Analizza"
            "is_festival": False,
            "parent_id": None,
            "tags": ["Telegram", "Segnalazione"],
            "dettagli_extra": {
                "id_key": temp_id,
                "parent_temp_id": None,
                "metodo_estrazione": f"Segnalazione Telegram da {user_display}",
                "telegram_user": user_display,
                "telegram_chat_id": chat_id,
                "ricevuto_il": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
        }

        # Salvataggio in preview_cache.json
        cache = get_preview_cache()
        cache.append(raw_event)
        save_preview_cache(cache)

        logger.info(f"✅ Nuova segnalazione Telegram salvata in preview_cache: '{event_title}'")

        # Risposta di conferma all'utente
        reply_msg = (
            "✅ *Locandina ricevuta e salvata con successo!* 🎉\n\n"
            "La tua segnalazione è stata registrata ed è ora visibile nel pannello Admin sotto *'In Attesa'*.\n"
            "Gli amministratori la revisioneranno e la pubblicheranno sulla mappa degli eventi in Sardegna.\n\n"
            "Grazie per il tuo contributo! ⭐"
        )
        self.send_message(chat_id, reply_msg)

    def run(self):
        """Avvia il loop principale di polling."""
        logger.info("🤖 Bot Telegram IsolaEventi avviato! In ascolto di nuovi messaggi...")
        offset = 0
        while True:
            try:
                url = f"{self.api_url}/getUpdates"
                params = {"offset": offset, "timeout": 20}
                resp = self.session.get(url, params=params, timeout=25)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        for update in data.get("result", []):
                            offset = update["update_id"] + 1
                            self.handle_update(update)
                elif resp.status_code == 401:
                    logger.error("❌ Token Telegram errato o non valido! Controlla TELEGRAM_BOT_TOKEN in .env.")
                    time.sleep(10)
                else:
                    logger.warning(f"Risposta HTTP inattesa da Telegram API: {resp.status_code}")
                    time.sleep(5)
            except requests.exceptions.ReadTimeout:
                # Timeout normale di long polling
                continue
            except Exception as e:
                logger.error(f"Errore durante il polling Telegram: {e}")
                time.sleep(5)


def main():
    if not BOT_TOKEN:
        print("\n" + "=" * 70)
        print("⚠️  TELEGRAM_BOT_TOKEN non impostato nel file .env!")
        print("=" * 70)
        print("Per attivare il Bot Telegram:")
        print("1. Apri Telegram e cerca @BotFather")
        print("2. Invia il comando /newbot e segui le istruzioni per dare un nome al bot")
        print("3. Copia il token fornito (es. 7123456789:ABCdefGhIJK...)")
        print("4. Apri il file .env e aggiungi la riga:")
        print("   TELEGRAM_BOT_TOKEN=il_tuo_token_qui")
        print("5. Riavvia questo script: python telegram_bot.py")
        print("=" * 70 + "\n")
        sys.exit(1)

    bot = TelegramBot(BOT_TOKEN)
    bot.run()


if __name__ == "__main__":
    main()
