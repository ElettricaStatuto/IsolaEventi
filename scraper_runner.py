#!/usr/bin/env python3
"""
Runner script: scrapes events from all sources, geocodes them via Nominatim,
downloads event images, and upserts them into PostgreSQL.

Usage: python3 scraper_runner.py
Prints a JSON line: {"nuovi": N, "aggiornati": M, "errori": K}
"""
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
import requests

from scraper.sites.paradisola import ParadisolaScraper
from scraper.sites.sardegnaturismo import SardegnaTurismoScraper
from scraper.sites.eventiinsardegna import EventiInSardegnaScraper
from scraper.sites.timeinjazz import TimeInJazzScraper
from scraper.sites.saludetrigu import SaludeTriguScraper
from scraper.ai_analyzer import analyze_event
from scraper.models import SottoEvento

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

def normalize_title(title: str) -> str:
    if not title:
        return ""
    import unicodedata
    title = title.lower()
    title = "".join(c for c in unicodedata.normalize('NFD', title) if unicodedata.category(c) != 'Mn')
    title = re.sub(r"[.,\/#!$%\^&\*;:{}=\-_`~()]", " ", title)
    words = title.split()
    stop_words = {"festa", "sagra", "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "dal", "dallo", "dalla", "dai", "dagli", "dalle", "nel", "nello", "nella", "nei", "negli", "nelle", "sul", "sullo", "sulla", "sui", "sugli", "sulle", "col", "coi"}
    filtered = [w for w in words if w not in stop_words]
    return " ".join(filtered)

def are_titles_similar(t1: str, t2: str) -> bool:
    n1 = normalize_title(t1)
    n2 = normalize_title(t2)
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True
    words1 = set(n1.split())
    words2 = set(n2.split())
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    if not union:
        return False
    jaccard = len(intersection) / len(union)
    return jaccard >= 0.70

DATABASE_URL = os.environ.get("DATABASE_URL")
def emit_log(msg: str):
    print(json.dumps({"log": msg}), flush=True)
    logger.info(msg)

# Nota: DATABASE_URL viene controllato in main() solo per le operazioni di scrittura nel DB.
# In modalità --preview non è necessario il DB.

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {"User-Agent": "SardegnaEventsMap/1.0 (info@sardegnamap.local)"}
_geocode_cache: dict[str, Optional[tuple[float, float]]] = {}

# Directory per le immagini scaricate
IMAGES_DIR = Path(os.environ.get("EVENT_IMAGES_DIR", "data/event-images"))
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Mappa mesi inglesi -> numerici per normalizzare date tipo "19 Jun 2025"
_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def _parse_mixed_date(raw: str | None) -> str | None:
    """Converte formati eterogenei in YYYY-MM-DD per PostgreSQL."""
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    if not raw:
        return None

    # Già formato ISO-ish (2025-06-19 o 2025/06/19)
    iso_match = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
    if iso_match:
        y, m, d = iso_match.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"

    # Formato "19 Jun 2025", "Wed, 24 Jun 2026 15:24:40 +0000",
    # o "Thu, 09 Jul 2026 13:55:43 +0000" (RFC 822 dates da RSS)
    eng_match = re.search(
        r"(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})", raw
    )
    if eng_match:
        d, mon, y = eng_match.groups()
        mon_key = mon[:3].lower()
        m = _MONTH_MAP.get(mon_key)
        if m:
            return f"{y}-{m}-{int(d):02d}"

    # Tenta dateutil-like fallback con strptime comuni
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    logger.warning(f"Impossibile parsare data: '{raw}'")
    return None


def geocode(luogo: str) -> Optional[tuple[float, float]]:
    """Returns (lat, lon) for a Sardinian location name, or None."""
    if luogo in _geocode_cache:
        return _geocode_cache[luogo]

    query = f"{luogo}, Sardegna, Italia"
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "it"},
            headers=NOMINATIM_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])
            result = (lat, lon)
            _geocode_cache[luogo] = result
            time.sleep(1.1)  # Nominatim rate limit: 1 req/sec
            return result
    except Exception as e:
        logger.warning(f"Geocoding failed for '{luogo}': {e}")

    _geocode_cache[luogo] = None
    return None


