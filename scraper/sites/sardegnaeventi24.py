"""
Scraper per sardegnaeventi24.it via RSS feed.
RSS: https://www.sardegnaeventi24.it/eventi/feed/

Il sito usa Elementor (JS-heavy), ma il feed RSS è sempre server-side rendered
e fornisce titolo, link, data, categoria e descrizione.
"""
import logging
from typing import List

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)


class SardegnaEventi24Scraper(BaseScraper):
    nome_fonte = "sardegnaeventi24.it"
    url_rss = "https://www.sardegnaeventi24.it/eventi/feed/"

    def scrapa_eventi(self, max_pagine: int = 5) -> List[Evento]:
        tutti = []
        for pagina in range(1, max_pagine + 1):
            url = self.url_rss if pagina == 1 else f"{self.url_rss}?paged={pagina}"
            eventi_pag = self._scrapa_rss(url)
            if not eventi_pag:
                break
            logger.info(f"[{self.nome_fonte}] Pagina RSS {pagina}: {len(eventi_pag)} eventi")
            tutti.extend(eventi_pag)
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

        # RSS <link> è spesso dopo <title> come testo
        link_tag = item.find("link")
        url = None
        if link_tag:
            # In RSS con html.parser il link è come NavigableString dopo il tag
            url = link_tag.get_text(strip=True)
            if not url or not url.startswith("http"):
                # prova next_sibling (NavigableString)
                ns = link_tag.next_sibling
                url = str(ns).strip() if ns else None

        data_tag = item.find("pubdate") or item.find("pubDate")
        data = data_tag.get_text(strip=True) if data_tag else None
        # Formato es: "Thu, 19 Jun 2025 10:00:00 +0000" → teniamo solo la data
        if data and "," in data:
            try:
                parti = data.split(",")[1].strip().split(" ")
                data = f"{parti[0]} {parti[1]} {parti[2]}"  # "19 Jun 2025"
            except IndexError:
                pass

        cat_tag = item.find("category")
        categoria = cat_tag.get_text(strip=True) if cat_tag else None

        desc_tag = item.find("description")
        descrizione = None
        if desc_tag:
            raw = desc_tag.get_text(strip=True)
            # rimuovi tag HTML residui
            desc_soup = BeautifulSoup(raw, "html.parser")
            descrizione = desc_soup.get_text(strip=True)[:300]

        return Evento(
            titolo=titolo,
            data_inizio=data,
            url=url,
            descrizione=descrizione,
            categoria=categoria,
            fonte=self.nome_fonte,
        )
