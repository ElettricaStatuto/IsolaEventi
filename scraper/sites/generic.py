import logging
import re
from urllib.parse import urlparse, urljoin
import html2text
from concurrent.futures import ThreadPoolExecutor

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

class GenericUrlScraper(BaseScraper):
    def __init__(self, target_url: str, max_links: int = 70):
        super().__init__()
        self.target_url = target_url
        self.max_links = max_links
        parsed = urlparse(target_url)
        self.nome_fonte = parsed.netloc.replace("www.", "")
        self.url_base = f"{parsed.scheme}://{parsed.netloc}"
        
        # Inizializza html2text
        self.h2t = html2text.HTML2Text()
        self.h2t.ignore_links = False
        self.h2t.ignore_images = True
        self.h2t.ignore_tables = False
        self.h2t.body_width = 0

    def fetch_subpage(self, url: str) -> tuple[str, str]:
        soup = self.get_pagina(url)
        if not soup:
            return url, ""
            
        # Rimuovi roba inutile
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe"]):
            tag.decompose()
            
        return url, self.h2t.handle(str(soup))

    def scrapa_eventi(self) -> list[Evento]:
        soup = self.get_pagina(self.target_url)
        if not soup:
            logger.error(f"Impossibile scaricare la pagina {self.target_url}")
            return []

        # Cerca il titolo prima di decomporre l'header
        titolo = ""
        h1 = soup.find("h1")
        if h1:
            titolo = h1.get_text(strip=True)
        else:
            title_tag = soup.find("title")
            if title_tag:
                titolo = title_tag.get_text(strip=True)
        if not titolo:
            titolo = "Evento da URL"

        # Trova l'immagine
        immagine = None
        og_img = soup.find("meta", property="og:image")
        if og_img and og_img.get("content"):
            immagine = og_img.get("content")

        # Rimuovi elementi inutili per html2text
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe"]):
            tag.decompose()

        # Genera il testo della pagina principale
        main_text = self.h2t.handle(str(soup))
        main_text = re.sub(r'\n{3,}', '\n\n', main_text)
        
        full_text = f"=== Contenuto pagina principale ({self.target_url}) ===\n" + main_text + "\n\n"
        
        # Estrai i link dalla pagina principale per fare deep scraping
        links_found = set()
        links_to_visit = []
        
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Normalizza link
            full_url = urljoin(self.target_url, href)
            # Rimuovi ancore
            full_url = full_url.split('#')[0]
            
            # Filtri Smart
            # 1. Stesso dominio
            if urlparse(full_url).netloc != urlparse(self.target_url).netloc:
                continue
            # 2. Ignora la pagina stessa
            if full_url == self.target_url:
                continue
            # 3. Filtri negativi
            lower_url = full_url.lower()
            if any(x in lower_url for x in ['privacy', 'cookie', 'tag', 'category', 'author', 'login', 'cart', 'checkout']):
                continue
            
            if full_url not in links_found:
                links_found.add(full_url)
                # Prioritizza link con numeri o date (probabilmente eventi)
                has_numbers = bool(re.search(r'\d+', lower_url))
                links_to_visit.append((has_numbers, full_url))
        
        # Ordina per dare priorità a quelli con numeri (più probabili siano eventi specifici)
        links_to_visit.sort(key=lambda x: x[0], reverse=True)
        
        # Prendi solo i primi max_links
        urls_to_fetch = [u[1] for u in links_to_visit[:self.max_links]]
        
        if urls_to_fetch:
            print(f"[{self.nome_fonte}] Trovati {len(urls_to_fetch)} link utili. Inizio deep-scraping...")
            with ThreadPoolExecutor(max_workers=5) as executor:
                results = executor.map(self.fetch_subpage, urls_to_fetch)
                for url, testo_sub in results:
                    if testo_sub.strip():
                        testo_pulito = re.sub(r'\n{3,}', '\n\n', testo_sub)
                        full_text += f"=== Contenuto estratto da: {url} ===\n{testo_pulito}\n\n"
        
        # Salvataggio debug
        try:
            import os
            os.makedirs(os.path.join("data", "raw_texts"), exist_ok=True)
            safe_name = "".join(c for c in self.target_url if c.isalnum() or c in ('-', '_')).rstrip()
            file_path = os.path.join("data", "raw_texts", f"{safe_name[:50]}_scraped.txt")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(full_text)
        except Exception as e:
            logger.warning(f"Impossibile salvare il testo grezzo: {e}")

        evento = Evento(
            titolo=titolo,
            data_inizio=None,
            luogo=None,
            url=self.target_url,
            descrizione=full_text,
            immagine=immagine,
            fonte=self.nome_fonte
        )

        return [evento]
