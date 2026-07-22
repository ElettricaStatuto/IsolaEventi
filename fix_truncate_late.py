import os

path = r'C:/Users/chess/Desktop/IsolaEventi/scraper_runner.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    # Truncate giant descriptions for ALL modes to avoid memory/db crashes
    for obj in events_to_save:
        if obj["ev"].descrizione and len(obj["ev"].descrizione) > 30000:
            obj["ev"].descrizione = obj["ev"].descrizione[:30000] + "\\n\\n... [TESTO GREZZO TRONCATO]"

    if preview_only:'''

replacement = '''    if preview_only:'''

if target in content:
    content = content.replace(target, replacement)
    
    target2 = '''        conn.close()
        result = {'''
        
    replacement2 = '''        conn.close()
        
        # Truncate giant descriptions before JSON serialization
        for prev in events_preview:
            if prev["descrizione"] and len(prev["descrizione"]) > 30000:
                prev["descrizione"] = prev["descrizione"][:30000] + "\\n\\n... [TESTO GREZZO TRONCATO]"
                
        result = {'''
        
    if target2 in content:
        content = content.replace(target2, replacement2)
        
        target3 = '''        conn.commit()
        emit_log("Salvataggio completato")

    result = {'''
        
        replacement3 = '''        conn.commit()
        emit_log("Salvataggio completato")
        
    # Truncate giant descriptions for standard mode return JSON too
    for obj in events_to_save:
        if obj["ev"].descrizione and len(obj["ev"].descrizione) > 30000:
            obj["ev"].descrizione = obj["ev"].descrizione[:30000] + "\\n\\n... [TESTO GREZZO TRONCATO]"

    result = {'''
        
        if target3 in content:
            content = content.replace(target3, replacement3)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("Fixed truncation to happen AFTER AI analysis.")
        else:
            print("Target 3 not found.")
    else:
        print("Target 2 not found.")
else:
    print("Target 1 not found.")
