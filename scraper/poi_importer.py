#!/usr/bin/env python3
"""
Importa punti di interesse (nuraghi, chiese, grotte, musei, cantine, ecc.)
da OpenStreetMap tramite Overpass API, per una provincia sarda alla volta,
e li inserisce nella tabella punti_interesse_pending per la revisione
manuale - nessun punto arriva mai direttamente ai visitatori senza essere
controllato, stesso principio usato per gli eventi scrapati.

Le categorie piu' soggette a rumore (nuraghi, domus de janas, siti
archeologici generici: la Sardegna ne ha migliaia, la maggior parte non
visitabile o non significativa) vengono scartate se non hanno un tag
wikipedia/wikidata su OpenStreetMap - un segnale ragionevole che il posto
sia effettivamente notevole, non solo mappato.

Usage:
    python3 scraper/poi_importer.py --provincia Sassari --bbox 40.3,8.1,41.3,9.3

Il bbox e' sud,ovest,nord,est in gradi decimali.
"""
import argparse
import json
import logging
import os
import sys
import time
from typing import Optional

import psycopg2
import psycopg2.extras
import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "SardegnaEventsMap/1.0 (info@sardegnamap.local)"

DATABASE_URL = os.environ.get("DATABASE_URL")

# Categorie per cui, in assenza di wikipedia/wikidata, il punto viene
# scartato invece di finire comunque in revisione: sono quelle con troppo
# rumore su OSM per la Sardegna (migliaia di siti minori/non significativi).
CATEGORIE_CHE_RICHIEDONO_NOTORIETA = {"Nuraghe", "Domus de Janas", "Sito archeologico", "Chiesa storica"}


def costruisci_query_overpass(bbox: str) -> str:
    return f"""
    [out:json][timeout:120];
    (
      nwr["historic"="archaeological_site"]({bbox});
      nwr["historic"="tower"]({bbox});
      nwr["amenity"="place_of_worship"]["religion"="christian"]({bbox});
      nwr["natural"="cave_entrance"]({bbox});
      nwr["tourism"="viewpoint"]({bbox});
      nwr["tourism"="museum"]({bbox});
      nwr["man_made"="lighthouse"]({bbox});
      nwr["craft"="winery"]({bbox});
      nwr["shop"="wine"]({bbox});
      nwr["leisure"="nature_reserve"]({bbox});
      nwr["boundary"="national_park"]({bbox});
    );
    out center tags;
    """


def categoria_da_tags(tags: dict) -> Optional[str]:
    historic = tags.get("historic")
    site_type = (tags.get("site_type") or "").lower()
    name_lower = (tags.get("name") or "").lower()

    if historic == "archaeological_site":
        if "nuraghe" in name_lower or "nuraghe" in site_type or "fortification" in site_type:
            return "Nuraghe"
        if "domus" in name_lower or "tomb" in site_type or "megalith" in site_type:
            return "Domus de Janas"
        return "Sito archeologico"
    if historic == "tower":
        return "Torre costiera"
    if tags.get("amenity") == "place_of_worship" and tags.get("religion") == "christian":
        return "Chiesa storica"
    if tags.get("natural") == "cave_entrance":
        return "Grotta"
    if tags.get("tourism") == "viewpoint":
        return "Punto panoramico"
    if tags.get("tourism") == "museum":
        return "Museo"
    if tags.get("man_made") == "lighthouse":
        return "Faro"
    if tags.get("craft") == "winery" or tags.get("shop") == "wine":
        return "Cantina"
    if tags.get("leisure") == "nature_reserve" or tags.get("boundary") == "national_park":
        return "Area naturale"
    return None


def estrai_coordinate(elemento: dict) -> Optional[tuple]:
    if "lat" in elemento and "lon" in elemento:
        return elemento["lat"], elemento["lon"]
    center = elemento.get("center")
    if center:
        return center.get("lat"), center.get("lon")
    return None


def pulisci_nome_comune(nome: Optional[str]) -> Optional[str]:
    """In Sardegna molti comuni sono taggati su OSM come 'Nome sardo/Nome
    italiano' (es. "l'Alguer/Alghero"). Per un turista e' piu' chiaro il
    nome italiano, quindi teniamo solo la parte dopo la barra se presente."""
    if not nome:
        return nome
    return nome.split("/")[-1].strip() if "/" in nome else nome.strip()


def comune_da_tags_o_nominatim(tags: dict, lat: float, lon: float) -> Optional[str]:
    for chiave in ("addr:city", "addr:town", "addr:village"):
        if tags.get(chiave):
            return pulisci_nome_comune(tags[chiave])

    try:
        time.sleep(1.1)  # Nominatim rate limit: 1 req/sec
        resp = requests.get(
            NOMINATIM_REVERSE_URL,
            params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 10},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if resp.ok:
            address = resp.json().get("address", {})
            nome = address.get("city") or address.get("town") or address.get("village") or address.get("hamlet")
            return pulisci_nome_comune(nome)
    except requests.RequestException as e:
        logger.warning(f"Reverse geocoding fallito per {lat},{lon}: {e}")
    return None


