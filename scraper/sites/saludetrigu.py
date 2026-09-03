"""
Scraper per saludetrigu.it (Camera di Commercio di Sassari, eventi Nord Sardegna)
via la REST API pubblica di "The Events Calendar" (plugin WordPress).

Niente parsing HTML: il sito espone /wp-json/tribe/events/v1/events con dati
gia' strutturati (titolo, date/orari precisi, venue con coordinate GPS, immagine,
costo, sito web) - molto piu' affidabile di uno scraping di pagina.

Ogni singolo evento appartenente a un festival/rassegna riporta in descrizione
un link "Vai all'evento completo" verso la pagina generale del festival
(un post WordPress normale, non un evento). Usiamo quel link come chiave per
raggruppare le serate/date sparse in un unico Evento Padre con i suoi
Sotto-eventi, invece di lasciarle come voci scollegate.
"""
import logging
import re
import time
from typing import List, Optional
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

from ..base import BaseScraper
from ..models import Evento, SottoEvento

logger = logging.getLogger(__name__)

API_URL = "https://saludetrigu.it/wp-json/tribe/events/v1/events"
POSTS_API_URL = "https://saludetrigu.it/wp-json/wp/v2/posts"
PER_PAGE = 50
MAX_PAGINE = 40  # rete di sicurezza anti-loop, non un limite di business (oggi il sito ha ~29 pagine)

# Il sito e' multilingua (Polylang): la stessa API restituisce ogni evento
# ripetuto in IT/EN/ES/FR come voci separate, distinguibili solo dal prefisso
# nell'URL (/en/evento/..., /es/evento/..., /fr/evento/...). Teniamo solo
# l'italiano (nessun prefisso) per non importare 3-4 doppioni per evento.
_PREFISSI_LINGUA_DA_SCARTARE = ("/en/", "/es/", "/fr/")

_RE_EVENTO_COMPLETO = re.compile(r'href="([^"]+)">\s*Vai all.?evento completo', re.IGNORECASE)


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


def _estrai_link_evento_completo(descrizione_html: Optional[str], url_base: str) -> Optional[str]:
    if not descrizione_html:
        return None
    m = _RE_EVENTO_COMPLETO.search(descrizione_html)
    if not m:
        return None
    return urljoin(url_base, m.group(1))


