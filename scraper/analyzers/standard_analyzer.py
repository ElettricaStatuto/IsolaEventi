"""
Modulo specializzato nell'analisi di singole locandine (JPG/PNG), testi e pagine web.
"""
import io
import json
import logging
import os
from pathlib import Path
import requests

from .prompts import PROMPT_ANALISI_LOCANDINA_STANDARD

logger = logging.getLogger(__name__)


def extract_text_from_url(url: str) -> str:
    """Scarica ed estrae il testo pulito da una pagina web sorgente."""
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        }
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return f"Errore caricamento pagina fonte: HTTP {resp.status_code}"
            
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
        return f"Errore estrazione testo da pagina fonte: {e}"


def analyze_standard_event(
    ev_dict: dict,
    target: str = "text",
    force_festival: bool = False,
    use_proxy: bool = False,
    model_name: str = "gemini-3.1-flash-lite"
) -> dict:
    """Analizza una locandina (immagine/testo) e genera la scheda evento strutturata."""
    from google import genai
    from google.genai import types

    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(env_path)
    except ImportError:
        pass

    if use_proxy:
        api_key = os.environ.get("REPLIT_API_KEY")
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                base_url="https://production-modelfarm.replit.com"
            )
        )
    else:
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
        descrizione = extract_text_from_url(link)

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
    elif dettagli_extra and dettagli_extra.get("festival_padre"):
        festival_instruction = f"\n\nIMPORTANTE: Questo evento fa parte del festival '{dettagli_extra['festival_padre']}'. Assicurati di menzionarlo chiaramente nell'articolo! Ma assicurati di non cambiare il nome del titolo evento"

    prompt = PROMPT_ANALISI_LOCANDINA_STANDARD.format(
        festival_instruction=festival_instruction,
        model_name=model_name,
        descrizione=descrizione
    )
    contents = [prompt]

    # Caricamento eventuale immagine della locandina (JPG / PNG)
    if target in ("both", "image", "both_source") and image_url:
        if image_url.startswith("http://") or image_url.startswith("https://"):
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = requests.get(image_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                from PIL import Image
                img = Image.open(io.BytesIO(resp.content))
                contents.append(img)
        else:
            base_project = Path(__file__).resolve().parent.parent.parent
            possible_paths = [
                base_project / "data" / "event-images" / image_url,
                base_project / "scraper" / "data" / "event-images" / image_url,
                Path("data/event-images") / image_url
            ]
            img_path = None
            for p in possible_paths:
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
        response = client.models.generate_content(model=model_name, contents=contents)
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
