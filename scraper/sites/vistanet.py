"""
Scraper per vistanet.it — sezione eventi Sardegna per provincia.
URL esempio: https://www.vistanet.it/cagliari/rubriche/eventi/

Struttura HTML reale:
- Container: <article class="article-content-N clearfix post-NNNNN post ...">
- Titolo: <h1 class="entry-title ..."> (testo senza link diretto)
- URL: estratto dal link Facebook share (.sharer.php?u=URL)
- Data: <time datetime="YYYY-MM-DD HH:MM:SS">
- Img: src che contiene 'vistanet.it/*/wp-content/uploads/'
"""
import logging
import re
from typing import List, Optional
from urllib.parse import parse_qs, urlparse

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

PROVINCE_SARDEGNA = {
    "cagliari": "CA",
    "sassari": "SS",
    "nuoro": "NU",
    "oristano": "OR",
}


class VistanetScraper(BaseScraper):
    nome_fonte = "vistanet.it"
    url_base = "https://www.vistanet.it"

    sezioni = {
        "cagliari": "https://www.vistanet.it/cagliari/rubriche/eventi/",
        "sassari":  "https://www.vistanet.it/sassari/rubriche/eventi/",
        "nuoro":    "https://www.vistanet.it/nuoro/rubriche/eventi/",
        "oristano": "https://www.vistanet.it/oristano/rubriche/eventi/",
    }

    def __init__(self, province: Optional[List[str]] = None, **kwargs):
        super().__init__(**kwargs)
        if province:
            self.sezioni = {k: v for k, v in self.sezioni.items() if k in province}

    def scrapa_eventi(self, max_pagine: int = 3) -> List[Evento]:
        tutti = []
        for provincia, url_sezione in self.sezioni.items():
            logger.info(f"[{self.nome_fonte}] Scraping provincia: {provincia}")
            eventi = self._scrapa_sezione(url_sezione, provincia, max_pagine)
            logger.info(f"[{self.nome_fonte}] {provincia}: {len(eventi)} eventi totali")
            tutti.extend(eventi)
        return tutti

    def _scrapa_sezione(self, url_sezione: str, provincia: str, max_pagine: int) -> List[Evento]:
        eventi = []
        for pagina in range(1, max_pagine + 1):
            url = url_sezione if pagina == 1 else f"{url_sezione}page/{pagina}/"
            soup = self.get_pagina(url)
            if soup is None:
                break

            cards = soup.find_all("article")
            if not cards:
                break

            nuovi = 0
            for card in cards:
                evento = self._parse_card(card, provincia)
                if evento:
                    eventi.append(evento)
                    nuovi += 1

            logger.info(f"[{self.nome_fonte}] {provincia} pag {pagina}: {nuovi} eventi")
            if nuovi == 0:
                break

        return eventi

    def _parse_card(self, card, provincia: str) -> Optional[Evento]:
        # Titolo: <h1 class="entry-title ..."> o h2/h3
        titolo_tag = card.select_one("h1.entry-title, h2.entry-title, h3.entry-title")
        if not titolo_tag:
            return None
        titolo = titolo_tag.get_text(strip=True)
        if not titolo:
            return None

        # URL: estratto dal parametro ?u= del link Facebook share
        url = self._estrai_url_da_share(card)

        # Data: <time datetime="...">
        time_tag = card.select_one("time[datetime]")
        data = time_tag["datetime"].split(" ")[0] if time_tag else None

        # Descrizione: primo <p> nel contenuto
        desc_tag = card.select_one(".entry-content p, .entry-summary p, .post-content p")
        descrizione = desc_tag.get_text(strip=True)[:300] if desc_tag else None

        # Immagine: img con URL wp-content/uploads da vistanet
        immagine = self._estrai_immagine(card)

        return Evento(
            titolo=titolo,
            data_inizio=data,
            luogo=provincia.capitalize(),
            provincia=PROVINCE_SARDEGNA.get(provincia),
            url=url,
            descrizione=descrizione,
            immagine=immagine,
            fonte=self.nome_fonte,
        )

    def _estrai_url_da_share(self, card) -> Optional[str]:
        """Estrae l'URL dell'articolo dal link di condivisione Facebook."""
        fb_link = card.find("a", href=re.compile(r"facebook\.com/sharer"))
        if not fb_link:
            return None
        try:
            parsed = urlparse(fb_link["href"])
            url = parse_qs(parsed.query).get("u", [None])[0]
            return url
        except Exception:
            return None

    def _estrai_immagine(self, card) -> Optional[str]:
        """Cerca img con URL wp-content/uploads (immagine articolo reale)."""
        for img in card.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            if "wp-content/uploads" in src and "vistanet" in src:
                return src
        return None
