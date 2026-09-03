"""
Scraper per saludetrigu.it (Camera di Commercio di Sassari, eventi Nord Sardegna).

La pagina /calendario-eventi/ incorpora gia' nell'HTML un blob JSON
(<script class="saludetrigu-map-events-json">) pensato per popolare la mappa
del sito stesso: contiene tutte le occorrenze (una per data/orario/luogo)
gia' strutturate, con coordinate GPS precise. Una sola richiesta HTML basta
per tutto il calendario - niente bisogno di paginare la REST API di "The
Events Calendar", che sotto carico ripetuto va incontro alla protezione
anti-bot dell'hosting (redirect a /.well-known/sgcaptcha/).

Piu' occorrenze con lo STESSO titolo esatto sono le diverse date/serate
dello stesso festival o rassegna: le raggruppiamo in un unico Evento Padre
con i suoi Sotto-eventi, invece di lasciarle come voci scollegate.
"""
import datetime
import json
import logging
import re
import time
from typing import List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import requests

from ..base import BaseScraper
from ..models import Evento, SottoEvento

logger = logging.getLogger(__name__)

URL_CALENDARIO = "https://saludetrigu.it/calendario-eventi/"
URL_BASE = "https://saludetrigu.it"

# Ogni pagina di UNA singola occorrenza riporta in fondo un link "Vai
# all'evento completo" verso la pagina generale della rassegna (un post
# WordPress normale, es. /2026/05/summerbeach-2026-.../), che contiene
# l'intero programma con tutte le date - molto piu' ricca di una singola
# occorrenza. Lo cerchiamo per usare QUELLA pagina come fonte per il padre.
_RE_EVENTO_COMPLETO = re.compile(r"vai all.?evento completo", re.IGNORECASE)


def _pulisci_html(testo: Optional[str]) -> Optional[str]:
    if not testo:
        return None
    pulito = BeautifulSoup(testo, "html.parser").get_text(separator=" ", strip=True)
    return pulito or None


def _data_ora_da_ts(ts) -> tuple[Optional[str], Optional[str]]:
    """Il sito genera 'start_ts' trattando l'ora locale italiana come se
    fosse UTC (verificato: interpretarlo come UTC riproduce esattamente
    l'orario mostrato in 'date_full' sul sito) - quindi lo leggiamo cosi'
    com'e', senza ulteriori conversioni di fuso orario."""
    if not ts:
        return None, None
    dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


