"""
Scraper per spettacolisardegna.it/eventi (concerti, teatro, spettacoli)

Il sito usa il plugin WordPress "Events Manager". Struttura HTML reale:
- Container evento: div.em-event.em-item (attenzione: la pagina contiene
  anche altri div con la stessa classe usati dal plugin per scopi interni,
  senza titolo - vanno scartati controllando la presenza di .em-item-title)
- Titolo + link: h3.em-item-title > a
- Data: .em-event-date, testo "D Mese, YYYY" oppure "D Mese, YYYY - D Mese, YYYY"
- Luogo: .em-event-location > a (testo)
- Categoria: .em-event-categories a (una o piu')
- Descrizione: .em-item-desc (troncata dal sito stesso con "[...]" - va bene
  come contesto breve, il testo completo lo legge poi il Crawler AI dalla
  pagina di dettaglio, a cui gia' passiamo il link)
- Immagine: .em-item-image img

Paginazione: ?pno=2, ?pno=3, ... Oltre l'ultima pagina reale il sito non
restituisce un errore ne' una pagina vuota, ma ripete contenuto senza titoli
(placeholder interni del plugin) - il segnale di stop affidabile e' quindi
"zero eventi con titolo su questa pagina", non "zero elementi trovati".
"""
import logging
import re
from typing import Optional
from urllib.parse import urljoin

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

URL_EVENTI = "https://www.spettacolisardegna.it/eventi/"
URL_BASE = "https://www.spettacolisardegna.it"

MESI = {
    "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
    "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
    "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12",
}

# "28 Agosto, 2026" oppure "28 Agosto, 2026 - 6 Settembre, 2026"
RE_DATA = re.compile(
    r"(\d{1,2})\s+(\w+),?\s+(\d{4})(?:\s*-\s*(\d{1,2})\s+(\w+),?\s+(\d{4}))?",
    re.IGNORECASE,
)


class SpettacoliSardegnaScraper(BaseScraper):
    nome_fonte = "spettacolisardegna.it"
    url_base = URL_BASE

    def scrapa_eventi(self, max_pagine: int = 20) -> list[Evento]:
        eventi = []
        titoli_visti: set[str] = set()

        for pagina in range(1, max_pagine + 1):
            url = URL_EVENTI if pagina == 1 else f"{URL_EVENTI}?pno={pagina}"
            soup = self.get_pagina(url)
            if soup is None:
                break

            candidati = soup.select(".em-event.em-item")
            trovati_con_titolo = 0

            for div in candidati:
                evento = self._parse_item(div)
                if not evento:
                    continue
                trovati_con_titolo += 1
                # Chiave di deduplica intra-scansione: titolo+data, non solo
                # titolo (lo stesso artista puo' avere piu' tappe/date diverse,
                # sono eventi distinti e vanno tenuti entrambi).
                chiave = f"{evento.titolo}|{evento.data_inizio}"
                if chiave in titoli_visti:
                    continue
                titoli_visti.add(chiave)
                eventi.append(evento)

            logger.info(f"[{self.nome_fonte}] Pagina {pagina}: {trovati_con_titolo} eventi con titolo")

            # Nessun evento reale su questa pagina: oltre la fine della lista
            # (il sito ripete placeholder senza titolo invece di fermarsi).
            if trovati_con_titolo == 0:
                logger.info(f"[{self.nome_fonte}] Pagina {pagina} vuota, fine paginazione.")
                break

        return eventi

    # ------------------------------------------------------------------
    def _parse_item(self, div) -> Optional[Evento]:
        title_a = div.select_one(".em-item-title a")
        if not title_a:
            return None

        titolo = title_a.get_text(strip=True)
        if not titolo:
            return None

        href = title_a.get("href", "")
        url = urljoin(self.url_base, href) if href else None

        date_div = div.select_one(".em-event-date")
        data_inizio, data_fine = self._estrai_date(date_div.get_text(strip=True) if date_div else "")

        loc_a = div.select_one(".em-event-location a")
        luogo = loc_a.get_text(strip=True) if loc_a else None

        categorie = [a.get_text(strip=True) for a in div.select(".em-event-categories a")]
        categoria = categorie[0] if categorie else None

        desc_div = div.select_one(".em-item-desc")
        descrizione = desc_div.get_text(strip=True) if desc_div else None

        img = div.select_one(".em-item-image img")
        immagine = None
        if img:
            src = img.get("src") or img.get("data-src")
            if src:
                immagine = urljoin(self.url_base, src)

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            data_fine=data_fine,
            luogo=luogo,
            url=url,
            descrizione=descrizione,
            immagine=immagine,
            categoria=categoria,
            tags=categorie,
            fonte=self.nome_fonte,
        )

    # ------------------------------------------------------------------
    def _estrai_date(self, testo: str) -> tuple[Optional[str], Optional[str]]:
        m = RE_DATA.search(testo)
        if not m:
            return None, None

        g1, mese1, anno1, g2, mese2, anno2 = m.groups()
        mese1_num = MESI.get(mese1.lower())
        if not mese1_num:
            return None, None
        data_inizio = f"{anno1}-{mese1_num}-{int(g1):02d}"

        data_fine = None
        if g2 and mese2 and anno2:
            mese2_num = MESI.get(mese2.lower())
            if mese2_num:
                data_fine = f"{anno2}-{mese2_num}-{int(g2):02d}"

        return data_inizio, data_fine
