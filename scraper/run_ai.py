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
            use_proxy = payload.get("use_proxy", False)
        else:
            events = payload
            target = "both"
            use_proxy = False

        results = []
        total = len(events)
        
        for idx, ev in enumerate(events, 1):
            log_msg = f"[{idx}/{total}] Sto analizzando l'evento: '{ev.get('titolo')}' (Target: {target})"
            print(json.dumps({"log": log_msg}), flush=True)
            
            try:
                # Add link to context for source page extraction if target is source_page
                ai_data = analyze_event(ev, target=target, use_proxy=use_proxy)
                
                if "_usage" in ai_data:
                    u = ai_data["_usage"]
                    usage_msg = f"⚡ Token Consumati: {u['total_tokens']} (Prompt: {u['prompt_tokens']}, Risposta: {u['candidates_tokens']})"
                    print(json.dumps({"log": usage_msg}), flush=True)
                
                # If we parsed a source page or both, let's verify if we need to pass the link
                testo_finale = ai_data.get("testo_estratto")
                
                # Salviamo il testo grezzo estratto dall'IA in un file di testo (utile per PDF grafici o immagini)
                if testo_finale:
                    try:
                        import os
                        os.makedirs(os.path.join("data", "raw_texts"), exist_ok=True)
                        safe_title = "".join(c for c in (ev.get("titolo") or "evento_sconosciuto") if c.isalnum() or c in ('-', '_', '.')).rstrip()
                        file_path = os.path.join("data", "raw_texts", f"{safe_title[:50]}_ai_extracted.txt")
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(testo_finale)
                    except Exception as e:
                        pass

                dettagli = ai_data.get("dettagli_extra", {})
                if "_usage" in ai_data:
                    dettagli["_usage"] = ai_data["_usage"]
                    
                results.append({
                    "id": ev.get("id"), # Can be null if preview
                    "tmp_id": ev.get("tmp_id"), # Unique frontend identifier for previews
                    "titolo": ai_data.get("titolo"),
                    "categoria": ai_data.get("categoria"),
                    "testo_estratto": testo_finale,
                    "is_festival": ai_data.get("is_festival", False),
                    "sotto_eventi": ai_data.get("sotto_eventi", []),
                    "link_organizzatore": ai_data.get("link_organizzatore"),
                    "tags": ai_data.get("tags", []),
                    "dettagli_extra": dettagli,
                    "testo_grezzo_url": ai_data.get("testo_grezzo_url")
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