def _load_rejected(conn) -> set[tuple[str, str]]:
    """Carica i titoli+fonte degli eventi rifiutati dal DB."""
    cur = conn.cursor()
    cur.execute("SELECT titolo, fonte FROM rejected_events")
    rows = cur.fetchall()
    cur.close()
    return {(r[0], r[1]) for r in rows}


def _upsert_festival_parent(festival_name: str, fonte: str, eventi: list) -> int:
    """Crea (o aggiorna) l'evento padre di un festival nel DB.
    Calcola data_inizio e data_fine come min/max dei figli.
    Restituisce l'ID dell'evento padre.
    """
    # Calcola date min/max dai figli
    date_figli = []
    for ev in eventi:
        d = _parse_mixed_date(ev.data_inizio)
        if d:
            date_figli.append(d)
    
    data_inizio = min(date_figli) if date_figli else None
    data_fine = max(date_figli) if date_figli else None
    
    # Prova a trovare il luogo più comune tra i figli (primo disponibile)
    luogo = next((ev.luogo for ev in eventi if ev.luogo), None)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Cerca se esiste già un evento padre con questo titolo e fonte
    cur.execute(
        "SELECT id FROM events WHERE titolo = %s AND fonte = %s AND parent_id IS NULL LIMIT 1",
        (festival_name, fonte)
    )
    row = cur.fetchone()
    
    if row:
        parent_id = row[0]
        # Aggiorna le date del padre
        cur.execute(
            """UPDATE events
               SET data_inizio = %s, data_fine = %s, aggiornato_il = now()
               WHERE id = %s""",
            (data_inizio, data_fine, parent_id)
        )
        logger.info(f"Festival padre aggiornato: '{festival_name}' (id={parent_id})")
    else:
        cur.execute(
            """INSERT INTO events
               (titolo, data_inizio, data_fine, luogo, fonte, aggiornato_il)
               VALUES (%s, %s, %s, %s, %s, now())
               RETURNING id""",
            (festival_name, data_inizio, data_fine, luogo, fonte)
        )
        parent_id = cur.fetchone()[0]
        logger.info(f"Festival padre creato: '{festival_name}' (id={parent_id})")
    
    conn.commit()
    cur.close()
    conn.close()
    return parent_id



