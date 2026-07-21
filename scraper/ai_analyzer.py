import os
import json
import logging
import io
import requests

logger = logging.getLogger(__name__)

def extract_text_from_url(url: str) -> str:
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
        
        # Remove navigation, footers, headers, scripts, styles, asides
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
            
        text = soup.get_text(separator=" ")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = "\n".join(chunk for chunk in chunks if chunk)
        
        try:
            os.makedirs(os.path.join("data", "raw_texts"), exist_ok=True)
            safe_name = "".join(c for c in url if c.isalnum() or c in ('-', '_')).rstrip()
            file_path = os.path.join("data", "raw_texts", f"{safe_name[:50]}_scraped.txt")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(clean_text)
        except Exception as e:
            logger.warning(f"Impossibile salvare il testo grezzo: {e}")

        return clean_text[:8000]
    except Exception as e:
        return f"Errore estrazione testo da pagina fonte: {e}"

def struttura_eventi_da_pdf(pdf_path: str, use_proxy: bool = False) -> list[dict]:
    """Analizza il PDF con Gemini per estrarre testo grezzo e strutturare eventi base."""
    from google import genai
    from google.genai import types

    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
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
            return [{"titolo": "Errore", "descrizione": "Chiave API Gemini mancante per PDF."}]
        client = genai.Client(api_key=api_key)

    base_instructions = """Sei un assistente AI.
Il tuo obiettivo è esaminare il PDF allegato.
1. Estrai e trascrivi TUTTO IL TESTO rilevante presente in tutte le pagine (il programma, le descrizioni, ecc.). Inseriscilo nel campo 'testo_integrale_pdf'.
2. Identifica tutti gli eventi menzionati. Fai particolare attenzione a eventi secondari come MOSTRE (esposizioni d'arte, fotografia) o LABORATORI (workshop, seminari, attività didattiche) e trattali come eventi a sé stanti.
3. Se è un festival o ci sono più date, dividi ogni giornata in un evento separato. Se c'è un nome generale per l'evento, crea anche un evento "Padre".
4. FAI MOLTA ATTENZIONE ALLE DATE: se un evento indica un periodo continuo (es. "da Venerdì 17 a Domenica 19 Luglio"), DEVI assolutamente valorizzare sia "data_inizio" (2026-07-17) che "data_fine" (2026-07-19). Se è un giorno singolo, "data_fine" può essere uguale a "data_inizio" o omesso.
5. Per ogni evento trovato (incluso il padre, le mostre e i laboratori), fornisci SOLO queste informazioni base: "titolo", "data_inizio" (YYYY-MM-DD), "data_fine" (YYYY-MM-DD), e "luogo". Dovrai calcolare l'anno in corso o logico se non è esplicito.

Rispondi ESCLUSIVAMENTE in formato JSON usando questo schema esatto:
{
  "testo_integrale_pdf": "Tutto il testo estratto qui...",
  "eventi": [
    {
      "titolo": "Titolo Evento o Serata",
      "data_inizio": "YYYY-MM-DD",
      "data_fine": "YYYY-MM-DD",
      "luogo": "Luogo dell'evento"
    }
  ]
}
"""
    contents = [base_instructions]

    if pdf_path and os.path.exists(pdf_path):
        try:
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            contents.append(
                types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf')
            )
        except Exception as e:
            return [{"titolo": "Errore", "descrizione": f"Errore lettura PDF: {e}"}]
    else:
        return [{"titolo": "Errore", "descrizione": "PDF non trovato."}]

    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        data = json.loads(response.text)
        
        # Salva il testo estratto per uso futuro
        testo_pdf = data.get("testo_integrale_pdf", "")
        if testo_pdf:
            try:
                os.makedirs(os.path.join("data", "raw_texts"), exist_ok=True)
                safe_name = os.path.basename(pdf_path)
                safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('-', '_', '.')).rstrip()
                txt_path = os.path.join("data", "raw_texts", f"{safe_name[:50]}_ai_extracted.txt")
                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(testo_pdf)
            except Exception as e:
                logger.warning(f"Errore salvataggio raw_texts: {e}")

        eventi_out = []
        for ev in data.get("eventi", []):
            eventi_out.append({
                "titolo": ev.get("titolo", "Evento Senza Titolo"),
                "data_inizio": ev.get("data_inizio"),
                "data_fine": ev.get("data_fine"),
                "luogo": ev.get("luogo"),
                "descrizione": "",  # Lasciamo vuota, sarà popolata dall'analisi successiva
            })
        return eventi_out
    except Exception as e:
        return [{"titolo": "Errore AI", "descrizione": str(e)}]

