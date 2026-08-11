"""
Modulo specializzato nell'estrazione e analisi di documenti e brochure PDF.
"""
import json
import logging
import os
from pathlib import Path

from .prompts import PROMPT_ANALISI_PDF, PDF_RESPONSE_SCHEMA

logger = logging.getLogger(__name__)


def struttura_eventi_da_pdf(pdf_path: str) -> list[dict]:
    """Analizza il PDF con Gemini per estrarre testo grezzo e strutturare eventi base."""
    from google import genai
    from google.genai import types

    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(env_path)
    except ImportError:
        pass

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return [{"titolo": "Errore", "descrizione": "Chiave API Gemini mancante per PDF."}]
    client = genai.Client(api_key=api_key)

    contents = [PROMPT_ANALISI_PDF]

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
                response_json_schema=PDF_RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )
        data = json.loads(response.text)

        # Salva il testo estratto per uso futuro
        testo_pdf = data.get("testo_integrale_pdf", "")
        if testo_pdf:
            try:
                raw_texts_dir = Path(__file__).resolve().parent.parent.parent / "data" / "raw_texts"
                raw_texts_dir.mkdir(parents=True, exist_ok=True)
                safe_name = os.path.basename(pdf_path)
                safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('-', '_', '.')).rstrip()
                txt_path = raw_texts_dir / f"{safe_name[:50]}_ai_extracted.txt"
                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(testo_pdf)
            except Exception as e:
                logger.warning(f"Errore salvataggio raw_texts: {e}")

        eventi_grezzi = data.get("lista_sotto_eventi_estratti", [])
        if not eventi_grezzi and data.get("dati_curati_ai", {}).get("titolo"):
            eventi_grezzi = [data["dati_curati_ai"]]

        eventi_out = []
        for ev in eventi_grezzi:
            if ev.get("is_evento") is False:
                continue
            eventi_out.append({
                "titolo": ev.get("titolo", "Evento Senza Titolo"),
                "categoria": ev.get("categoria", "Altro"),
                "data_inizio": ev.get("data_inizio"),
                "data_fine": ev.get("data_fine"),
                "ora_inizio": ev.get("ora_inizio"),
                "ora_fine": ev.get("ora_fine"),
                "luogo": ev.get("luogo"),
                "descrizione": ev.get("testo_estratto", ""),
                "link_organizzatore": ev.get("link_organizzatore"),
                "link_biglietti": ev.get("link_biglietti"),
                "is_ingresso_gratuito": ev.get("is_ingresso_gratuito", False),
                "artisti": ev.get("artisti", []),
                "tags": ev.get("tags", []),
                "dettagli_dominio": ev.get("dettagli_dominio"),
                "approfondimenti_extra": ev.get("approfondimenti_extra"),
                "is_evento": ev.get("is_evento", True),
            })
        return eventi_out
    except Exception as e:
        return [{"titolo": "Errore AI", "descrizione": str(e)}]
