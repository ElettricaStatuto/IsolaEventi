"""
Modulo specializzato nell'analisi di singole locandine (JPG/PNG), testi e pagine web.
"""
import io
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import requests

from .prompts import PROMPT_ANALISI_LOCANDINA_STANDARD, STANDARD_RESPONSE_SCHEMA

logger = logging.getLogger(__name__)


def extract_text_from_url(url: str) -> Optional[str]:
    """Scarica ed estrae il testo pulito da una pagina web sorgente.

    Ritorna None (dopo un breve retry) se il download o l'estrazione
    falliscono, invece di una stringa che descrive l'errore: un errore di
    rete non deve mai finire scambiato per il vero contenuto della pagina
    e passato cosi' com'e' all'AI da analizzare - il chiamante decide come
    trattare un fallimento reale.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
    }
    ultimo_errore = None
    for tentativo, attesa in enumerate([0, 3]):
        if attesa:
            time.sleep(attesa)
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                ultimo_errore = f"HTTP {resp.status_code}"
                continue

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.content, "lxml")

            for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
                element.decompose()

            text = soup.get_text(separator=" ")
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            clean_text = "\n".join(chunk for chunk in chunks if chunk)

            try:
                raw_texts_dir = Path(__file__).resolve().parent.parent.parent / "data" / "raw_texts"
                raw_texts_dir.mkdir(parents=True, exist_ok=True)
                safe_name = "".join(c for c in url if c.isalnum() or c in ('-', '_')).rstrip()
                file_path = raw_texts_dir / f"{safe_name[:50]}_scraped.txt"
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(clean_text)
            except Exception as e:
                logger.warning(f"Impossibile salvare il testo grezzo: {e}")

            return clean_text[:8000]
        except Exception as e:
            ultimo_errore = str(e)

    logger.warning(f"Impossibile estrarre testo da '{url}' dopo i tentativi: {ultimo_errore}")
    return None


def analyze_standard_event(
    ev_dict: dict,
    target: str = "text",
    force_festival: bool = False,
    model_name: str = "gemini-3.1-flash-lite"
) -> dict:
    """Analizza una locandina (immagine/testo) e genera la scheda evento strutturata."""
    from google import genai

    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(env_path)
    except ImportError:
        pass

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "testo_estratto": "Chiave API Gemini mancante.",
            "is_festival": False,
            "sotto_eventi": [],
            "link_organizzatore": None
        }
    client = genai.Client(api_key=api_key)

    titolo = ev_dict.get("titolo", "")
    descrizione = ev_dict.get("descrizione") or ""
    link = ev_dict.get("link", "")
    image_url = ev_dict.get("immagine")
    dettagli_extra = ev_dict.get("dettagliExtra") or ev_dict.get("dettagli_extra") or {}

    if target in ("source_page", "both_source"):
        if not link or not link.startswith("http"):
            return {
                "testo_estratto": "Errore: nessun link valido della pagina fonte fornito per l'evento.",
                "is_festival": False,
                "sotto_eventi": [],
                "link_organizzatore": None
            }
        testo_pagina = extract_text_from_url(link)
        if testo_pagina is None:
            # Pagina fonte irraggiungibile anche dopo i retry: NON mandiamo
            # nulla all'AI (le mancherebbe qualunque contenuto vero da
            # analizzare) e NON tocchiamo i dati gia' scrapati dell'evento -
            # meglio un evento non ancora arricchito che uno con titolo,
            # categoria e testo generati da un messaggio di errore.
            return {
                "testo_estratto": f"Errore: impossibile scaricare la pagina fonte '{link}' dopo i tentativi.",
                "is_festival": False,
                "sotto_eventi": [],
                "link_organizzatore": None
            }
        descrizione = testo_pagina

    if dettagli_extra and dettagli_extra.get("pdf_path"):
        pdf_path = dettagli_extra["pdf_path"]
        safe_name = os.path.basename(pdf_path)
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('-', '_', '.')).rstrip()
        raw_texts_dir = Path(__file__).resolve().parent.parent.parent / "data" / "raw_texts"
        raw_text_path = raw_texts_dir / f"{safe_name[:50]}_ai_extracted.txt"
        if raw_text_path.exists():
            with open(raw_text_path, "r", encoding="utf-8") as f:
                descrizione = f.read()

    festival_instruction = ""
    if force_festival:
        festival_instruction = "\n\nATTENZIONE: L'utente ha confermato che questa pagina rappresenta il programma di un unico FESTIVAL. DEVI obbligatoriamente restituire 'is_festival_padre': true nella gestione_gerarchia."
    elif dettagli_extra and (dettagli_extra.get("festival_padre") or dettagli_extra.get("parent_temp_id")):
        parent_name = dettagli_extra.get("festival_padre") or "Festival"
        festival_instruction = (
            f"\n\nATTENZIONE - QUESTO E UN SOTTO-EVENTO (EVENTO FIGLIO):\n"
            f"- Questo evento fa parte del festival '{parent_name}'.\n"
            f"- E un evento singolo di una serata specifica, NON un festival intero.\n"
            f"- IMPONE: Imposta 'is_festival_padre': false in gestione_gerarchia e 'lista_sotto_eventi_estratti': [].\n"
            f"- IMPONE: MANTIENI ASSOLUTAMENTE COME TITOLO dell'evento '{titolo}'. Non cambiarlo con il titolo del festival generale.\n"
            f"- Concentrati solo ed esclusivamente sulle informazioni relative a questa specifica serata/attività: '{titolo}'."
        )

    link_fonte_dominio = urlparse(link).netloc if link else "(nessuna pagina fonte, solo testo/immagine forniti)"
    prompt = (
        PROMPT_ANALISI_LOCANDINA_STANDARD
        .replace("{festival_instruction}", festival_instruction)
        .replace("{model_name}", model_name)
        .replace("{link_fonte}", link_fonte_dominio)
        .replace("{descrizione}", descrizione)
    )
    contents = [prompt]

    # Caricamento eventuale immagine della locandina (JPG / PNG)
    if target in ("both", "image", "both_source") and image_url:
        if image_url.startswith("http://") or image_url.startswith("https://"):
            try:
                headers = {"User-Agent": "Mozilla/5.0"}
                resp = requests.get(image_url, headers=headers, timeout=15)
                print(json.dumps({"log": f"🔍 Downloading HTTP image from {image_url} (Status: {resp.status_code})"}), flush=True)
                if resp.status_code == 200:
                    from PIL import Image
                    img = Image.open(io.BytesIO(resp.content))
                    contents.append(img)
                    print(json.dumps({"log": f"✅ Image loaded successfully into Gemini context: {img.size} {img.format}"}), flush=True)
                else:
                    print(json.dumps({"log": f"❌ HTTP image download failed: {resp.status_code}"}), flush=True)
            except Exception as e:
                print(json.dumps({"log": f"❌ Error downloading/opening HTTP image: {str(e)}"}), flush=True)
        else:
            base_project = Path(__file__).resolve().parent.parent.parent
            possible_paths = [
                base_project / "data" / "event-images" / image_url,
                base_project / "scraper" / "data" / "event-images" / image_url,
                Path("data/event-images") / image_url
            ]
            img_path = None
            for p in possible_paths:
                print(json.dumps({"log": f"🔍 AI checked path: {p} (Exists: {p.exists()})"}), flush=True)
                if p.exists():
                    img_path = p
                    break
            if img_path:
                from PIL import Image
                img = Image.open(img_path)
                contents.append(img)
            else:
                logger.warning(f"File immagine locandina non trovato: {image_url}")

    if target == "image" and len(contents) == 1:
        return {
            "testo_estratto": "Errore: nessuna locandina valida fornita o trovata per l'evento.",
            "is_festival": False,
            "sotto_eventi": [],
            "link_organizzatore": None
        }

    try:
        from google.genai import types
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                response_mime_type="application/json",
                response_json_schema=STANDARD_RESPONSE_SCHEMA,
            ),
        )
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        parsed_json = json.loads(text.strip())

        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata
            parsed_json["_usage"] = {
                "prompt_tokens": getattr(usage, "prompt_token_count", 0),
                "candidates_tokens": getattr(usage, "candidates_token_count", 0),
                "total_tokens": getattr(usage, "total_token_count", 0)
            }

        return parsed_json
    except Exception as e:
        logger.error(f"Errore durante l'analisi AI standard: {e}")
        return {
            "testo_estratto": f"Errore analisi AI: {e}",
            "is_festival": False,
            "sotto_eventi": [],
            "link_organizzatore": None
        }
