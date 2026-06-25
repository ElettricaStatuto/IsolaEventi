"""
Web scraper per eventi in Sardegna.

Utilizzo:
    python main.py                           # scrapa tutti i siti, stampa a video
    python main.py --siti sardegnaturismo    # solo un sito specifico
    python main.py --siti vistanet casteddu  # più siti
    python main.py --formato json            # esporta in JSON
    python main.py --formato csv             # esporta in CSV
    python main.py --formato json csv        # esporta in entrambi
    python main.py --pagine 3               # limita le pagine per sito (default: 5)
    python main.py --provincia cagliari      # solo eventi di Cagliari (vistanet)
    python main.py --solo-eventi             # filtra solo articoli evento (casteddu)

Siti supportati:
    sardegnaturismo  →  sardegnaturismo.it (sito ufficiale turismo)
    vistanet         →  vistanet.it (per provincia: cagliari, sassari, nuoro, oristano)
    casteddu         →  castedduonline.it (notizie ed eventi da Cagliari/Sardegna)
"""
import argparse
import logging
import sys
from typing import List

from scraper.models import Evento
from scraper.export import esporta_csv, esporta_json
from scraper.sites import (
    SardegnaTurismoScraper,
    CastedduOnlineScraper,
    VistanetScraper,
    ParadisolaScraper,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SITI_DISPONIBILI = {
    "sardegnaturismo": SardegnaTurismoScraper,
    "vistanet": VistanetScraper,
    "casteddu": CastedduOnlineScraper,
    "paradisola": ParadisolaScraper,
}


def stampa_risultati(eventi: List[Evento]) -> None:
    if not eventi:
        print("\n⚠️  Nessun evento trovato.")
        return

    print(f"\n{'='*60}")
    print(f"  🎉 {len(eventi)} ARTICOLI/EVENTI TROVATI IN SARDEGNA")
    print(f"{'='*60}\n")

    per_fonte: dict[str, List[Evento]] = {}
    for e in eventi:
        per_fonte.setdefault(e.fonte or "Sconosciuta", []).append(e)

    for fonte, lista in per_fonte.items():
        print(f"\n🌐 {fonte.upper()} ({len(lista)} risultati)")
        print("-" * 50)
        for evento in lista:
            print(evento)
            print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scraper eventi in Sardegna",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--siti",
        nargs="+",
        choices=list(SITI_DISPONIBILI.keys()),
        default=list(SITI_DISPONIBILI.keys()),
        metavar="SITO",
        help=f"Siti da scrape (scegli tra: {', '.join(SITI_DISPONIBILI)}). Default: tutti.",
    )
    parser.add_argument(
        "--formato",
        nargs="+",
        choices=["json", "csv"],
        default=[],
        help="Formato/i di esportazione. Default: solo stampa a video.",
    )
    parser.add_argument(
        "--pagine",
        type=int,
        default=5,
        help="Numero massimo di pagine per sito (default: 5).",
    )
    parser.add_argument(
        "--provincia",
        nargs="+",
        choices=["cagliari", "sassari", "nuoro", "oristano"],
        help="Filtra per provincia (solo per vistanet).",
    )
    parser.add_argument(
        "--solo-eventi",
        action="store_true",
        help="Filtra solo articoli con categoria evento (solo per casteddu).",
    )
    parser.add_argument(
        "--output",
        default="eventi_sardegna",
        help="Nome base del file di output senza estensione (default: eventi_sardegna).",
    )
    parser.add_argument(
        "--pausa",
        type=float,
        default=1.5,
        help="Pausa in secondi tra le richieste HTTP (default: 1.5).",
    )

    args = parser.parse_args()
    tutti_eventi: List[Evento] = []

    for nome_sito in args.siti:
        Scraper = SITI_DISPONIBILI[nome_sito]

        kwargs: dict = {"pausa": args.pausa}
        if nome_sito == "vistanet" and args.provincia:
            kwargs["province"] = args.provincia
        if nome_sito == "casteddu":
            kwargs["solo_eventi"] = args.solo_eventi

        scraper = Scraper(**kwargs)
        logger.info(f"Avvio scraping: {scraper.nome_fonte}")
        try:
            eventi = scraper.scrapa_eventi(max_pagine=args.pagine)
            logger.info(f"✓ {scraper.nome_fonte}: {len(eventi)} risultati estratti")
            tutti_eventi.extend(eventi)
        except Exception as e:
            logger.error(f"✗ Errore con {scraper.nome_fonte}: {e}")

    # Deduplicazione per URL (rimuove duplicati mantenendo l'ordine)
    visti: set[str] = set()
    unici: List[Evento] = []
    for e in tutti_eventi:
        chiave = e.url or e.titolo
        if chiave not in visti:
            visti.add(chiave)
            unici.append(e)
    if len(unici) < len(tutti_eventi):
        logger.info(f"Rimossi {len(tutti_eventi) - len(unici)} duplicati")
    tutti_eventi = unici

    stampa_risultati(tutti_eventi)

    if "json" in args.formato:
        path = esporta_json(tutti_eventi, f"{args.output}.json")
        print(f"✅ JSON salvato in: {path}")

    if "csv" in args.formato:
        path = esporta_csv(tutti_eventi, f"{args.output}.csv")
        print(f"✅ CSV salvato in:  {path}")

    if tutti_eventi:
        print(f"\n📊 Totale risultati: {len(tutti_eventi)}")

    return 0 if tutti_eventi else 1


if __name__ == "__main__":
    sys.exit(main())