class SaludeTriguScraper(BaseScraper):
    nome_fonte = "saludetrigu.it"
    url_base = URL_BASE

    def scrapa_eventi(self) -> List[Evento]:
        occorrenze = self._scarica_occorrenze()

        # Raggruppa per titolo esatto: piu' occorrenze con lo stesso titolo
        # sono le diverse date/serate dello stesso festival/rassegna.
        gruppi: dict[str, list[dict]] = {}
        for occ in occorrenze:
            titolo = (occ.get("title") or "").strip()
            if not titolo:
                continue
            gruppi.setdefault(titolo, []).append(occ)

        eventi: List[Evento] = []
        for titolo, occs in gruppi.items():
            occs.sort(key=lambda o: o.get("start_ts") or 0)
            if len(occs) == 1:
                eventi.append(self._evento_singolo(occs[0]))
            else:
                eventi.append(self._evento_festival(titolo, occs))

        logger.info(f"[{self.nome_fonte}] {len(occorrenze)} occorrenze -> {len(eventi)} eventi ({sum(1 for e in eventi if e.is_festival)} festival)")
        return eventi

    # ------------------------------------------------------------------
    def _scarica_occorrenze(self) -> list[dict]:
        # Come per l'API, insistiamo con attese crescenti: un blocco anti-bot
        # temporaneo puo' durare piu' di una singola pausa.
        attese = [0, 3, 8]
        ultimo_errore: Optional[Exception] = None
        for tentativo, attesa in enumerate(attese):
            if attesa:
                time.sleep(attesa)
            try:
                risposta = self.session.get(URL_CALENDARIO, timeout=self.timeout)
                risposta.raise_for_status()
                soup = BeautifulSoup(risposta.text, "html.parser")
                script = soup.select_one("script.saludetrigu-map-events-json")
                if not script or not script.get_text(strip=True):
                    raise ValueError("Blocco JSON 'saludetrigu-map-events-json' non trovato nella pagina calendario")
                try:
                    return json.loads(script.get_text())
                except ValueError as e:
                    raise ValueError(f"JSON eventi non valido nella pagina calendario: {e}") from e
            except (requests.RequestException, ValueError) as e:
                ultimo_errore = e
                corpo = ""
                if "risposta" in locals() and getattr(risposta, "text", None):
                    corpo = risposta.text[:200].replace("\n", " ").strip()
                if "sgcaptcha" in corpo.lower():
                    # Blocco anti-bot attivo sul nostro IP (plugin di sicurezza
                    # dell'hosting): non e' transitorio, riprovare non serve.
                    raise RuntimeError(
                        "Il sito ha bloccato le nostre richieste con una verifica "
                        "anti-bot (captcha di sicurezza dell'hosting). Non e' un problema "
                        "di rete: bisogna aspettare che il blocco scada, oppure aprire "
                        "saludetrigu.it in un browser normale per sbloccare l'IP."
                    ) from e
                if tentativo < len(attese) - 1:
                    logger.warning(f"[{self.nome_fonte}] Errore pagina calendario (tentativo {tentativo + 1}/{len(attese)}): {e}, riprovo...")

        logger.error(f"[{self.nome_fonte}] Errore pagina calendario: {ultimo_errore}")
        raise ultimo_errore

    # ------------------------------------------------------------------
    def _link_programma_completo(self, url_occorrenza: Optional[str]) -> Optional[str]:
        """Apre la pagina di una singola occorrenza e cerca il link 'Vai
        all'evento completo'. Se non lo trova (o la richiesta fallisce),
        restituisce None: chi chiama ricade sull'occorrenza stessa, non e'
        un errore bloccante."""
        if not url_occorrenza:
            return None
        try:
            risposta = self.session.get(url_occorrenza, timeout=self.timeout)
            risposta.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f"[{self.nome_fonte}] Impossibile aprire '{url_occorrenza}' per cercare il link al programma completo: {e}")
            return None

        soup = BeautifulSoup(risposta.text, "html.parser")
        for a in soup.find_all("a", href=True):
            if _RE_EVENTO_COMPLETO.search(a.get_text(strip=True)):
                return urljoin(URL_BASE, a["href"])
        return None

    # ------------------------------------------------------------------
    def _evento_singolo(self, occ: dict) -> Evento:
        data_iso, ora = _data_ora_da_ts(occ.get("start_ts"))
        return Evento(
            titolo=_pulisci_html(occ.get("title")),
            data_inizio=data_iso,
            data_fine=data_iso,
            ora_inizio=ora,
            luogo=occ.get("venue") or None,
            latitudine=occ.get("lat"),
            longitudine=occ.get("lng"),
            url=occ.get("link"),
            immagine=occ.get("thumbnail"),
            fonte=self.nome_fonte,
            dettagli_extra={"categoria_originale_sito": occ.get("category_name")},
        )

    def _evento_festival(self, titolo: str, occs: list[dict]) -> Evento:
        sotto_eventi = []
        for occ in occs:
            data_iso, ora = _data_ora_da_ts(occ.get("start_ts"))
            sotto_eventi.append(SottoEvento(
                titolo=_pulisci_html(occ.get("title")) or titolo,
                data_inizio=data_iso or "",
                data_fine=data_iso or "",
                luogo=occ.get("venue") or "",
                url=occ.get("link") or "",
                immagine=occ.get("thumbnail"),
                ora_inizio=ora,
                latitudine=occ.get("lat"),
                longitudine=occ.get("lng"),
            ))

        primo, ultimo = occs[0], occs[-1]
        data_inizio, _ = _data_ora_da_ts(primo.get("start_ts"))
        data_fine, _ = _data_ora_da_ts(ultimo.get("start_ts"))
        immagine = next((o.get("thumbnail") for o in occs if o.get("thumbnail")), None)

        # Preferiamo la pagina "programma completo" (con TUTTE le date e un
        # vero articolo) al link della singola prima occorrenza, quando
        # disponibile - e' quella che poi il Crawler AI andra' a leggere.
        url_padre = self._link_programma_completo(primo.get("link")) or primo.get("link")
        time.sleep(self.pausa)

        return Evento(
            titolo=_pulisci_html(titolo),
            data_inizio=data_inizio,
            data_fine=data_fine,
            luogo=None,  # il festival attraversa piu' luoghi, i sotto-eventi hanno il proprio
            url=url_padre,
            immagine=immagine,
            fonte=self.nome_fonte,
            is_festival=True,
            sotto_eventi=sotto_eventi,
            dettagli_extra={
                "categoria_originale_sito": primo.get("category_name"),
                "numero_date": len(occs),
            },
        )
