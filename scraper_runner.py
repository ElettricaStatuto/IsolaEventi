#!/usr/bin/env python3
"""
Runner script: scrapes events from all sources, geocodes them via Nominatim,
and upserts them into PostgreSQL.

Usage: python3 scraper_runner.py
Prints a JSON line: {"nuovi": N, "aggiornati": M, "errori": K}
"""
import json
import logging
import os
import sys
import time
from typing import Optional

import psycopg2
import psycopg2.extras
import requests

from scraper.sites.paradisola import ParadisolaScraper
from scraper.sites.sardegnaturismo import SardegnaTurismoScraper
from scraper.sites.castedduonline import CastedduOnlineScraper
from scraper.sites.vistanet import VistanetScraper
from scraper.sites.sardegnaeventi24 import SardegnaEventi24Scraper

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


def main():
    nuovi = 0
    aggiornati = 0
    errori = 0

    # --- Scrape ---
    scrapers = [
        ParadisolaScraper(),
        SardegnaTurismoScraper(),
        CastedduOnlineScraper(solo_eventi=True),
        VistanetScraper(),
        SardegnaEventi24Scraper(),
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

    # --- Geocode & upsert ---
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    for ev in tutti_eventi:
        lat, lon = None, None
        if ev.luogo:
            coords = geocode(ev.luogo)
            if coords:
                lat, lon = coords

        try:
            # Try to find existing by (titolo, fonte)
            cur.execute(
                "SELECT id FROM events WHERE titolo = %s AND fonte = %s LIMIT 1",
                (ev.titolo, ev.fonte or ""),
            )
            row = cur.fetchone()

            if row:
                cur.execute(
                    """
                    UPDATE events
                    SET data_inizio=%s, data_fine=%s, luogo=%s,
                        latitudine=%s, longitudine=%s, link=%s,
                        descrizione=%s, aggiornato_il=now()
                    WHERE id=%s
                    """,
                    (
                        ev.data_inizio, ev.data_fine, ev.luogo,
                        lat, lon, ev.url, ev.descrizione, row[0],
                    ),
                )
                aggiornati += 1
            else:
                cur.execute(
                    """
                    INSERT INTO events
                        (titolo, data_inizio, data_fine, luogo, latitudine, longitudine,
                         link, descrizione, fonte, aggiornato_il)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
                    """,
                    (
                        ev.titolo, ev.data_inizio, ev.data_fine, ev.luogo,
                        lat, lon, ev.url, ev.descrizione, ev.fonte or "",
                    ),
                )
                nuovi += 1
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
