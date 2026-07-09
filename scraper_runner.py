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
from scraper.sites.vistanet import VistanetScraper

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL not set")
    print(json.dumps({"nuovi": 0, "aggiornati": 0, "errori": 1}))
    sys.exit(1)

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
    dry_run = "--dry-run" in sys.argv
    preview_only = "--preview" in sys.argv
    nuovi = 0
    aggiornati = 0
    errori = 0

    # --- Scrape ---
    scrapers = [
        ParadisolaScraper(),
        SardegnaTurismoScraper(),
        VistanetScraper(),
    ]

    tutti_eventi = []
    for s in scrapers:
        try:
            eventi = s.scrapa_eventi()
            logger.info(f"{s.nome_fonte}: {len(eventi)} eventi")
            tutti_eventi.extend(eventi)
        except Exception as e:
            logger.error(f"Scraper {s.nome_fonte} failed: {e}")
            errori += 1

    conn = psycopg2.connect(DATABASE_URL)
    rejected_set = _load_rejected(conn)

    # Escludi eventi precedentemente rifiutati
    filtrati = [ev for ev in tutti_eventi if (ev.titolo, ev.fonte or "") not in rejected_set]
    scartati = len(tutti_eventi) - len(filtrati)
    if scartati:
        logger.info(f"Scartati {scartati} eventi precedentemente rifiutati")

    if preview_only:
        # Restituisce JSON con lista eventi trovati, senza toccare il DB
        events_preview = []
        for ev in filtrati:
            data_inizio = _parse_mixed_date(ev.data_inizio)
            data_fine = _parse_mixed_date(ev.data_fine) if ev.data_fine else data_inizio
            lat, lon = None, None
            if ev.luogo:
                coords = geocode(ev.luogo)
                if coords:
                    lat, lon = coords
            events_preview.append({
                "titolo": ev.titolo,
                "data_inizio": data_inizio,
                "data_fine": data_fine,
                "luogo": ev.luogo,
                "latitudine": lat,
                "longitudine": lon,
                "link": ev.url,
                "descrizione": ev.descrizione,
                "immagine": ev.immagine,
                "fonte": ev.fonte or "",
                "is_new": True,
            })
        conn.close()
        print(json.dumps({
            "success": True,
            "nuovi": len(events_preview),
            "aggiornati": 0,
            "errori": errori,
            "events": events_preview,
            "messaggio": f"Preview: {len(events_preview)} eventi trovati",
        }))
        return

    if dry_run:
        conn.close()
        print(json.dumps({
            "success": True,
            "nuovi": len(filtrati),
            "aggiornati": 0,
            "errori": errori,
            "messaggio": f"Dry-run: {len(filtrati)} eventi pronti per approvazione",
        }))
        return

    # --- Geocode, download images & upsert ---
    cur = conn.cursor()

    for ev in filtrati:
        data_inizio = _parse_mixed_date(ev.data_inizio)
        data_fine = _parse_mixed_date(ev.data_fine) if ev.data_fine else data_inizio

        lat, lon = None, None
        if ev.luogo:
            coords = geocode(ev.luogo)
            if coords:
                lat, lon = coords

        try:
            cur.execute(
                "SELECT id FROM events WHERE titolo = %s AND fonte = %s LIMIT 1",
                (ev.titolo, ev.fonte or ""),
            )
            row = cur.fetchone()

            if row:
                event_id = row[0]
                # Download immagine solo se esiste un'immagine nuova
                image_filename = None
                if ev.immagine:
                    image_filename = _download_image(ev.immagine, event_id)

                cur.execute(
                    """
                    UPDATE events
                    SET data_inizio=%s, data_fine=%s, luogo=%s,
                        latitudine=%s, longitudine=%s, link=%s,
                        descrizione=%s, immagine=%s, aggiornato_il=now()
                    WHERE id=%s
                    """,
                    (
                        data_inizio, data_fine, ev.luogo,
                        lat, lon, ev.url, ev.descrizione,
                        image_filename or ev.immagine,
                        event_id,
                    ),
                )
                aggiornati += 1
            else:
                cur.execute(
                    """
                    INSERT INTO events
                        (titolo, data_inizio, data_fine, luogo, latitudine, longitudine,
                         link, descrizione, immagine, fonte, aggiornato_il)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
                    RETURNING id
                    """,
                    (
                        ev.titolo, data_inizio, data_fine, ev.luogo,
                        lat, lon, ev.url, ev.descrizione, None, ev.fonte or "",
                    ),
                )
                event_id = cur.fetchone()[0]
                nuovi += 1

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
    logger.info(f"Done: {result}")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
