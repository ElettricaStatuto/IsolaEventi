"""
Scraper per paradisola.it/eventi-sardegna

Struttura HTML reale:
- Container: .category-desc ul li
- Titolo: <h3><a title="Titolo evento">DATA: Titolo</a></h3>
- Data ISO: estratta dall'href  /eventi-sardegna/calendario/details/YYYY-MM-DD/...
- Date testuali: nel testo h3, es. "23- 28 giugno: Festival Letterario di Alghero"
- Luogo: estratto dal titolo dopo "a " / "ad " / "di " o dall'ultima parola significativa
- Descrizione: testo del <li> dopo l'h3
"""
import logging
import re
from typing import Optional
from urllib.parse import urljoin

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

URL_EVENTI = "https://www.paradisola.it/eventi-sardegna"
URL_BASE   = "https://www.paradisola.it"

# Mesi italiani → numero
MESI = {
    "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
    "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
    "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12",
}

# Pattern: "23- 28 giugno" / "27 giugno" / "26 - 28 giugno"
RE_DATA = re.compile(
    r"(\d{1,2})\s*[-–]?\s*(\d{1,2})?\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|"
    r"luglio|agosto|settembre|ottobre|novembre|dicembre)",
    re.IGNORECASE,
)

# Pattern per estrarre luogo da "... a Alghero" / "... ad Oristano" / "... di Nuoro"
RE_LUOGO = re.compile(r"\b(?:a|ad|in|di)\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòùA-Z\s']+?)(?:\s*$)", re.UNICODE)


class ParadisolaScraper(BaseScraper):
    nome_fonte = "paradisola.it"
    url_base   = URL_BASE

    def scrapa_eventi(self, max_pagine: int = 5) -> list[Evento]:
        eventi = []
        for pagina in range(1, max_pagine + 1):
            url = URL_EVENTI if pagina == 1 else f"{URL_EVENTI}?start={(pagina-1)*20}"
            soup = self.get_pagina(url)
            if soup is None:
                break

            items = soup.select(".category-desc ul li")
            if not items:
                logger.info(f"[{self.nome_fonte}] Nessun elemento a pagina {pagina}, stop.")
                break

            nuovi = 0
            for li in items:
                evento = self._parse_li(li)
                if evento:
                    eventi.append(evento)
                    nuovi += 1

            logger.info(f"[{self.nome_fonte}] Pagina {pagina}: {nuovi} eventi")

            # paradisola.it carica tutto in una pagina → stop dopo la prima
            break

        return eventi

    # ------------------------------------------------------------------
    def _parse_li(self, li) -> Optional[Evento]:
        h3 = li.find("h3")
        if not h3:
            return None

        a = h3.find("a")
        if not a:
            return None

        # Titolo pulito (senza emoji, senza prefisso data)
        titolo_completo = a.get("title") or a.get_text(strip=True)
        titolo = titolo_completo.strip()

        # URL assoluto
        href = a.get("href", "")
        url = urljoin(self.url_base, href) if href else None

        # Data ISO dall'URL: /calendario/details/YYYY-MM-DD/...
        data_inizio, data_fine = self._estrai_date(h3.get_text(strip=True), href)

        # Luogo: estratto dal title dell'<a> ("Festival Letterario di Alghero")
        luogo = self._estrai_luogo(titolo)

        # Descrizione: tutto il testo del <li> meno l'h3
        h3.extract()
        descrizione = li.get_text(separator=" ", strip=True)
        # rimuovi span google-anno-t junk
        descrizione = re.sub(r"\s{2,}", " ", descrizione).strip()[:400]
        if not descrizione:
            descrizione = None

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            data_fine=data_fine,
            luogo=luogo,
            url=url,
            descrizione=descrizione,
            fonte=self.nome_fonte,
        )

    # ------------------------------------------------------------------
    def _estrai_date(self, testo_h3: str, href: str) -> tuple[Optional[str], Optional[str]]:
        """
        Estrae data_inizio e data_fine.
        Prima tenta l'href (YYYY-MM-DD affidabile), poi il testo h3.
        """
        # 1) Data ISO dall'href
        m_iso = re.search(r"/details/(\d{4}-\d{2}-\d{2})/", href)
        anno = None
        data_inizio_iso: Optional[str] = None
        if m_iso:
            data_inizio_iso = m_iso.group(1)
            anno = data_inizio_iso[:4]

        # 2) Range testuale dal testo h3: "23- 28 giugno"
        testo_pulito = testo_h3.replace("📣", "").strip()
        m = RE_DATA.search(testo_pulito)
        if m:
            giorno_inizio = m.group(1).zfill(2)
            giorno_fine   = (m.group(2) or m.group(1)).zfill(2)
            mese_nome     = m.group(3).lower()
            mese_num      = MESI.get(mese_nome, "01")
            anno_str      = anno or "2026"

            data_inizio = f"{anno_str}-{mese_num}-{giorno_inizio}"
            data_fine   = f"{anno_str}-{mese_num}-{giorno_fine}" if giorno_fine != giorno_inizio else None
            return data_inizio, data_fine

        # Fallback: solo ISO dall'href
        return data_inizio_iso, None

    # ------------------------------------------------------------------
    def _estrai_luogo(self, titolo: str) -> Optional[str]:
        """
        Cerca il luogo nel titolo dell'evento.
        Esempi:
          "Festival Letterario di Alghero"          → Alghero
          "Mare e Miniere a Portoscuso"              → Portoscuso
          "Negramaro a Golfo Aranci"                 → Golfo Aranci
          "Primavera in Ogliastra a Lanusei"         → Lanusei
          "Sardinia International Guitar Camp a Valledoria" → Valledoria
        """
        m = RE_LUOGO.search(titolo)
        if m:
            luogo = m.group(1).strip()
            # Rimuovi parole trailing come "2026", numeri
            luogo = re.sub(r"\s*\d{4}.*$", "", luogo).strip()
            if luogo:
                return luogo
        return None