def importa(provincia: str, bbox: str, dry_run: bool = False) -> None:
    logger.info(f"Interrogo Overpass per la provincia di {provincia} (bbox {bbox})...")
    query = costruisci_query_overpass(bbox)
    resp = requests.post(OVERPASS_URL, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=150)
    resp.raise_for_status()
    elementi = resp.json().get("elements", [])
    logger.info(f"Overpass ha restituito {len(elementi)} elementi grezzi.")

    candidati = []
    for el in elementi:
        tags = el.get("tags", {})
        nome = tags.get("name")
        if not nome:
            continue  # niente nome, niente presentabile agli utenti

        categoria = categoria_da_tags(tags)
        if not categoria:
            continue

        notevole = bool(tags.get("wikipedia") or tags.get("wikidata"))
        if categoria in CATEGORIE_CHE_RICHIEDONO_NOTORIETA and not notevole:
            continue

        coords = estrai_coordinate(el)
        if not coords or coords[0] is None or coords[1] is None:
            continue

        fonte_osm = f"{el['type']}/{el['id']}"
        candidati.append({
            "nome": nome,
            "categoria": categoria,
            "lat": coords[0],
            "lon": coords[1],
            "fonte_osm": fonte_osm,
            "tags": tags,
            "link_esterno": (
                f"https://it.wikipedia.org/wiki/{tags['wikipedia'].split(':', 1)[-1]}"
                if tags.get("wikipedia") else None
            ),
        })

    logger.info(f"{len(candidati)} candidati dopo il filtro per nome/categoria/notorieta'.")

    if dry_run:
        for c in candidati:
            print(f"  [{c['categoria']}] {c['nome']} ({c['lat']:.4f}, {c['lon']:.4f})")
        logger.info("Dry run: nessuna scrittura sul database.")
        return

    if not DATABASE_URL:
        logger.error("DATABASE_URL non impostata, impossibile scrivere sul database.")
        sys.exit(1)

    # Fase 1: risolvi il comune per ogni candidato PRIMA di aprire la
    # connessione al database. Il reverse geocoding e' rate-limited (circa
    # un secondo a richiesta, quindi diversi minuti in totale) - tenere una
    # connessione Postgres aperta e per lo piu' inattiva per tutto quel
    # tempo rischia che il database serverless (Neon sospende le connessioni
    # inattive) la chiuda a meta' lavoro, perdendo tutto quanto fatto finora.
    logger.info("Risolvo il comune di ogni candidato (puo' richiedere diversi minuti)...")
    for i, c in enumerate(candidati, start=1):
        c["comune"] = comune_da_tags_o_nominatim(c["tags"], c["lat"], c["lon"])
        if i % 50 == 0:
            logger.info(f"  ...{i}/{len(candidati)} comuni risolti")

    # Fase 2: scrittura sul database, veloce, connessione aperta solo ora.
    conn = psycopg2.connect(DATABASE_URL)
    inseriti = 0
    saltati_duplicati = 0
    try:
        with conn.cursor() as cur:
            for c in candidati:
                # Evita duplicati se lo script viene rilanciato sulla stessa area
                cur.execute(
                    "SELECT 1 FROM punti_interesse_pending WHERE fonte_osm = %s "
                    "UNION SELECT 1 FROM punti_interesse WHERE nome = %s LIMIT 1",
                    (c["fonte_osm"], c["nome"]),
                )
                if cur.fetchone():
                    saltati_duplicati += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO punti_interesse_pending
                        (nome, categoria, comune, provincia, latitudine, longitudine,
                         link_esterno, fonte_osm, tag_osm_grezzi)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        c["nome"], c["categoria"], c["comune"], provincia, c["lat"], c["lon"],
                        c["link_esterno"], c["fonte_osm"], json.dumps(c["tags"]),
                    ),
                )
                inseriti += 1
                logger.info(f"  + [{c['categoria']}] {c['nome']} ({c['comune'] or '?'})")

                # Commit periodico come ulteriore rete di sicurezza.
                if inseriti % 25 == 0:
                    conn.commit()
        conn.commit()
    finally:
        conn.close()

    logger.info(f"Fatto: {inseriti} inseriti, {saltati_duplicati} gia' presenti (saltati).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provincia", required=True, help='es. "Sassari"')
    parser.add_argument("--bbox", required=True, help="sud,ovest,nord,est in gradi decimali")
    parser.add_argument("--dry-run", action="store_true", help="Stampa i risultati senza scrivere sul database")
    args = parser.parse_args()

    importa(args.provincia, args.bbox, dry_run=args.dry_run)
