import time
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from .models import Evento

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class BaseScraper(ABC):
    nome_fonte: str = "Sconosciuta"
    url_base: str = ""

    def __init__(self, timeout: int = 15, pausa: float = 1.5):
        self.timeout = timeout
        self.pausa = pausa
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def get_pagina(self, url: str, params: Optional[dict] = None, pausa: Optional[float] = None) -> Optional[BeautifulSoup]:
        try:
            logger.info(f"[{self.nome_fonte}] GET {url}")
            risposta = self.session.get(url, params=params, timeout=self.timeout)
            risposta.raise_for_status()
            time.sleep(pausa if pausa is not None else self.pausa)
            return BeautifulSoup(risposta.text, "html.parser")
        except requests.RequestException as e:
            logger.error(f"[{self.nome_fonte}] Errore su {url}: {e}")
            return None

    @abstractmethod
    def scrapa_eventi(self) -> List[Evento]:
        """Implementa la logica di scraping specifica per ogni sito."""
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} fonte='{self.nome_fonte}'>"
