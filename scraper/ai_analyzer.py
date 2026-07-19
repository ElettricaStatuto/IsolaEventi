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
        
        return clean_text[:8000]
    except Exception as e:
        return f"Errore estrazione testo da pagina fonte: {e}"

def analyze_event(descrizione: str, image_url: str = None, target: str = "both", link: str = None, use_proxy: bool = False) -> dict:
    from google import genai
    from google.genai import types

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
            
        # Define prompt based on the chosen target
        base_instructions = """Sei un assistente AI esperto nell'estrazione e organizzazione di dati per eventi in Sardegna.
Analizza attentamente i dati forniti per:
1. Estrarre e organizzare le informazioni utili (date, orari, programma, ospiti, specialità enogastronomiche, contatti, prezzi).
2. Identificare se l'evento è un Festival, Sagra o Festa Patronale che si articola su più giornate/date (multi-data).
3. Se si tratta di un evento multi-data, dividi l'evento principale in sotto-eventi giornalieri compilando l'array 'sotto_eventi' con i relativi titoli di ciascuna giornata, date e luoghi.
4. Trova se è presente un indirizzo o link del sito web ufficiale dell'organizzatore (es. pagina Facebook, account Instagram dell'associazione o proloco, sito web dell'organizzatore). NON indicare il sito da cui è stato preso il link (es. paradisola, eventiinsardegna ecc.), ma SOLO quello del comitato organizzatore dell'evento.
5. Seleziona i TAG (categorie) per l'evento. Devi scegliere:
   - ESATTAMENTE 1 "Tag Primario" da questa lista: ["Musica", "Teatro", "Cinema", "Arte e Mostre", "Enogastronomia", "Folklore e Tradizione", "Letteratura e Incontri", "Sport", "Bambini e Famiglie", "Altro"]
   - DA 0 A 2 "Tag Secondari" (più specifici) da questa lista: ["Musica Elettronica", "Jazz", "Musica Classica", "Rock/Pop", "DJ Set", "Danza", "Stand-up Comedy", "Cinema d'Autore", "Documentario", "Cortometraggio", "Degustazione", "Mercato", "Escursione", "Festa Patronale", "Fotografia", "Workshop", "Festival"]
   Inserisci tutti i tag scelti (primario + eventuali secondari) nell'array 'tags'.
6. Cerca di estrarre dei dettagli extra specifici in base al tipo di evento. Usa la tua base di conoscenza per arricchire questi dettagli SOLO SE sei assolutamente certo delle informazioni (es. se conosci l'artista, aggiungi una breve biografia). Se non sei sicuro, ometti il campo. Ecco cosa cercare in base all'evento:
   - Se Musica: "genere_musicale", "artisti_principali", "strumenti", "bio_artista"
   - Se Cinema: "regista", "cast_principale", "genere_film", "anno_uscita", "durata", "tema_trattato"
   - Se Teatro: "compagnia_teatrale", "regista", "attori_principali", "autore_testo"
   - Se Arte/Mostre: "artisti_esposti", "curatore", "tipologia_opere"
   - Se Enogastronomia: "prodotti_tipici", "attivita_previste", "tradizione_legata"
   - Se Letteratura: "autori_relatori", "titolo_libro", "argomento_principale"
   Inserisci tutti i dettagli trovati in un oggetto JSON chiamato "dettagli_extra".
7. Produci un riassunto chiaro ed informativo nel campo 'testo_estratto' basato sui dati forniti, arricchito possibilmente con le informazioni scoperte.

Rispondi ESCLUSIVAMENTE in formato JSON valido, usando esattamente questo schema:
{
  "testo_estratto": "Riassunto completo...",
  "is_festival": true o false,
  "sotto_eventi": [
    {"titolo": "Nome Giornata", "data_inizio": "YYYY-MM-DD", "data_fine": "YYYY-MM-DD", "luogo": "Nome luogo"}
  ],
  "link_organizzatore": "URL ufficiale o null",
  "tags": ["Tag1", "Tag2"],
  "dettagli_extra": {
     "chiave": "valore"
  }
}
"""
        
        if target == "image":
            prompt = base_instructions + "\nAnalizza attentamente l'IMMAGINE DELLA LOCANDINA allegata per estrarre le informazioni richieste."
        elif target == "text":
            prompt = base_instructions + f"\nAnalizza attentamente il TESTO DELLA DESCRIZIONE fornito dal sito web:\n{descrizione}"
        elif target == "source_page":
            prompt = base_instructions + f"\nAnalizza attentamente il TESTO DELLA PAGINA FONTE estratto dal link dell'evento:\n{descrizione}"
        elif target == "both_source":
            prompt = base_instructions + f"\nAnalizza attentamente il TESTO DELLA PAGINA FONTE e l'IMMAGINE DELLA LOCANDINA allegata:\n{descrizione}"
        else: # "both"
            prompt = base_instructions + f"\nAnalizza attentamente il TESTO DELLA DESCRIZIONE e l'IMMAGINE DELLA LOCANDINA allegata:\n{descrizione}"

        contents = [prompt]
        
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
                # Local image path handling
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
            
        return json.loads(text.strip())
        
    except Exception as e:
        logger.error(f"Errore durante l'analisi AI: {e}")
        return {"testo_estratto": f"Errore analisi AI: {e}", "is_festival": False, "sotto_eventi": [], "link_organizzatore": None}