def _download_image(url: str, event_id: int) -> Optional[str]:
    """Scarica un'immagine da URL e la salva come evento_{id}.{ext}.
    Restituisce il nome file relativo (es. 'evento_42.jpg')."""
    if not url:
        return None
    try:
        parsed = urlparse(url)
        # Estrai estensione dal path
        ext = Path(parsed.path).suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            ext = ".jpg"
        filename = f"evento_{event_id}{ext}"
        filepath = IMAGES_DIR / filename

        # Non riscaricare se già esiste
        if filepath.exists():
            return filename

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        }
        resp = requests.get(url, headers=headers, timeout=15, stream=True)
        resp.raise_for_status()

        # Verifica content-type
        content_type = resp.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            logger.warning(f"URL non è un'immagine: {url} ({content_type})")
            return None

        with open(filepath, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info(f"Immagine scaricata: {filename} ({url})")
        return filename
    except Exception as e:
        logger.warning(f"Download immagine fallito per {url}: {e}")
        return None


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sources", type=str, default="")
    parser.add_argument("--url", type=str, default="")
    parser.add_argument("--pdf", type=str, default="")
    parser.add_argument("--max-links", type=int, default=70)
    parser.add_argument("--force-festival", action="store_true")
    args, unknown = parser.parse_known_args()

    dry_run = args.dry_run
    preview_only = args.preview
    nuovi = 0
    aggiornati = 0
    errori = 0

    enabled_sources = set(args.sources.split(",")) if args.sources else None

    # --- Scrape ---
    scrapers = []
    
    if args.url:
        try:
            from scraper.sites.structured_crawler_adapter import StructuredCrawlerScraper
            scrapers.append(StructuredCrawlerScraper(args.url, max_links=args.max_links))
        except Exception as e:
            emit_log(f"Avviso: errore nell'inizializzazione del crawler strutturato ({e}), uso GenericUrlScraper...")
            from scraper.sites.generic import GenericUrlScraper
            scrapers.append(GenericUrlScraper(args.url, max_links=args.max_links))
    elif args.pdf:
        from scraper.sites.pdf_scraper import PdfScraper
        scrapers.append(PdfScraper(args.pdf))
    else:
        if not enabled_sources or "paradisola" in enabled_sources:
            scrapers.append(ParadisolaScraper())
            
        if not enabled_sources or "sardegnaturismo" in enabled_sources:
            scrapers.append(SardegnaTurismoScraper())

        if not enabled_sources or "timeinjazz" in enabled_sources:
            scrapers.append(TimeInJazzScraper())

        if not enabled_sources or "saludetrigu" in enabled_sources:
            scrapers.append(SaludeTriguScraper())

        # Configurazione target per eventiinsardegna.it
        eventiinsardegna_targets = []
        if not enabled_sources or "eventiinsardegna_calendar" in enabled_sources:
            eventiinsardegna_targets.append(("https://www.eventiinsardegna.it/eventi/", "events_calendar"))
        if not enabled_sources or "eventiinsardegna_alghero" in enabled_sources:
            eventiinsardegna_targets.append(("https://www.eventiinsardegna.it/tag/alghero/", "wordpress_tag"))
        if not enabled_sources or "eventiinsardegna_cagliari" in enabled_sources:
            eventiinsardegna_targets.append(("https://www.eventiinsardegna.it/tag/cagliari/", "wordpress_tag"))
        if not enabled_sources or "eventiinsardegna_centro" in enabled_sources:
            eventiinsardegna_targets.append(("https://www.eventiinsardegna.it/tag/eventi-centro-sardegna/", "wordpress_tag"))
        if not enabled_sources or "eventiinsardegna_agosto" in enabled_sources:
            eventiinsardegna_targets.append(("https://www.eventiinsardegna.it/agosto/", "wordpress_tag"))

        if eventiinsardegna_targets:
            scraper = EventiInSardegnaScraper()
            scraper.targets = eventiinsardegna_targets
            scrapers.append(scraper)

    tutti_eventi = []
    # Mappa scraper → parent_id festival (per i festival scrapers)
    festival_parent_ids: dict[str, int] = {}

    for s in scrapers:
        try:
            emit_log(f"Inizio scraping da: {s.nome_fonte}...")
            eventi = s.scrapa_eventi()
            emit_log(f"Completato {s.nome_fonte}: trovati {len(eventi)} articoli.")
            if len(eventi) == 0:
                # Zero risultati e' spesso sintomo di un problema temporaneo (rete,
                # blocco anti-bot, sito momentaneamente irraggiungibile) piuttosto
                # che di "nessun evento in programma": lo segnaliamo esplicitamente
                # cosi' non si confonde con un esito normale.
                emit_log(f"⚠️ {s.nome_fonte} non ha restituito alcun evento: potrebbe essere un problema temporaneo del sito, riprova tra qualche minuto.")

            # Se lo scraper è un festival, crea/aggiorna il padre e segna tutti i figli
            if getattr(s, 'festival_name', None):
                parent_id = _upsert_festival_parent(s.festival_name, s.nome_fonte, eventi)
                festival_parent_ids[s.nome_fonte] = parent_id
                emit_log(f"Festival padre '{s.festival_name}' (id={parent_id}): {len(eventi)} concerti come figli.")
                for ev in eventi:
                    ev.parent_id = parent_id

            tutti_eventi.extend(eventi)
        except Exception as e:
            emit_log(f"Errore scraping {s.nome_fonte}: {e}")
            logger.error(f"Scraper {s.nome_fonte} failed: {e}")
            errori += 1

    conn = None
    rejected_set = set()
    existing_events = []

    if DATABASE_URL:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            rejected_set = _load_rejected(conn)
            cur = conn.cursor()
            cur.execute("SELECT id, titolo FROM events")
            existing_events = list(cur.fetchall())
        except Exception as db_err:
            emit_log(f"Avviso: Connessione DB non disponibile ({db_err}), proseguo in modalità preview...")

    if args.url:
        filtrati = tutti_eventi
        if any((ev.titolo, ev.fonte or "") in rejected_set for ev in tutti_eventi):
            emit_log("Nota: Alcuni eventi estratti erano nella blacklist, ma essendo un'estrazione manuale sono stati mantenuti.")
    else:
        filtrati = [ev for ev in tutti_eventi if (ev.titolo, ev.fonte or "") not in rejected_set]
        scartati = len(tutti_eventi) - len(filtrati)
        if scartati:
            emit_log(f"Scartati in automatico {scartati} eventi presenti nella blacklist.")

    # Process events and analyze via AI if new
    events_to_save = []

    # Date parsing and filtering
    oggi_str = datetime.now().strftime("%Y-%m-%d")

    scaduti = 0
    for ev in filtrati:
        data_inizio = _parse_mixed_date(ev.data_inizio)
        data_fine = _parse_mixed_date(ev.data_fine) if ev.data_fine else data_inizio
        # Non raccogliere eventi gia' terminati: per un festival (con data_fine)
        # conta l'ultimo giorno, non il primo, cosi' un evento in corso non
        # sparisce a meta'.
        if (data_fine or data_inizio) and (data_fine or data_inizio) < oggi_str:
            scaduti += 1
            continue

        found_id = None
        for db_id, db_title in existing_events:
            if are_titles_similar(ev.titolo, db_title):
                found_id = db_id
                break
        
        is_new = found_id is None
        
        if is_new:
            # L'analisi AI è stata disabilitata in fase di scraping per permettere
            # l'esecuzione manuale su richiesta dell'utente tramite interfaccia.
            pass

        lat, lon = getattr(ev, 'latitudine', None), getattr(ev, 'longitudine', None)
        if (lat is None or lon is None) and ev.luogo:
            coords = geocode(ev.luogo)
            if coords:
                lat, lon = coords
                
        events_to_save.append({
            "ev": ev,
            "data_inizio": data_inizio,
            "data_fine": data_fine,
            "lat": lat,
            "lon": lon,
            "is_new": is_new,
            "row_id": found_id
        })

    if scaduti:
        emit_log(f"Scartati in automatico {scaduti} eventi con data gia' passata.")

    if 'cur' in locals() and cur:
        try:
            cur.close()
        except:
            pass


    # Truncate giant descriptions for ALL modes to avoid memory/db crashes
    for obj in events_to_save:
        if obj["ev"].descrizione and len(obj["ev"].descrizione) > 30000:
            obj["ev"].descrizione = obj["ev"].descrizione[:30000] + "\n\n... [TESTO GREZZO TRONCATO]"

    if preview_only:
        # Restituisce JSON con lista eventi trovati, senza toccare il DB
        events_preview = []
        for obj in events_to_save:
            ev = obj["ev"]
            
            # Se è uno scraping URL libero o se l'utente ha attivato lo switch Crawler AI,
            # esegui l'analisi AI completa dell'evento - leggendo la pagina fonte originale
            # (non solo il breve testo già scrapato) cosi' da ottenere un articolo vero e,
            # se l'AI riconosce un festival/programma multi-data, anche i sotto-eventi.
            if args.url or args.force_festival:
                emit_log(f"🤖 Esecuzione Crawler AI Gemini sull'evento '{ev.titolo}'...")
                ha_link = bool(ev.url and ev.url.startswith("http"))
                ai_ev_dict = {**ev.to_dict(), "link": ev.url}
                if ha_link and ev.immagine:
                    target = "both_source"  # locandina + pagina fonte riletta in diretta
                elif ha_link:
                    target = "source_page"
                else:
                    target = "text"  # nessun link valido: usa il testo gia' scrapato
                ai_result = analyze_event(ai_ev_dict, target=target, mode="analyze", force_festival=args.force_festival)

                # Lo standard analyzer restituisce il documento JSON unificato (schema_version 2.0):
                # "dati_curati_ai" per l'evento padre, "lista_sotto_eventi_estratti" per i figli
                # (compilata dall'AI stessa se riconosce piu' date/serate nel testo).
                extracted_list = []
                dati_curati = {}
                if isinstance(ai_data := ai_result, dict):
                    extracted_list = ai_data.get("lista_sotto_eventi_estratti", [])
                    dati_curati = ai_data.get("dati_curati_ai", {}) or {}
                elif isinstance(ai_data, list):
                    extracted_list = ai_data

                ev.is_festival = len(extracted_list) > 0 or args.force_festival

                # Applichiamo all'evento padre TUTTO quello che l'AI ha generato in
                # dati_curati_ai — non solo titolo/testo/date come in precedenza.
                if dati_curati.get("titolo"):
                    ev.titolo = dati_curati.get("titolo")
                if dati_curati.get("testo_estratto"):
                    ev.testo_estratto = dati_curati.get("testo_estratto")
                if dati_curati.get("data_inizio"):
                    ev.data_inizio = _parse_mixed_date(dati_curati.get("data_inizio"))
                if dati_curati.get("data_fine"):
                    ev.data_fine = _parse_mixed_date(dati_curati.get("data_fine"))
                if dati_curati.get("luogo"):
                    ev.luogo = dati_curati.get("luogo")
                if dati_curati.get("categoria"):
                    ev.categoria = dati_curati.get("categoria")
                ev.ora_inizio = dati_curati.get("ora_inizio") or ev.ora_inizio
                ev.ora_fine = dati_curati.get("ora_fine") or ev.ora_fine
                ev.link_organizzatore = dati_curati.get("link_organizzatore") or ev.link_organizzatore
                ev.link_biglietti = dati_curati.get("link_biglietti") or ev.link_biglietti
                ev.is_ingresso_gratuito = dati_curati.get("is_ingresso_gratuito", ev.is_ingresso_gratuito)
                ev.artisti = dati_curati.get("artisti") or ev.artisti
                ev.tags = dati_curati.get("tags") or ev.tags
                ev.is_evento = dati_curati.get("is_evento", True)
                ev.dettagli_dominio = dati_curati.get("dettagli_dominio")
                approfondimenti_padre = dati_curati.get("approfondimenti_extra", {}) or {}
                ev.bio_artisti = approfondimenti_padre.get("bio_artisti") or ev.bio_artisti
                ev.social_contatti = approfondimenti_padre.get("social_contatti") or ev.social_contatti

                # Documento AI completo e non modificato (schema unificato v2.0),
                # da registrare cosi' com'e' nella tabella ai_analysis.
                ev.documento_ai = {k: v for k, v in ai_data.items() if k != "_usage"} if isinstance(ai_data, dict) else None

                sotto_eventi_objs = []
                for se in extracted_list:
                    if se.get("is_evento") is False:
                        continue
                    # Map the unified evento-figlio JSON back to SottoEvento, campo per campo
                    approfondimenti_figlio = se.get("approfondimenti_extra", {}) or {}
                    se_obj = SottoEvento(
                        titolo=se.get("titolo", "Evento Senza Titolo"),
                        data_inizio=se.get("data_inizio", ""),
                        data_fine=se.get("data_fine", ""),
                        date_testuali=se.get("data_inizio", ""),
                        luogo=se.get("luogo", ""),
                        url=se.get("link_organizzatore") or se.get("link_biglietti") or "",
                        descrizione=se.get("testo_estratto", ""),
                        ora_inizio=se.get("ora_inizio"),
                        ora_fine=se.get("ora_fine"),
                        artisti=se.get("artisti", []),
                        tags=se.get("tags", []),
                        is_ingresso_gratuito=se.get("is_ingresso_gratuito", False),
                        categoria=se.get("categoria"),
                        is_evento=se.get("is_evento", True),
                        link_organizzatore=se.get("link_organizzatore"),
                        link_biglietti=se.get("link_biglietti"),
                        dettagli_dominio=se.get("dettagli_dominio"),
                        bio_artisti=approfondimenti_figlio.get("bio_artisti", []),
                        social_contatti=approfondimenti_figlio.get("social_contatti", []),
                    )
                    sotto_eventi_objs.append(se_obj)

                ev.sotto_eventi = sotto_eventi_objs
                emit_log(f"L'AI Extractor ha trovato {len(ev.sotto_eventi)} sotto-eventi grezzi.")

            # Genera un ID temporaneo per mantenere i legami
            import uuid
            temp_id = f"temp_{uuid.uuid4().hex[:8]}"

            parent_dict = {
                "titolo": ev.titolo,
                "titolo_originale": getattr(ev, 'titolo_originale', ev.titolo),
                "categoria": ev.categoria or None,
                "data_inizio": obj["data_inizio"],
                "data_fine": obj["data_fine"],
                "date_originali": ev.date_testuali,
                "ora_inizio": getattr(ev, 'ora_inizio', None),
                "ora_fine": getattr(ev, 'ora_fine', None),
                "luogo": ev.luogo,
                "luogo_originale": ev.luogo,
                "latitudine": obj["lat"],
                "longitudine": obj["lon"],
                "link": ev.url,
                "link_organizzatore": getattr(ev, 'link_organizzatore', None),
                "link_biglietti": getattr(ev, 'link_biglietti', None),
                "descrizione": ev.descrizione,
                "immagine": ev.immagine,
                "fonte": ev.fonte or "",
                "is_new": obj["is_new"],
                "testo_estratto": ev.testo_estratto,
                "is_festival": ev.is_festival,
                "is_ingresso_gratuito": getattr(ev, 'is_ingresso_gratuito', False),
                "parent_id": getattr(ev, 'parent_id', None),
                "tags": getattr(ev, 'tags', []),
                "artisti": getattr(ev, 'artisti', []),
                "bio_artisti": getattr(ev, 'bio_artisti', []),
                "social_contatti": getattr(ev, 'social_contatti', []),
                "is_evento": getattr(ev, 'is_evento', True),
                "dettagli_dominio": getattr(ev, 'dettagli_dominio', None),
                "documento_ai": getattr(ev, 'documento_ai', None),
                "dettagli_extra": {
                    **getattr(ev, 'dettagli_extra', {}),
                    "id_key": temp_id,
                    "parent_temp_id": None,
                    "metodo_estrazione": f"Estrattore URL (sito: {args.url})" if args.url else (f"Estrattore PDF" if getattr(args, 'pdf', None) else "Scraper Automatico")
                }
            }
            events_preview.append(parent_dict)

            if ev.sotto_eventi:
                for se in ev.sotto_eventi:
                    child_dict = {
                        "titolo": se.titolo,
                        "titolo_originale": se.titolo,
                        "categoria": getattr(se, 'categoria', None) or ev.categoria or None,
                        "data_inizio": _parse_mixed_date(se.data_inizio),
                        "data_fine": _parse_mixed_date(se.data_fine) if se.data_fine else _parse_mixed_date(se.data_inizio),
                        "date_originali": se.date_testuali,
                        "ora_inizio": getattr(se, 'ora_inizio', None),
                        "ora_fine": getattr(se, 'ora_fine', None),
                        "luogo": se.luogo or ev.luogo,
                        "luogo_originale": se.luogo or ev.luogo,
                        "latitudine": getattr(se, 'latitudine', None) if getattr(se, 'latitudine', None) is not None else obj["lat"],
                        "longitudine": getattr(se, 'longitudine', None) if getattr(se, 'longitudine', None) is not None else obj["lon"],
                        "link": getattr(se, 'url', None) or ev.url,
                        "link_organizzatore": getattr(se, 'link_organizzatore', None) or getattr(ev, 'link_organizzatore', None),
                        "link_biglietti": getattr(se, 'link_biglietti', None) or getattr(ev, 'link_biglietti', None),
                        "descrizione": se.descrizione,
                        "immagine": getattr(se, 'immagine', None) or ev.immagine,
                        "fonte": ev.fonte or "",
                        "is_new": obj["is_new"],
                        "testo_estratto": se.descrizione,
                        "is_festival": False,
                        "is_ingresso_gratuito": getattr(se, 'is_ingresso_gratuito', getattr(ev, 'is_ingresso_gratuito', False)),
                        "parent_id": None,
                        "tags": getattr(se, 'tags', []),
                        "artisti": getattr(se, 'artisti', []),
                        "bio_artisti": getattr(se, 'bio_artisti', []),
                        "social_contatti": getattr(se, 'social_contatti', []),
                        "is_evento": getattr(se, 'is_evento', True),
                        "dettagli_dominio": getattr(se, 'dettagli_dominio', None),
                        "dettagli_extra": {
                            "festival_padre": ev.titolo,
                            "is_extracted": True,
                            "id_key": f"temp_{uuid.uuid4().hex[:8]}",
                            "parent_temp_id": temp_id,
                            "metodo_estrazione": f"Estrattore URL (sito: {args.url})" if args.url else (f"Estrattore PDF" if getattr(args, 'pdf', None) else "Scraper Automatico")
                        }
                    }
                    events_preview.append(child_dict)
        if conn:
            conn.close()
        result = {
            "success": True,
            "nuovi": len(events_preview),
            "aggiornati": 0,
            "errori": errori,
            "events": events_preview,
            "messaggio": f"Preview completata: {len(events_preview)} eventi da visionare",
        }
        emit_log(result["messaggio"])
        print(json.dumps(result), flush=True)
        return

    if dry_run:
        if conn:
            conn.close()
        result = {
            "success": True,
            "nuovi": len([e for e in events_to_save if e["is_new"]]),
            "aggiornati": len([e for e in events_to_save if not e["is_new"]]),
            "errori": errori,
            "messaggio": f"Dry-run: {len(events_to_save)} eventi pronti per approvazione",
        }
        emit_log(result["messaggio"])
        print(json.dumps(result), flush=True)
        return

    # --- Geocode, download images & upsert ---
    cur = conn.cursor()

    for obj in events_to_save:
        ev = obj["ev"]
        data_inizio = obj["data_inizio"]
        data_fine = obj["data_fine"]
        lat = obj["lat"]
        lon = obj["lon"]
        is_new = obj["is_new"]
        event_id = obj["row_id"]

        try:
            if not is_new:
                # Download immagine solo se esiste un'immagine nuova
                image_filename = None
                if ev.immagine:
                    image_filename = _download_image(ev.immagine, event_id)

                cur.execute(
                    """
                    UPDATE events
                    SET data_inizio=%s, data_fine=%s, date_originali=%s, luogo=%s, luogo_originale=%s,
                        latitudine=%s, longitudine=%s, link=%s,
                        descrizione=%s, immagine=%s, testo_estratto=%s, tags=%s, dettagli_extra=%s, aggiornato_il=now()
                    WHERE id=%s
                    """,
                    (
                        data_inizio, data_fine, ev.date_testuali, ev.luogo, ev.luogo,
                        lat, lon, ev.url, ev.descrizione,
                        image_filename or ev.immagine,
                        ev.testo_estratto,
                        json.dumps(getattr(ev, 'tags', [])) if getattr(ev, 'tags', []) else None,
                        json.dumps(getattr(ev, 'dettagli_extra', {})) if getattr(ev, 'dettagli_extra', {}) else None,
                        event_id,
                    ),
                )
                aggiornati += 1
            else:
                cur.execute(
                    """
                    INSERT INTO events
                        (titolo, data_inizio, data_fine, date_originali, luogo, luogo_originale, latitudine, longitudine,
                         link, descrizione, immagine, fonte, testo_estratto, tags, dettagli_extra, parent_id, aggiornato_il)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
                    RETURNING id
                    """,
                    (
                        ev.titolo, data_inizio, data_fine, ev.date_testuali, ev.luogo, ev.luogo,
                        lat, lon, ev.url, ev.descrizione, None, ev.fonte or "",
                        ev.testo_estratto,
                        json.dumps(getattr(ev, 'tags', [])) if getattr(ev, 'tags', []) else None,
                        json.dumps(getattr(ev, 'dettagli_extra', {})) if getattr(ev, 'dettagli_extra', {}) else None,
                        getattr(ev, 'parent_id', None),
                    ),
                )
                event_id = cur.fetchone()[0]
                existing_events.append((event_id, ev.titolo))
                nuovi += 1
                
                # Se è un festival, salva i sotto-eventi
                if ev.is_festival and ev.sotto_eventi:
                    for se in ev.sotto_eventi:
                        se_inizio = _parse_mixed_date(se.data_inizio)
                        se_fine = _parse_mixed_date(se.data_fine) if se.data_fine else se_inizio
                        cur.execute(
                            """
                            INSERT INTO events
                                (titolo, data_inizio, data_fine, date_originali, luogo, luogo_originale, parent_id, fonte, link, descrizione, aggiornato_il)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
                            """,
                            (
                                f"{ev.titolo} - {se.titolo}", se_inizio, se_fine,
                                se.date_testuali, se.luogo or ev.luogo, se.luogo or ev.luogo, event_id, ev.fonte or "", getattr(se, 'url', None), getattr(se, 'descrizione', None)
                            )
                        )

                # Download immagine con l'ID appena creato
                image_filename = None
                if ev.immagine:
                    image_filename = _download_image(ev.immagine, event_id)
                    if image_filename:
                        cur.execute(
                            "UPDATE events SET immagine = %s WHERE id = %s",
                            (image_filename, event_id),
                        )
        except Exception as e:
            logger.error(f"DB error for event '{ev.titolo}': {e}")
            conn.rollback()
            errori += 1
            continue

    conn.commit()
    cur.close()
    conn.close()

    result = {"nuovi": nuovi, "aggiornati": aggiornati, "errori": errori}
    emit_log(f"Salvataggio terminato. Nuovi: {nuovi}, Aggiornati: {aggiornati}, Errori: {errori}")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
