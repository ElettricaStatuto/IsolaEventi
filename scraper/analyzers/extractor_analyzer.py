"""
Modulo specializzato nella frammentazione di programmi lunghi / cartelloni in sotto-eventi.
"""
import json
import logging
import os
from pathlib import Path

from .prompts import PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL, FESTIVAL_RESPONSE_SCHEMA

logger = logging.getLogger(__name__)


def extract_sub_events_from_program(
    descrizione: str,
    force_festival: bool = False,
    model_name: str = "gemini-3.1-flash-lite"
) -> dict:
    """Estrae l'evento Padre e tutti i sotto-eventi da un testo lungo di programma."""
    from google import genai

    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(env_path)
    except ImportError:
        pass

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"is_festival": False, "eventi_figli_estratti": [], "info_festival_padre": {}}
    client = genai.Client(api_key=api_key)

    prompt = PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL.replace("{descrizione}", descrizione)
    contents = [prompt]

    try:
        from google.genai import types
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=FESTIVAL_RESPONSE_SCHEMA,
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
        logger.error(f"Errore estrazione sotto-eventi AI: {e}")
        return {"is_festival": False, "eventi_figli_estratti": [], "info_festival_padre": {}, "errore": str(e)}