def analyze_event(ev_dict: dict, target: str = "text", force_festival: bool = False, use_proxy: bool = False) -> dict:
    from google import genai
    from google.genai import types

    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
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
        MODEL = "gemini-3.1-flash-lite"
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"testo_estratto": "Chiave API Gemini mancante.", "is_festival": False, "sotto_eventi": [], "link_organizzatore": None}
        client = genai.Client(api_key=api_key)
        MODEL = "gemini-3.1-flash-lite"

    try:
        titolo = ev_dict.get("titolo", "")
        descrizione = ev_dict.get("descrizione") or ""
        link = ev_dict.get("link", "")
        image_url = ev_dict.get("immagine")
        dettagli_extra = ev_dict.get("dettagliExtra") or ev_dict.get("dettagli_extra") or {}
        
        # Extract text from the source page link if target is source_page or both_source
        if target in ("source_page", "both_source"):
            if not link or not link.startswith("http"):
                return {
                    "testo_estratto": "Errore: nessun link valido della pagina fonte fornito per l'evento.",
                    "is_festival": False,
                    "sotto_eventi": [],
                    "link_organizzatore": None
                }
            descrizione = extract_text_from_url(link)
            
        # Try to load raw text if it's a PDF
        if dettagli_extra and dettagli_extra.get("pdf_path"):
            pdf_path = dettagli_extra["pdf_path"]
            safe_name = os.path.basename(pdf_path)
            safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('-', '_', '.')).rstrip()
            raw_text_path = os.path.join("data", "raw_texts", f"{safe_name[:50]}_ai_extracted.txt")
            if os.path.exists(raw_text_path):
                with open(raw_text_path, "r", encoding="utf-8") as f:
                    descrizione = f.read()
                    
        raw_text_used = descrizione if target in ("source_page", "both_source") or (dettagli_extra and dettagli_extra.get("pdf_path")) else None
                    
        festival_instruction = ""
        if force_festival:
            festival_instruction = "\n\nATTENZIONE: L'utente ha confermato che questa pagina rappresenta il programma di un unico FESTIVAL. DEVI obbligatoriamente restituire 'is_festival': true e raggruppare tutti gli eventi trovati dentro l'array 'sotto_eventi'. Non restituire mai la lista vuota se ci sono eventi nel testo."
        
        base_instructions = f"""
Sei un analista esperto di eventi culturali in Sardegna.
Analizza il seguente testo (ed eventualmente l'immagine allegata) di un evento.
{festival_instruction}

Il tuo obiettivo è estrarre:
1. Un titolo espanso ed elaborato ('titolo'). Se il titolo originale consiste solo nel nome di un artista, di un gruppo o di uno spettacolo (es. 'Satoyama', 'Bandakadabra'), espandilo aggiungendo la tipologia, come ad esempio 'Concerto: Satoyama' o 'Spettacolo: Bandakadabra'. Se l'evento fa parte di un festival, NON inserire il nome del festival nel titolo (es. NON scrivere 'al Time in Jazz') poiché verrà gestito separatamente tramite associazione del festival.
2. La categoria principale dell'evento ('categoria'). Scegli uno tra: ["Musica", "Teatro", "Cinema", "Arte", "Incontro", "Enogastronomia", "Folklore", "Sport", "Bambini", "Altro"].
3. Un riassunto chiaro e accattivante ('testo_estratto') specificamente per questa serata/evento. Scrivi come se fossi un giornalista culturale: usa un tono coinvolgente, professionale ed elegante, mettendo in risalto il valore artistico e culturale dell'evento. Non usare elenchi puntati freddi, ma crea una narrazione fluida.
4. Trova se è presente un indirizzo o link del sito web ufficiale dell'organizzatore.
5. Seleziona i TAG (categorie secondarie) per l'evento. Devi scegliere:
   - ESATTAMENTE 1 "Tag Primario" da questa lista: ["Musica", "Teatro", "Cinema", "Arte e Mostre", "Enogastronomia", "Folklore e Tradizione", "Letteratura e Incontri", "Sport", "Bambini e Famiglie", "Altro"]
   - DA 0 A 2 "Tag Secondari" da questa lista: ["Musica Elettronica", "Jazz", "Musica Classica", "Rock/Pop", "DJ Set", "Danza", "Stand-up Comedy", "Cinema d'Autore", "Documentario", "Cortometraggio", "Degustazione", "Mercato", "Escursione", "Festa Patronale", "Fotografia", "Workshop", "Festival"]

6. Se il testo si riferisce chiaramente all'intero cartellone o rassegna con tanti eventi diversi (o se è forzato come festival), imposta "is_festival" a true ed elenca i concerti/appuntamenti nell'array "sotto_eventi". Assicurati di estrarre anche il "url" specifico del sotto-evento e la "descrizione" (se presenti nel testo, marcati da `--- Link: ---` o simili).

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{{
  "titolo": "Titolo espanso ed elaborato dell'evento",
  "categoria": "Categoria principale",
  "testo_estratto": "Riassunto completo della serata...",
  "is_festival": false,
  "sotto_eventi": [
    {{
      "titolo": "...",
      "data_inizio": "...",
      "data_fine": "...",
      "luogo": "...",
      "url": "...",
      "descrizione": "..."
    }}
  ],
  "link_organizzatore": "URL ufficiale o null",
  "tags": ["Tag1", "Tag2"],
  "dettagli_extra": {{
     "chiave": "valore"
  }}
}}

TESTO SORGENTE:
{descrizione}
"""
        contents = [base_instructions]

        # Load image if requested and available
        if target in ("both", "image", "both_source") and image_url:
            if image_url.startswith("http://") or image_url.startswith("https://"):
                headers = {"User-Agent": "Mozilla/5.0"}
                resp = requests.get(image_url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    from PIL import Image
                    img = Image.open(io.BytesIO(resp.content))
                    contents.append(img)
            else:
                possible_paths = [
                    os.path.join("data", "event-images", image_url),
                    os.path.join("..", "data", "event-images", image_url),
                    os.path.join(os.path.dirname(__file__), "..", "data", "event-images", image_url),
                    os.path.join(os.path.dirname(__file__), "data", "event-images", image_url)
                ]
                img_path = None
                for p in possible_paths:
                    if os.path.exists(p):
                        img_path = p
                        break
                if img_path:
                    from PIL import Image
                    img = Image.open(img_path)
                    contents.append(img)
                else:
                    logger.warning(f"Local image file not found: {image_url}")
        
        # Special check if target is strictly "image" but no image could be loaded
        if target == "image" and len(contents) == 1:
            return {
                "testo_estratto": "Errore: nessuna locandina valida fornita o trovata per l'evento.",
                "is_festival": False,
                "sotto_eventi": [],
                "link_organizzatore": None
            }
            
        response = client.models.generate_content(model=MODEL, contents=contents)
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        parsed_json = json.loads(text.strip())
        
        # Aggiungi usage info se disponibile
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata
            parsed_json["_usage"] = {
                "prompt_tokens": getattr(usage, "prompt_token_count", 0),
                "candidates_tokens": getattr(usage, "candidates_token_count", 0),
                "total_tokens": getattr(usage, "total_token_count", 0)
            }
            
        return parsed_json
        
    except Exception as e:
        logger.error(f"Errore durante l'analisi AI: {e}")
        return {"testo_estratto": f"Errore analisi AI: {e}", "is_festival": False, "sotto_eventi": [], "link_organizzatore": None}
