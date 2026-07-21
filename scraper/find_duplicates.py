#!/usr/bin/env python3
import sys
import json
import os
from google import genai
from google.genai import types

def check_duplicates_ai(groups, use_proxy=False):
    """
    groups: list of groups of events to check.
    Each group: { "date": "YYYY-MM-DD", "events": [ { "id_key": "...", "titolo": "...", "luogo": "...", "descrizione": "..." } ] }
    """
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
            return {"error": "Missing GEMINI_API_KEY"}
        client = genai.Client(api_key=api_key)
        MODEL = "gemini-3.1-flash-lite"

    results = []

    for group in groups:
        date_str = group.get("date")
        events = group.get("events", [])
        if len(events) < 2:
            continue

        # Format prompt for this group
        events_str = ""
        for ev in events:
            events_str += f"- ID: {ev['id_key']}\n  Titolo: {ev.get('titolo')}\n  Luogo: {ev.get('luogo')}\n  Descrizione: {ev.get('descrizione') or ''}\n\n"

        prompt = f"""Sei un assistente AI esperto nell'organizzazione di eventi.
Abbiamo i seguenti eventi programmati per la data {date_str} in Sardegna:

{events_str}
Identifica se ci sono eventi duplicati (cioè che si riferiscono allo stesso identico evento reale, anche se scritti con titoli, formati o descrizioni leggermente diverse).
Restituisci l'elenco dei duplicati trovati organizzandoli in gruppi di ID che corrispondono allo stesso evento.

Rispondi ESCLUSIVAMENTE in formato JSON usando questo schema esatto:
{{
  "duplicates": [
    ["ID_EVENTO_A", "ID_EVENTO_B"]
  ]
}}
Se non trovi nessun duplicato per questo giorno, rispondi con:
{{
  "duplicates": []
}}
"""
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )
            data = json.loads(response.text.strip())
            for dup_pair in data.get("duplicates", []):
                results.append({
                    "date": date_str,
                    "pair": dup_pair
                })
        except Exception as e:
            # Continue to next group but log error
            sys.stderr.write(f"Error checking duplicates for date {date_str}: {e}\n")

    return {"duplicates": results}

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"duplicates": []}))
            return

        payload = json.loads(input_data)
        groups = payload.get("groups", [])
        use_proxy = payload.get("use_proxy", False)

        res = check_duplicates_ai(groups, use_proxy=use_proxy)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
