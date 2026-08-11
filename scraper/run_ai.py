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
            mode = payload.get("mode", "analyze")
        else:
            events = payload
            target = "both"
            mode = "analyze"

        results = []
        total = len(events)
        
        for idx, ev in enumerate(events, 1):
            log_msg = f"[{idx}/{total}] Sto analizzando l'evento: '{ev.get('titolo')}' (Target: {target})"
            print(json.dumps({"log": log_msg}), flush=True)
            
            try:
                # Add link to context for source page extraction if target is source_page
                ai_data = analyze_event(ev, target=target, mode=mode)
                
                # Check if it returned a flat error dictionary from the analyzer
                if isinstance(ai_data, dict) and "testo_estratto" in ai_data and "dati_curati_ai" not in ai_data:
                    raise Exception(ai_data["testo_estratto"])
                
                if "_usage" in ai_data:
                    u = ai_data["_usage"]
                    usage_msg = f"⚡ Token Consumati: {u['total_tokens']} (Prompt: {u['prompt_tokens']}, Risposta: {u['candidates_tokens']})"
                    print(json.dumps({"log": usage_msg}), flush=True)
                    
                if mode == "extract":
                    extract_list = []
                    if isinstance(ai_data, list):
                        extract_list = ai_data
                    elif isinstance(ai_data, dict) and "sotto_eventi" in ai_data:
                        extract_list = ai_data.get("sotto_eventi", [])
                    else:
                        extract_list = [ai_data]
                        
                    for sub in extract_list:
                        sub["parent_id"] = ev.get("id")
                        sub["parent_tmp_id"] = ev.get("tmp_id")
                        sub["is_extracted"] = True
                        results.append(sub)
                    continue
                
                # Dallo schema unificato (schema_version 2.0), i dati curati e i loro
                # arricchimenti (dettagli_dominio, approfondimenti_extra) vivono ANNIDATI
                # dentro "dati_curati_ai" — vale sia per l'evento padre sia per ogni
                # sotto-evento in "lista_sotto_eventi_estratti".
                dati_curati = ai_data.get("dati_curati_ai", {})
                approfondimenti = dati_curati.get("approfondimenti_extra", {}) or {}
                testo_finale = dati_curati.get("testo_estratto")

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

                original_dettagli = ev.get("dettagli_extra", {})
                dettagli = {
                    **original_dettagli,
                    "schema_version": ai_data.get("schema_version"),
                    "diario_di_bordo_ai": ai_data.get("diario_di_bordo_ai", []),
                    "metadati_operazioni": ai_data.get("metadati_operazioni", {}),
                    "orari_dettagliati": approfondimenti.get("orari_dettagliati"),
                    "crediti_regia_autori": approfondimenti.get("crediti_regia_autori"),
                    "info_biglietti": approfondimenti.get("info_biglietti"),
                    "contatti_utili": approfondimenti.get("contatti_utili"),
                    "immagine_pulita_e_pubblicabile": approfondimenti.get("immagine_pulita_e_pubblicabile"),
                    "motivo_immagine_non_pulita": approfondimenti.get("motivo_immagine_non_pulita"),
                }

                # Salvataggio ora_inizio e ora_fine estratti dall'AI nei dettagli_extra
                if dati_curati.get("ora_inizio"):
                    dettagli["ora_inizio"] = dati_curati.get("ora_inizio")
                if dati_curati.get("ora_fine"):
                    dettagli["ora_fine"] = dati_curati.get("ora_fine")

                if "_usage" in ai_data:
                    dettagli["_usage"] = ai_data["_usage"]

                results.append({
                    "id": ev.get("id"),
                    "tmp_id": ev.get("tmp_id"),
                    "titolo": dati_curati.get("titolo"),
                    "categoria": dati_curati.get("categoria"),
                    "testo_estratto": testo_finale,
                    "data_inizio": dati_curati.get("data_inizio"),
                    "data_fine": dati_curati.get("data_fine"),
                    "luogo": dati_curati.get("luogo"),
                    "link_organizzatore": dati_curati.get("link_organizzatore"),
                    "link_biglietti": dati_curati.get("link_biglietti"),
                    "is_ingresso_gratuito": dati_curati.get("is_ingresso_gratuito", False),
                    "artisti": dati_curati.get("artisti", []),
                    "bio_artisti": approfondimenti.get("bio_artisti", []),
                    "social_contatti": approfondimenti.get("social_contatti", []),
                    "tags": dati_curati.get("tags", []),
                    "is_festival": ai_data.get("gestione_gerarchia", {}).get("is_festival_padre", False),
                    "is_evento": dati_curati.get("is_evento", True),
                    "dettagli_dominio": dati_curati.get("dettagli_dominio"),
                    "sotto_eventi": ai_data.get("lista_sotto_eventi_estratti", []),
                    "dettagli_extra": dettagli,
                    # Documento AI completo e non modificato (schema unificato v2.0),
                    # da registrare cosi' com'e' nella tabella ai_analysis.
                    "documento_ai": {k: v for k, v in ai_data.items() if k != "_usage"}
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
