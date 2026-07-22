import os

path = r'C:/Users/chess/Desktop/IsolaEventi/scraper_runner.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            events_preview.append({
                "titolo": ev.titolo,
                "data_inizio": obj["data_inizio"],
                "data_fine": obj["data_fine"],
                "luogo": ev.luogo,
                "latitudine": obj["lat"],
                "longitudine": obj["lon"],
                "link": ev.url,
                "descrizione": ev.descrizione,
                "immagine": ev.immagine,'''

replacement = '''            # Truncate giant raw descriptions to avoid crashing Node.js/Browser with 50MB payloads
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

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed description length limit in scraper_runner.py")
else:
    print("Target not found.")
