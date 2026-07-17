import os
import json
import logging
import io
import requests

logger = logging.getLogger(__name__)

def analyze_event(descrizione: str, image_url: str = None) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"testo_estratto": "Chiave API Gemini mancante.", "is_festival": False, "sotto_eventi": []}

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    try:
        model = genai.GenerativeModel("gemini-3.5-flash")
        
        prompt = (
            "Sei un assistente per l'estrazione dati da eventi in Sardegna.\n"
            "Analizza il testo della descrizione fornito e la locandina allegata (se presente).\n"
            "1. Riassumi brevemente le informazioni utili estratte dal testo e dall'immagine (orari, specialità, ospiti).\n"
            "2. Determina se l'evento principale è un 'Festival', 'Sagra' o 'Festa Patronale' con più giornate distinte (multi-data).\n"
            "3. Se è multi-data, estrai ogni singola giornata come un sotto-evento distinto.\n"
            "IMPORTANTE: Se le date sono del tipo 19-20-21 Luglio, devi creare 3 sotto-eventi.\n"
            "Rispondi ESCLUSIVAMENTE in formato JSON valido, usando esattamente questo schema:\n"
            "{\n"
            '  "testo_estratto": "Riassunto o informazioni estratte dalla locandina...",\n'
            '  "is_festival": true o false,\n'
            '  "sotto_eventi": [\n'
            '    {"titolo": "Nome Giornata", "data_inizio": "YYYY-MM-DD", "data_fine": "YYYY-MM-DD", "luogo": "Nome luogo/paese"}\n'
            "  ]\n"
            "}\n\n"
            f"DESCRIZIONE ORIGINALE:\n{descrizione}"
        )

        contents = [prompt]
        
        if image_url:
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = requests.get(image_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                from PIL import Image
                img = Image.open(io.BytesIO(resp.content))
                contents.append(img)
            
        response = model.generate_content(contents)
        
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
        return {"testo_estratto": f"Errore analisi AI: {e}", "is_festival": False, "sotto_eventi": []}
