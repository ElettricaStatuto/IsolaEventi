"""
Scraper per timeinjazz.it - Time in Jazz Festival.

Estrae gli eventi dal calendario del festival dalla pagina principale
https://timeinjazz.it/edizione/festival-2026/
poi visita ogni singola pagina evento per estrarre data, ora e luogo.
"""
import logging
import re
import time
from typing import List
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

FESTIVAL_URL = "https://timeinjazz.it/edizione/festival-2026/"
BASE_URL = "https://timeinjazz.it"

# Headers che simulano un browser reale (necessari per bypassare Mod_Security)
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

MESI_IT = {
    "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
    "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
    "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12",
}


def _parse_data_italiana(testo: str) -> str | None:
    """Converte '19 Giugno 2026' → '2026-06-19'."""
    if not testo:
        return None
    testo = testo.strip().lower()
    match = re.search(r"(\d{1,2})\s+([a-zà-ú]+)\s+(\d{4})", testo)
    if match:
        giorno, mese_str, anno = match.groups()
        mese = MESI_IT.get(mese_str)
        if mese:
            return f"{anno}-{mese}-{giorno.zfill(2)}"
    return None


class TimeInJazzScraper(BaseScraper):
    nome_fonte = "timeinjazz.it"
    url_base = BASE_URL
    festival_name = "Time in Jazz 2026"

    def scrapa_eventi(self, max_pagine: int = 5) -> List[Evento]:
        """
        1. Carica la pagina del festival e raccoglie i link unici agli eventi.
        2. Per ogni link visita la pagina dettaglio e ne estrae i dati.
        """
        try:
            risposta = self.session.get(
                FESTIVAL_URL,
                headers=BROWSER_HEADERS,
                timeout=self.timeout,
            )
            risposta.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"[{self.nome_fonte}] Errore caricamento pagina festival: {e}")
            return []

        soup = BeautifulSoup(risposta.content, "lxml")

        # Raccoglie link unici a /evento/
        seen = set()
        event_links = []
        for a in soup.select("a[href*='/evento/']"):
            href = a["href"]
            if href not in seen:
                seen.add(href)
                event_links.append(href)

        logger.info(f"[{self.nome_fonte}] Trovati {len(event_links)} link eventi unici")

        eventi = []
        for i, url in enumerate(event_links):
            evento = self._scrapa_singolo_evento(url)
            if evento:
                eventi.append(evento)
                logger.debug(f"[{self.nome_fonte}] ({i+1}/{len(event_links)}) {evento.titolo}")
            # Pausa cortese tra le richieste
            time.sleep(self.pausa)

        logger.info(f"[{self.nome_fonte}] Estratti {len(eventi)} eventi")
        return eventi

    def _scrapa_singolo_evento(self, url: str) -> Evento | None:
        """Visita la pagina del singolo evento e ne estrae i dati strutturati."""
        try:
            risposta = self.session.get(
                url,
                headers=BROWSER_HEADERS,
                timeout=self.timeout,
            )
            risposta.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f"[{self.nome_fonte}] Errore evento {url}: {e}")
            return None

        soup = BeautifulSoup(risposta.content, "lxml")

        # Rimuovi elementi di navigazione e footer
        for tag in soup(["script", "style", "noscript", "nav", "footer", "header"]):
            tag.decompose()

        # --- Titolo ---
        titolo_tag = soup.select_one("h1") or soup.select_one("h2")
        if not titolo_tag:
            return None
        titolo = titolo_tag.get_text(strip=True)
        if not titolo:
            return None

        # --- Sottotitolo / Artisti: secondo e terzo heading ---
        sottotitoli = []
        for h in soup.select("h2, h3, h4"):
            txt = h.get_text(strip=True)
            if txt and txt != titolo and len(txt) < 200:
                # Salta heading di navigazione
                if any(kw in txt.lower() for kw in ["festival", "tutti gli eventi", "programma", "newsletter", "iscrivi"]):
                    continue
                sottotitoli.append(txt)
                if len(sottotitoli) >= 3:
                    break

        # --- Data ---
        full_text = soup.get_text(" ", strip=True)

        # Cerca pattern "19 Giugno 2026"
        data_match = re.search(
            r"\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|"
            r"luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b",
            full_text,
            re.IGNORECASE
        )
        data_inizio = None
        if data_match:
            data_inizio = _parse_data_italiana(data_match.group(0))

        # --- Ora ---
        ora_match = re.search(r"ORE\s+(\d{1,2}[:.]\d{2})", full_text, re.IGNORECASE)
        ora = ora_match.group(1).replace(".", ":") if ora_match else None

        # --- Luogo ---
        # Tipicamente dopo la data c'è "Berchidda - Sa Casara – ..."
        luogo = None
        luogo_match = re.search(
            r"(?:ORE\s+\d{1,2}[:.]\d{2}\s*)([A-ZÀÈÌÒÙÉÁÍÓÚ][^\n]{3,80})",
            full_text,
            re.IGNORECASE
        )
        if luogo_match:
            luogo_raw = luogo_match.group(1).strip()
            # Rimuovi keyword note
            if not any(kw in luogo_raw.lower() for kw in ["maps", "guest", "programma", "tutti"]):
                luogo = luogo_raw

        # Fallback luogo: cerca parole chiave comuni nei luoghi del festival
        if not luogo:
            luoghi_noti = ["Berchidda", "Castelsardo", "Sassari", "Olbia", "Nuoro",
                           "Alghero", "Oristano", "Cagliari", "Tempio", "Ozieri"]
            for l in luoghi_noti:
                if l.lower() in full_text.lower():
                    luogo = l
                    break

        # --- Immagine ---
        img_tag = soup.select_one("img[data-src]") or soup.select_one("img[src]")
        immagine = None
        if img_tag:
            src = img_tag.get("data-src") or img_tag.get("src")
            if src and not src.startswith("data:"):
                immagine = urljoin(BASE_URL, src)

        # --- Descrizione: testo dai paragrafi principali ---
        paragrafi = []
        for p in soup.select("p"):
            txt = p.get_text(strip=True)
            if txt and len(txt) > 30:
                paragrafi.append(txt)
        descrizione = " ".join(paragrafi[:3])[:500] if paragrafi else None

        # Aggiungi sottotitoli alla descrizione se non già presenti
        if sottotitoli and descrizione:
            extra = " | ".join(sottotitoli)
            if extra not in descrizione:
                descrizione = extra + " — " + descrizione
        elif sottotitoli:
            descrizione = " | ".join(sottotitoli)

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            luogo=luogo,
            url=url,
            descrizione=descrizione[:500] if descrizione else None,
            immagine=immagine,
            fonte=self.nome_fonte,
        )
