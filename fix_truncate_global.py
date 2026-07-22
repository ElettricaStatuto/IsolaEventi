import os

path = r'C:/Users/chess/Desktop/IsolaEventi/scraper_runner.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    if preview_only:'''
replacement = '''    # Truncate giant descriptions for ALL modes to avoid memory/db crashes
    for obj in events_to_save:
        if obj["ev"].descrizione and len(obj["ev"].descrizione) > 30000:
            obj["ev"].descrizione = obj["ev"].descrizione[:30000] + "\\n\\n... [TESTO GREZZO TRONCATO]"

    if preview_only:'''

if target in content:
    content = content.replace(target, replacement)
    
    # Rimuovi la modifica precedente per non troncare due volte
    old_target = '''            # Truncate giant raw descriptions to avoid crashing Node.js/Browser with 50MB payloads
            safe_desc = ev.descrizione
            if safe_desc and len(safe_desc) > 30000:
                safe_desc = safe_desc[:30000] + "\\n\\n... [TESTO GREZZO TRONCATO: ECCESSIVAMENTE LUNGO]"

            events_preview.append({
                "titolo": ev.titolo,
                "data_inizio": obj["data_inizio"],
                "data_fine": obj["data_fine"],
                "luogo": ev.luogo,
                "latitudine": obj["lat"],
                "longitudine": obj["lon"],
                "link": ev.url,
                "descrizione": safe_desc,
                "immagine": ev.immagine,'''
                
    old_replacement = '''            events_preview.append({
                "titolo": ev.titolo,
                "data_inizio": obj["data_inizio"],
                "data_fine": obj["data_fine"],
                "luogo": ev.luogo,
                "latitudine": obj["lat"],
                "longitudine": obj["lon"],
                "link": ev.url,
                "descrizione": ev.descrizione,
                "immagine": ev.immagine,'''

    if old_target in content:
        content = content.replace(old_target, old_replacement)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed global truncation")
else:
    print("Target not found.")
