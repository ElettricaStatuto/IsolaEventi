"""
Scraper per eventiinsardegna.it

Struttura HTML (The Events Calendar / WordPress):
- Container: <article class="tribe-events-calendar-list__event ...">
- Titolo: <h4 class="tribe-events-calendar-list__event-title"><a href="URL">Titolo</a></h4>
- Data: <time datetime="YYYY-MM-DD"> o testo in <span class="tribe-event-date-start">
- Luogo: <span class="tribe-events-calendar-list__event-venue"> o dal testo
- Immagine: <img class="tribe-events-calendar-list__event-featured-image" src="URL">
- Paginazione: ?eventDate=YYYY-MM o ?tribe-bar-date=YYYY-MM
"""
import logging
import re
from datetime import datetime
from typing import List, Optional
from urllib.parse import urljoin

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

URL_BASE = "https://www.eventiinsardegna.it"
URL_EVENTI = "https://www.eventiinsardegna.it/eventi/"


class EventiInSardegnaScraper(BaseScraper):
    nome_fonte = "eventiinsardegna.it"
    url_base = URL_BASE

    def scrapa_eventi(self, max_pagine: int = 5) -> List[Evento]:
        eventi = []
        
        # Definiamo i target da scaricare
        targets = [
            ("https://www.eventiinsardegna.it/eventi/", "events_calendar"),
            ("https://www.eventiinsardegna.it/tag/alghero/", "wordpress_tag"),
            ("https://www.eventiinsardegna.it/tag/cagliari/", "wordpress_tag"),
            ("https://www.eventiinsardegna.it/tag/eventi-centro-sardegna/", "wordpress_tag"),
            ("https://www.eventiinsardegna.it/agosto/", "wordpress_tag")
        ]
        
        # Set per evitare duplicati all'interno della stessa sessione di scraping
        urls_visti = set()

        for base_url, mode in targets:
            logger.info(f"[{self.nome_fonte}] Avvio scraping target: {base_url} ({mode})")
            
            for pagina in range(1, max_pagine + 1):
                if mode == "events_calendar":
                    url = base_url if pagina == 1 else f"{base_url}?tribe_paged={pagina}"
                else: # wordpress_tag
                    url = base_url if pagina == 1 else f"{base_url}page/{pagina}/"
                
                soup = self.get_pagina(url)
                if soup is None:
                    break

                nuovi = 0
                if mode == "events_calendar":
                    articles = soup.find_all("article", class_="tribe-events-calendar-list__event")
                    for article in articles:
                        evento = self._parse_article(article)
                        if evento and evento.url not in urls_visti:
                            eventi.append(evento)
                            urls_visti.add(evento.url)
                            nuovi += 1
                else: # wordpress_tag
                    posts = soup.find_all(class_="bs-blog-post")
                    for post in posts:
                        evento = self._parse_wordpress_post(post)
                        if evento and evento.url not in urls_visti:
                            eventi.append(evento)
                            urls_visti.add(evento.url)
                            nuovi += 1

                logger.info(f"[{self.nome_fonte}] Target {base_url} - Pagina {pagina}: {nuovi} eventi")
                if nuovi == 0:
                    break

        return eventi

    def _parse_wordpress_post(self, post) -> Optional[Evento]:
        title_tag = post.select_one("h4.title a")
        if not title_tag:
            return None
            
        titolo = title_tag.get_text(strip=True)
        url = title_tag.get("href")
        if not titolo or not url:
            return None
            
        url = urljoin(self.url_base, url)
        
        # Estrazione immagine (cerchiamo background-image nel div.bs-blog-thumb)
        immagine = None
        thumb_div = post.select_one(".bs-blog-thumb")
        if thumb_div:
            style = thumb_div.get("style", "")
            img_match = re.search(r"url\(['\"]?([^'\")]+)['\"]?\)", style)
            if img_match:
                immagine = img_match.group(1)
                
        # Descrizione
        desc_tag = post.select_one("p")
        descrizione = None
        if desc_tag:
            descrizione = desc_tag.get_text(separator=" ", strip=True)[:400]
            
        # Estrazione date dal tag time
        data_inizio = None
        time_tag = post.select_one("time")
        if time_tag:
            raw_time = time_tag.get_text(strip=True)
            # Formato GG/MM/AAAA
            date_match = re.match(r"(\d{2})/(\d{2})/(\d{4})", raw_time)
            if date_match:
                d, m, y = date_match.groups()
                data_inizio = f"{y}-{m}-{d}"
            else:
                # Formato YYYY-MM-DD
                iso_match = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw_time)
                if iso_match:
                    data_inizio = iso_match.group(0)
                    
        if not data_inizio:
            data_inizio = datetime.now().strftime("%Y-%m-%d")

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            data_fine=data_inizio,
            luogo=None,
            url=url,
            descrizione=descrizione,
            immagine=immagine,
            fonte=self.nome_fonte,
        )

    def _parse_article(self, article) -> Optional[Evento]:
        # --- Titolo & URL ---
        title_h4 = article.select_one(".tribe-events-calendar-list__event-title")
        if not title_h4:
            return None

        a = title_h4.find("a")
        if not a:
            return None

        titolo = a.get_text(strip=True)
        if not titolo:
            return None

        url = a.get("href")
        if url:
            url = urljoin(self.url_base, url)

        # --- Data ---
        data_inizio, data_fine = self._estrai_date(article)

        # --- Luogo ---
        luogo = self._estrai_luogo(article)

        # --- Immagine ---
        immagine = self._estrai_immagine(article)

        # --- Descrizione ---
        desc_tag = article.select_one(".tribe-events-calendar-list__event-description")
        descrizione = None
        if desc_tag:
            descrizione = desc_tag.get_text(separator=" ", strip=True)[:400]

        return Evento(
            titolo=titolo,
            data_inizio=data_inizio,
            data_fine=data_fine,
            luogo=luogo,
            url=url,
            descrizione=descrizione,
            immagine=immagine,
            fonte=self.nome_fonte,
        )

    def _estrai_date(self, article) -> tuple[Optional[str], Optional[str]]:
        """
        Estrae data inizio e fine dall'articolo.
        Cerca <time datetime="YYYY-MM-DD"> o span con testo data.
        """
        # 1) Prova <time datetime="...">
        time_tag = article.select_one("time[datetime]")
        if time_tag:
            raw = time_tag.get("datetime", "").strip()
            # Può essere "2026-06-25" o "2026-06-25 10:00:00"
            m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
            if m:
                data = m.group(1)
                return data, None

        # 2) Prova span con classe data
        date_span = article.select_one(".tribe-event-date-start, .tribe-event-date-start-datetime")
        if date_span:
            raw = date_span.get_text(strip=True)
            data = self._parse_data_testo(raw)
            if data:
                return data, None

        # 3) Prova nel testo del titolo o meta
        meta = article.select_one(".tribe-events-calendar-list__event-meta")
        if meta:
            raw = meta.get_text(strip=True)
            data = self._parse_data_testo(raw)
            if data:
                return data, None

        return None, None

    def _parse_data_testo(self, raw: str) -> Optional[str]:
        """Tenta di parsare date tipo '25 Giugno 2026' o '25 June 2026'."""
        if not raw:
            return None

        # Pattern: "25 Giugno 2026" o "25 June 2026"
        m = re.search(r"(\d{1,2})\s+([A-Za-z\u00E0-\u00FF]+)\s+(\d{4})", raw)
        if m:
            giorno, mese_nome, anno = m.groups()
            mese_num = self._mese_it_a_numero(mese_nome)
            if mese_num:
                return f"{anno}-{mese_num}-{int(giorno):02d}"

        # Pattern ISO diretto
        m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
        if m:
            return m.group(1)

        return None

    @staticmethod
    def _mese_it_a_numero(mese: str) -> Optional[str]:
        mesi = {
            "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
            "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
            "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12",
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12",
        }
        return mesi.get(mese.lower().strip())

    def _estrai_luogo(self, article) -> Optional[str]:
        """Estrae il luogo/venue dall'articolo.
        Priorità: 1) span venue-title (nome pulito), 2) link venue, 3) container."""
        # 1) Span con il nome del venue (senza indirizzo) — il più affidabile
        venue_title = article.select_one(".tribe-events-calendar-list__event-venue-title")
        if venue_title:
            name = venue_title.get_text(strip=True)
            if name:
                return name

        # 2) Link venue — nome del luogo
        venue_link = article.select_one(
            ".tribe-events-venue-details a, .tribe-events-calendar-list__event-venue a"
        )
        if venue_link:
            name = venue_link.get_text(strip=True)
            if name:
                return name

        # 3) Container venue completo — estrai solo il nome
        venue = article.select_one(".tribe-events-calendar-list__event-venue")
        if venue:
            raw = venue.get_text(separator=" ", strip=True)
            # Rimuovi label "Luogo:" se presente
            raw = re.sub(r"^\s*Luogo\s*[:\-]?\s*", "", raw, flags=re.IGNORECASE)
            raw = self._pulisci_luogo(raw)
            if raw:
                return raw

        return None

    @staticmethod
    def _pulisci_luogo(raw: str) -> Optional[str]:
        """Pulisce stringhe luogo con nomi duplicati o trailing address."""
        if not raw:
            return None

        # Cerca duplicazione: "Serramanna Serramanna, Italy" → "Serramanna"
        # Pattern: "Nome Luogo" seguito da spazio e stesso nome (con/senza virgola)
        m = re.match(r"([A-Z\u00C0-\u00FF][a-z\u00E0-\u00FF\s']+?)\s+\1", raw)
        if m:
            return m.group(1).strip()

        # Se c'è una virgola e il testo dopo inizia con lo stesso nome, prendi solo il nome
        if "," in raw:
            parts = raw.split(",")
            first = parts[0].strip()
            rest = ",".join(parts[1:]).strip()
            if rest.startswith(first) or "Italy" in raw or "Sardegna" in raw or len(parts) > 2:
                return first

        return raw

    def _estrai_immagine(self, article) -> Optional[str]:
        """Estrae l'immagine in evidenza dell'evento."""
        img = article.select_one(".tribe-events-calendar-list__event-featured-image")
        if img:
            src = img.get("src") or img.get("data-src")
            if src and not src.startswith("data:"):
                return urljoin(self.url_base, src)

        # Fallback: qualsiasi img nel wrapper immagine
        wrapper = article.select_one(".tribe-events-calendar-list__event-featured-image-wrapper")
        if wrapper:
            for img in wrapper.find_all("img"):
                src = img.get("src") or img.get("data-src")
                if src and not src.startswith("data:"):
                    return urljoin(self.url_base, src)

        return None