class SaludeTriguScraper(BaseScraper):
    nome_fonte = "saludetrigu.it"
    url_base = "https://saludetrigu.it"

    def scrapa_eventi(self) -> List[Evento]:
        eventi: List[Evento] = []
        link_festival: dict[int, str] = {}  # indice in `eventi` -> link "evento completo"
        pagina = 1
        totale_pagine = None

        while pagina <= MAX_PAGINE and (totale_pagine is None or pagina <= totale_pagine):
            dati = None
            # Sulla prima pagina insistiamo di piu' e con attese crescenti: un
            # blocco anti-bot temporaneo (es. sfida Cloudflare) puo' durare
            # piu' della singola pausa standard tra le pagine.
            attese = [0, 3, 8] if pagina == 1 else [0]
            ultimo_errore: Optional[Exception] = None
            for tentativo, attesa in enumerate(attese):
                if attesa:
                    time.sleep(attesa)
                try:
                    risposta = self.session.get(
                        API_URL, params={"per_page": PER_PAGE, "page": pagina}, timeout=self.timeout
                    )
                    risposta.raise_for_status()
                    try:
                        dati = risposta.json()
                    except ValueError as e:
                        # Risposta 200 ma non-JSON: spesso una pagina di sfida
                        # anti-bot invece dei dati veri. Includiamo un estratto
                        # del corpo cosi' l'errore nel log e' diagnosticabile.
                        estratto = risposta.text[:200].replace("\n", " ").strip()
                        if "sgcaptcha" in estratto.lower():
                            # Blocco anti-bot attivo sul nostro IP (plugin di
                            # sicurezza dell'hosting, non Cloudflare): non e'
                            # transitorio come un errore di rete, riprovare
                            # subito non serve a nulla. Falliamo rapidamente
                            # con un messaggio chiaro invece di consumare le
                            # attese di retry per niente.
                            raise RuntimeError(
                                "Il sito ha bloccato le nostre richieste con una verifica "
                                "anti-bot (captcha di sicurezza dell'hosting). Non e' un problema "
                                "di rete: bisogna aspettare che il blocco scada, oppure aprire "
                                "saludetrigu.it in un browser normale per sbloccare l'IP."
                            ) from e
                        raise ValueError(f"{e} — corpo risposta: {estratto!r}") from e
                    break
                except (requests.RequestException, ValueError) as e:
                    ultimo_errore = e
                    if tentativo < len(attese) - 1:
                        logger.warning(f"[{self.nome_fonte}] Errore pagina {pagina} (tentativo {tentativo + 1}/{len(attese)}): {e}, riprovo...")

            if dati is None:
                logger.error(f"[{self.nome_fonte}] Errore pagina {pagina}: {ultimo_errore}")
                if pagina == 1:
                    # Se fallisce gia' la prima pagina non abbiamo nessun dato:
                    # rilanciamo per far comparire l'errore nel log dell'admin,
                    # invece di restituire silenziosamente una lista vuota che
                    # sembra "nessun evento" invece di "errore di rete".
                    raise ultimo_errore
                break

            totale_pagine = dati.get("total_pages", pagina)
            grezzi = dati.get("events", [])
            if not grezzi:
                break

            for ev in grezzi:
                evento = self._mappa_evento(ev)
                if evento:
                    link = _estrai_link_evento_completo(ev.get("description"), self.url_base)
                    if link:
                        link_festival[len(eventi)] = link
                    eventi.append(evento)

            logger.info(f"[{self.nome_fonte}] pagina {pagina}/{totale_pagine}: {len(grezzi)} eventi")
            pagina += 1
            time.sleep(self.pausa)

        return self._raggruppa_festival(eventi, link_festival)

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

    def _raggruppa_festival(self, eventi: List[Evento], link_festival: dict[int, str]) -> List[Evento]:
        """Raggruppa le serate che condividono lo stesso link 'evento completo'
        in un unico Evento Padre (is_festival=True) con i suoi Sotto-eventi.
        Gli eventi senza link, o i cui link compaiono una sola volta, restano
        voci indipendenti cosi' come sono.
        """
        gruppi: dict[str, list[int]] = {}
        for idx, link in link_festival.items():
            gruppi.setdefault(link, []).append(idx)

        indici_raggruppati: set[int] = set()
        padri: List[Evento] = []

        for link, indici in gruppi.items():
            if len(indici) < 2:
                continue  # una sola data: non e' un vero festival, la lasciamo com'e'

            indici_raggruppati.update(indici)
            figli = [eventi[i] for i in indici]
            padre = self._costruisci_padre_festival(link, figli)
            if padre:
                padri.append(padre)
            else:
                # Se non riusciamo a costruire il padre, non perdiamo i dati:
                # lasciamo le serate come voci indipendenti.
                indici_raggruppati.difference_update(indici)

        risultato = padri + [ev for i, ev in enumerate(eventi) if i not in indici_raggruppati]
        return risultato

    def _costruisci_padre_festival(self, link_completo: str, figli: List[Evento]) -> Optional[Evento]:
        slug = urlparse(link_completo).path.strip("/").split("/")[-1]
        titolo_padre = None
        descrizione_padre = None
        immagine_padre = None

        try:
            risposta = self.session.get(
                POSTS_API_URL, params={"slug": slug, "_embed": 1}, timeout=self.timeout
            )
            risposta.raise_for_status()
            risultati = risposta.json()
            if risultati:
                post = risultati[0]
                titolo_padre = _pulisci_html(post.get("title", {}).get("rendered"))
                descrizione_padre = (
                    _pulisci_html(post.get("excerpt", {}).get("rendered"))
                    or _pulisci_html(post.get("content", {}).get("rendered"))
                )
                media = (post.get("_embedded") or {}).get("wp:featuredmedia") or []
                if media:
                    immagine_padre = media[0].get("source_url")
        except (requests.RequestException, ValueError) as e:
            logger.warning(f"[{self.nome_fonte}] Impossibile recuperare la pagina festival '{slug}': {e}")

        if not titolo_padre:
            titolo_padre = slug.replace("-", " ").strip().title()

        date_inizio = sorted(f.data_inizio for f in figli if f.data_inizio)
        date_fine = sorted((f.data_fine or f.data_inizio) for f in figli if (f.data_fine or f.data_inizio))

        sotto_eventi = [
            SottoEvento(
                titolo=f.titolo,
                data_inizio=f.data_inizio or "",
                data_fine=f.data_fine or f.data_inizio or "",
                luogo=f.luogo,
                url=f.url,
                descrizione=f.descrizione,
                immagine=f.immagine,
                ora_inizio=f.ora_inizio,
                ora_fine=f.ora_fine,
                is_ingresso_gratuito=f.is_ingresso_gratuito,
                link_biglietti=f.link_biglietti,
                latitudine=f.latitudine,
                longitudine=f.longitudine,
            )
            for f in figli
        ]

        return Evento(
            titolo=titolo_padre,
            data_inizio=date_inizio[0] if date_inizio else None,
            data_fine=date_fine[-1] if date_fine else None,
            luogo=None,  # il festival attraversa piu' luoghi, i sotto-eventi hanno il proprio
            url=link_completo,
            descrizione=descrizione_padre,
            immagine=immagine_padre or next((f.immagine for f in figli if f.immagine), None),
            fonte=self.nome_fonte,
            is_festival=True,
            sotto_eventi=sotto_eventi,
            dettagli_extra={"evento_completo_url": link_completo, "numero_date": len(figli)},
        )
