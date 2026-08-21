"""
Scraper per saludetrigu.it (Camera di Commercio di Sassari, eventi Nord Sardegna)
via la REST API pubblica di "The Events Calendar" (plugin WordPress).

Niente parsing HTML: il sito espone /wp-json/tribe/events/v1/events con dati
gia' strutturati (titolo, date/orari precisi, venue con coordinate GPS, immagine,
costo, sito web) - molto piu' affidabile di uno scraping di pagina.
"""
import logging
import re
import time
from typing import List, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

API_URL = "https://saludetrigu.it/wp-json/tribe/events/v1/events"
PER_PAGE = 50
MAX_PAGINE = 40  # rete di sicurezza anti-loop, non un limite di business (oggi il sito ha ~29 pagine)

# Il sito e' multilingua (Polylang): la stessa API restituisce ogni evento
# ripetuto in IT/EN/ES/FR come voci separate, distinguibili solo dal prefisso
# nell'URL (/en/evento/..., /es/evento/..., /fr/evento/...). Teniamo solo
# l'italiano (nessun prefisso) per non importare 3-4 doppioni per evento.
_PREFISSI_LINGUA_DA_SCARTARE = ("/en/", "/es/", "/fr/")


def _e_versione_non_italiana(url: Optional[str]) -> bool:
    if not url:
        return False
    path = urlparse(url).path
    return path.startswith(_PREFISSI_LINGUA_DA_SCARTARE)


def _pulisci_html(testo: Optional[str]) -> Optional[str]:
    if not testo:
        return None
    soup = BeautifulSoup(testo, "html.parser")
    pulito = soup.get_text(separator=" ", strip=True)
    pulito = re.sub(r"\s+", " ", pulito).strip()
    return pulito or None


def _formatta_luogo(venue: Optional[dict]) -> Optional[str]:
    if not venue:
        return None
    citta = venue.get("city") or venue.get("venue")
    nome_locale = venue.get("venue")
    if citta and nome_locale and nome_locale != citta:
        return f"{citta}, {nome_locale}"
    return citta or nome_locale


def _splitta_data_ora(valore: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """'YYYY-MM-DD HH:MM:SS' -> ('YYYY-MM-DD', 'HH:MM')"""
    if not valore:
        return None, None
    parti = valore.strip().split(" ")
    data = parti[0] if parti else None
    ora = parti[1][:5] if len(parti) > 1 else None
    return data, ora


class SaludeTriguScraper(BaseScraper):
    nome_fonte = "saludetrigu.it"
    url_base = "https://saludetrigu.it"

    def scrapa_eventi(self) -> List[Evento]:
        eventi: List[Evento] = []
        pagina = 1
        totale_pagine = None

        while pagina <= MAX_PAGINE and (totale_pagine is None or pagina <= totale_pagine):
            try:
                risposta = self.session.get(
                    API_URL, params={"per_page": PER_PAGE, "page": pagina}, timeout=self.timeout
                )
                risposta.raise_for_status()
                dati = risposta.json()
            except (requests.RequestException, ValueError) as e:
                logger.error(f"[{self.nome_fonte}] Errore pagina {pagina}: {e}")
                break

            totale_pagine = dati.get("total_pages", pagina)
            grezzi = dati.get("events", [])
            if not grezzi:
                break

            for ev in grezzi:
                evento = self._mappa_evento(ev)
                if evento:
                    eventi.append(evento)

            logger.info(f"[{self.nome_fonte}] pagina {pagina}/{totale_pagine}: {len(grezzi)} eventi")
            pagina += 1
            time.sleep(self.pausa)

        return eventi

    def _mappa_evento(self, ev: dict) -> Optional[Evento]:
        if _e_versione_non_italiana(ev.get("url")):
            return None

        titolo = _pulisci_html(ev.get("title"))
        if not titolo:
            return None

        data_inizio, ora_inizio = _splitta_data_ora(ev.get("start_date"))
        data_fine, ora_fine = _splitta_data_ora(ev.get("end_date"))
        if ev.get("all_day"):
            ora_inizio, ora_fine = None, None

        venue = ev.get("venue") or {}
        luogo = _formatta_luogo(venue)
        lat = venue.get("geo_lat") or None
        lon = venue.get("geo_lng") or None

        immagine = None
        img = ev.get("image")
        if isinstance(img, dict):
            immagine = img.get("url")

        descrizione = _pulisci_html(ev.get("description")) or _pulisci_html(ev.get("excerpt"))

        categorie = [c.get("name") for c in (ev.get("categories") or []) if c.get("name")]
        costo_raw = ev.get("cost") or None

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            data_fine=data_fine or data_inizio,
            ora_inizio=ora_inizio,
            ora_fine=ora_fine,
            luogo=luogo,
            latitudine=float(lat) if lat else None,
            longitudine=float(lon) if lon else None,
            url=ev.get("url"),
            descrizione=descrizione,
            immagine=immagine,
            fonte=self.nome_fonte,
            link_biglietti=ev.get("website") or None,
            is_ingresso_gratuito=(costo_raw == "" or costo_raw is None),
            dettagli_extra={
                "categoria_originale_sito": ", ".join(categorie) if categorie else None,
                "costo_originale_sito": costo_raw,
            },
        )
