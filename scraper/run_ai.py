#!/usr/bin/env python3
import sys
import json
import logging
from ai_analyzer import analyze_event

logging.basicConfig(level=logging.ERROR)

def main():
    try:
        # Read JSON list of events from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps([]))
            return
            
        payload = json.loads(input_data)
        if isinstance(payload, dict):
            events = payload.get("events", [])
            target = payload.get("target", "both")
        else:
            events = payload
            target = "both"

        results = []
        total = len(events)
        
        for idx, ev in enumerate(events, 1):
            log_msg = f"[{idx}/{total}] Sto analizzando l'evento: '{ev.get('titolo')}' (Target: {target})"
            print(json.dumps({"log": log_msg}), flush=True)
            
            text = ev.get("descrizione") or ev.get("titolo") or ""
            image_url = ev.get("immagine")
            link = ev.get("link")
            
            try:
                # Add link to context for source page extraction if target is source_page
                ai_data = analyze_event(text, image_url, target=target, link=link)
                
                # If we parsed a source page or both, let's verify if we need to pass the link
                results.append({
                    "id": ev.get("id"), # Can be null if preview
                    "tmp_id": ev.get("tmp_id"), # Unique frontend identifier for previews
                    "testo_estratto": ai_data.get("testo_estratto"),
                    "is_festival": ai_data.get("is_festival", False),
                    "sotto_eventi": ai_data.get("sotto_eventi", []),
                    "link_organizzatore": ai_data.get("link_organizzatore")
                })
            except Exception as e:
                # Append error info but continue to next event
                results.append({
                    "id": ev.get("id"),
                    "tmp_id": ev.get("tmp_id"),
                    "error": str(e)
                })
                
        print(json.dumps(results))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
