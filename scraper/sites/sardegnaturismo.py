"""
Scraper per sardegnaturismo.it via RSS feed.
RSS: https://www.sardegnaturismo.it/it/rss.xml  (fallback: HTML con stream=True)

Il sito ufficiale del turismo sardo pubblica eventi nella sezione /it/esplora/eventi.
"""
import logging
from typing import List
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

RSS_URLS = [
    "https://www.sardegnaturismo.it/it/rss.xml",
    "https://www.sardegnaturismo.it/it/rss/field_type/evento.xml",
]
PAGINA_EVENTI = "https://www.sardegnaturismo.it/it/esplora/eventi"


class SardegnaTurismoScraper(BaseScraper):
    nome_fonte = "sardegnaturismo.it"
    url_base = "https://www.sardegnaturismo.it"

    def scrapa_eventi(self, max_pagine: int = 5) -> List[Evento]:
        # Prova prima via RSS
        for rss_url in RSS_URLS:
            eventi = self._scrapa_rss(rss_url)
            if eventi:
                logger.info(f"[{self.nome_fonte}] RSS OK: {len(eventi)} eventi da {rss_url}")
                return eventi

        # Fallback: scraping HTML della pagina eventi
        logger.info(f"[{self.nome_fonte}] RSS vuoto, provo scraping HTML...")
        return self._scrapa_html(max_pagine)

    def _scrapa_rss(self, url: str) -> List[Evento]:
        try:
            risposta = self.session.get(url, timeout=self.timeout, stream=False)
            risposta.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f"[{self.nome_fonte}] RSS non disponibile ({url}): {e}")
            return []

        soup = BeautifulSoup(risposta.content, "xml")
        items = soup.find_all("item")
        if not items:
            return []

        eventi = []
        for item in items:
            titolo_tag = item.find("title")
            if not titolo_tag:
                continue
            titolo = titolo_tag.get_text(strip=True)

            link_tag = item.find("link")
            url = link_tag.get_text(strip=True) if link_tag else None

            data_tag = item.find("pubdate") or item.find("pubDate")
            data = data_tag.get_text(strip=True) if data_tag else None

            cat_tag = item.find("category")
            categoria = cat_tag.get_text(strip=True) if cat_tag else None

            desc_tag = item.find("description")
            descrizione = None
            if desc_tag:
                d_soup = BeautifulSoup(desc_tag.get_text(strip=True), "html.parser")
                descrizione = d_soup.get_text(strip=True)[:300]

            eventi.append(Evento(
                titolo=titolo,
                data_inizio=data,
                url=url,
                descrizione=descrizione,
                categoria=categoria,
                fonte=self.nome_fonte,
            ))
        return eventi

    def _scrapa_html(self, max_pagine: int) -> List[Evento]:
        eventi = []
        for pagina in range(0, max_pagine):
            params = {"page": pagina} if pagina > 0 else {}
            try:
                risposta = self.session.get(
                    PAGINA_EVENTI, params=params, timeout=self.timeout, stream=False
                )
                risposta.raise_for_status()
            except requests.RequestException as e:
                logger.error(f"[{self.nome_fonte}] Errore HTML pag {pagina}: {e}")
                break

            import time
            time.sleep(self.pausa)
            soup = BeautifulSoup(risposta.text, "html.parser")

            cards = soup.select(
                "article.node--type-evento, "
                "div.views-row, "
                ".event-item, "
                "article"
            )
            if not cards:
                break

            nuovi = 0
            for card in cards:
                evento = self._parse_card_html(card)
                if evento:
                    eventi.append(evento)
                    nuovi += 1

            logger.info(f"[{self.nome_fonte}] HTML pag {pagina}: {nuovi} eventi")
            if nuovi == 0:
                break

        return eventi

    def _parse_card_html(self, card) -> Evento | None:
        titolo_tag = card.select_one("h2, h3, .node__title, .field--name-title")
        if not titolo_tag:
            return None
        titolo = titolo_tag.get_text(strip=True)
        if not titolo:
            return None

        link_tag = titolo_tag.find("a") or card.find("a")
        url = urljoin(self.url_base, link_tag["href"]) if link_tag and link_tag.get("href") else None

        data_tag = card.select_one("time[datetime], .date-display-single, .field--name-field-data-evento")
        data = None
        if data_tag:
            data = data_tag.get("datetime") or data_tag.get_text(strip=True)

        luogo_tag = card.select_one(".field--name-field-comune, .field--name-field-luogo, .location")
        luogo = luogo_tag.get_text(strip=True) if luogo_tag else None

        desc_tag = card.select_one(".field--name-body, .field--name-field-abstract, p")
        descrizione = desc_tag.get_text(strip=True)[:300] if desc_tag else None

        img_tag = card.find("img")
        immagine = None
        if img_tag:
            src = img_tag.get("src") or img_tag.get("data-src")
            if src:
                immagine = urljoin(self.url_base, src)

        return Evento(
            titolo=titolo,
            data_inizio=data,
            luogo=luogo,
            url=url,
            descrizione=descrizione,
            immagine=immagine,
            fonte=self.nome_fonte,
        )
