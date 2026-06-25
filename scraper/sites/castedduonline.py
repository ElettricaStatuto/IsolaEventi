"""
Scraper per castedduonline.it — notizie ed eventi da Cagliari e Sardegna.
RSS: https://www.castedduonline.it/feed/

Categoria eventi: filtra articoli con categoria 'eventi' o 'cultura'.
"""
import logging
from typing import List

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

CATEGORIE_EVENTI = {"eventi", "cultura", "spettacoli", "musica", "teatro", "sagre", "mostre"}


class CastedduOnlineScraper(BaseScraper):
    nome_fonte = "castedduonline.it"
    url_rss = "https://www.castedduonline.it/feed/"

    def __init__(self, solo_eventi: bool = False, **kwargs):
        """
        Args:
            solo_eventi: se True, filtra solo articoli con categorie legate agli eventi.
                         Se False, include tutte le notizie della Sardegna.
        """
        super().__init__(**kwargs)
        self.solo_eventi = solo_eventi

    def scrapa_eventi(self, max_pagine: int = 5) -> List[Evento]:
        tutti = []
        for pagina in range(1, max_pagine + 1):
            url = self.url_rss if pagina == 1 else f"{self.url_rss}?paged={pagina}"
            nuovi = self._scrapa_rss(url)
            if not nuovi:
                break
            logger.info(f"[{self.nome_fonte}] Pagina RSS {pagina}: {len(nuovi)} articoli")
            tutti.extend(nuovi)
        return tutti

    def _scrapa_rss(self, url: str) -> List[Evento]:
        try:
            risposta = self.session.get(url, timeout=self.timeout)
            risposta.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"[{self.nome_fonte}] Errore RSS {url}: {e}")
            return []

        soup = BeautifulSoup(risposta.content, "xml")
        items = soup.find_all("item")
        if not items:
            return []

        eventi = []
        for item in items:
            evento = self._parse_item(item)
            if evento:
                eventi.append(evento)
        return eventi

    def _parse_item(self, item) -> Evento | None:
        titolo_tag = item.find("title")
        if not titolo_tag:
            return None
        titolo = titolo_tag.get_text(strip=True)
        if not titolo:
            return None

        # Categorie dell'articolo
        categorie = [c.get_text(strip=True).lower() for c in item.find_all("category")]

        # Filtra per eventi se richiesto
        if self.solo_eventi and not any(c in CATEGORIE_EVENTI for c in categorie):
            return None

        link_tag = item.find("link")
        url = link_tag.get_text(strip=True) if link_tag else None

        data_tag = item.find("pubDate")
        data = None
        if data_tag:
            raw = data_tag.get_text(strip=True)
            # "Thu, 25 Jun 2026 15:18:54 +0000" → "25 Jun 2026"
            try:
                parti = raw.split(",")[1].strip().split(" ")
                data = f"{parti[0]} {parti[1]} {parti[2]}"
            except (IndexError, AttributeError):
                data = raw

        desc_tag = item.find("description")
        descrizione = None
        if desc_tag:
            d_soup = BeautifulSoup(desc_tag.get_text(strip=True), "html.parser")
            descrizione = d_soup.get_text(strip=True)[:300]

        categoria = ", ".join(categorie[:3]) if categorie else None

        return Evento(
            titolo=titolo,
            data_inizio=data,
            url=url,
            descrizione=descrizione,
            categoria=categoria,
            luogo="Sardegna",
            fonte=self.nome_fonte,
        )
