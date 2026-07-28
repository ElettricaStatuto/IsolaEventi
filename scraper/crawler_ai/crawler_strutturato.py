import urllib.request
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
import json
import os
import re
import time
import ssl
from datetime import datetime, timezone

# ------------------------------------------------------------------------------
# REGISTRO CONFIGURAZIONI E REGOLE DI CLASSIFICAZIONE
# ------------------------------------------------------------------------------

PLATFORMS_SOCIAL_COMM = {
    'facebook.com': 'Facebook',
    'fb.com': 'Facebook',
    'instagram.com': 'Instagram',
    'instagr.am': 'Instagram',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'twitter.com': 'Twitter / X',
    'x.com': 'Twitter / X',
    'spotify.com': 'Spotify',
    'tiktok.com': 'TikTok',
    'linkedin.com': 'LinkedIn',
    'vimeo.com': 'Vimeo',
    'soundcloud.com': 'SoundCloud',
    'wa.me': 'WhatsApp',
    'whatsapp.com': 'WhatsApp',
    't.me': 'Telegram',
    'telegram.me': 'Telegram',
    'messenger.com': 'Messenger'
}

KEYWORDS_CONTACTS = ['contatti', 'contattaci', 'contact', 'contacts', 'dove-siamo', 'reach-us', 'email', 'telefono']

KEYWORDS_EVENTS_HIGH = [
    'programma', 'date', 'data', 'calendario', 'orari', 
    'lineup', 'line-up', 'schedule', 'evento', 'eventi', 'events', 
    'concerto', 'concerti', 'shows', 'edizioni', 'edition',
    'spettacolo', 'mostra', 'sagra', 'teatro', 'cinema'
]

KEYWORDS_EVENTS_MED = [
    'story', 'artisti', 'artists', 'tickets', 'biglietti', 
    'luglio', 'agosto', 'settembre', 'july', 'august'
]

NOISE_KEYWORDS = [
    'privacy', 'cookie', 'trasparenza', 'termini', 'terms', 'login', 'cart', 'carrello',
    'accessibilita', 'disservizio', 'assistenza', 'appuntamento', 'uffici', 'governo',
    'salta-al-contenuto', 'dichiarazione', 'albo', 'amministrazione'
]

# ------------------------------------------------------------------------------
# PARSER HTML PER LINK, TITOLI E MEDIA
# ------------------------------------------------------------------------------

class LinkExtractor(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.links = [] # list of (href, text)
        self.current_href = None
        self.current_text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            attr_dict = dict(attrs)
            href = attr_dict.get('href')
            if href:
                self.current_href = urljoin(self.base_url, href)
                self.current_text = []

    def handle_data(self, data):
        if self.current_href:
            self.current_text.append(data.strip())

    def handle_endtag(self, tag):
        if tag == 'a' and self.current_href:
            anchor_text = " ".join([t for t in self.current_text if t])
            self.links.append((self.current_href, anchor_text))
            self.current_href = None
            self.current_text = []

class ReadableContentCleaner(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.title = ""
        self.in_title = False
        self.in_ignored_tag = False
        self.ignored_tags = {'script', 'style', 'head', 'nav', 'footer', 'noscript', 'svg'}
        self.text_parts = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag in self.ignored_tags:
            self.in_ignored_tag = True
        if tag == 'title':
            self.in_title = True
        if tag == 'img':
            src = attr_dict.get('src') or attr_dict.get('data-src')
            if src:
                full_img_url = urljoin(self.base_url, src)
                if full_img_url not in self.images:
                    self.images.append(full_img_url)

    def handle_endtag(self, tag):
        if tag in self.ignored_tags:
            self.in_ignored_tag = False
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif not self.in_ignored_tag:
            cleaned = data.strip()
            if cleaned:
                self.text_parts.append(cleaned)

    def get_readable_text(self):
        return "\n".join(self.text_parts)

# ------------------------------------------------------------------------------
# FUNZIONI DI UTILITÀ E UTILS
# ------------------------------------------------------------------------------

def sanitize_folder_name(name):
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r'\s+', '_', clean).strip('_')
    return clean[:60] if clean else "Evento_Sconosciuto"

def fetch_page_content(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    }
    req = urllib.request.Request(url, headers=headers)
    ssl_context = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        cleaner = ReadableContentCleaner(base_url=url)
        cleaner.feed(html)
        text = cleaner.get_readable_text()
        return {
            "status": "success",
            "title": cleaner.title or "Senza Titolo",
            "word_count": len(text.split()),
            "char_count": len(text),
            "text": text,
            "images": cleaner.images
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e),
            "title": "",
            "word_count": 0,
            "char_count": 0,
            "text": "",
            "images": []
        }

# ------------------------------------------------------------------------------
# ESECUZIONE E INTERFACCIA A TERMINALE
# ------------------------------------------------------------------------------

def run_structured_crawler(target_url, custom_folder_name=None):
    print("=" * 80)
    print("  AVVIO CRAWLER STRUTTURATO WEB")
    print("=" * 80)
    print(f" [1/4] Download pagina iniziale : {target_url}")
    
    main_page_data = fetch_page_content(target_url)
    raw_event_name = main_page_data.get("title") or urlparse(target_url).path.strip('/') or "Evento"
    
    if custom_folder_name:
        output_dir = custom_folder_name
        folder_name = os.path.basename(custom_folder_name)
    else:
        folder_name = sanitize_folder_name(raw_event_name)
        base_dir = os.path.dirname(__file__)
        output_dir = os.path.join(base_dir, folder_name)
    
    print(f" [2/4] Titolo Evento rilevato   : {raw_event_name}")
    os.makedirs(output_dir, exist_ok=True)
    
    print(f" [3/4] Creazione cartella output : {folder_name}")
    print("-" * 80)

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    req = urllib.request.Request(target_url, headers=headers)
    ssl_context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ssl_context) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        
    parser = LinkExtractor(target_url)
    parser.feed(html)
    
    base_domain = urlparse(target_url).netloc.lower()
    
    social_and_contacts = []
    events_and_dates = []
    generic_or_legal = []

    seen_urls = set()

    for href, anchor in parser.links:
        if not href or href in seen_urls:
            continue
        seen_urls.add(href)
        
        parsed_href = urlparse(href)
        href_domain = parsed_href.netloc.lower()
        href_path = parsed_href.path.lower()
        anchor_lower = anchor.lower()

        # Check Social
        is_social = False
        for s_domain, s_name in PLATFORMS_SOCIAL_COMM.items():
            if s_domain in href_domain:
                social_and_contacts.append({
                    "contact_type": s_name,
                    "url": href,
                    "anchor_text": anchor
                })
                is_social = True
                break
        if is_social:
            continue

        # Check Contacts Page
        if any(ck in href_path for ck in KEYWORDS_CONTACTS) or any(ck in anchor_lower for ck in KEYWORDS_CONTACTS):
            social_and_contacts.append({
                "contact_type": "Pagina Contatti",
                "url": href,
                "anchor_text": anchor
            })
            continue

        # Check Noise
        if any(nk in href_path or nk in anchor_lower for nk in NOISE_KEYWORDS):
            generic_or_legal.append({
                "link_type": "Filtro Rumore / Note Legali",
                "url": href,
                "anchor_text": anchor
            })
            continue

        # Check Event relevance
        score = 0
        if any(hk in href_path or hk in anchor_lower for hk in KEYWORDS_EVENTS_HIGH):
            score += 2
        if any(mk in href_path or mk in anchor_lower for mk in KEYWORDS_EVENTS_MED):
            score += 1
        
        if score > 0 or href_domain == base_domain:
            events_and_dates.append({
                "relevance_score": score,
                "url": href,
                "anchor_text": anchor
            })
        else:
            generic_or_legal.append({
                "link_type": "Link Esterno Generico",
                "url": href,
                "anchor_text": anchor
            })

    print(f" [*] Classificazione di {len(seen_urls)} link unici trovati sulla pagina:")
    print(f"     |-- Social & Contatti        : {len(social_and_contacts)} link")
    print(f"     |-- Eventi & Date (Attivi)   : {len(events_and_dates)} link")
    print(f"     |-- Scartati / Legali / Passati: {len(generic_or_legal)} link")
    print("-" * 80)
    print(f" [4/4] Estrazione del testo e immagini dalle {len(events_and_dates)} pagine degli Eventi attivi...")
    print("-" * 80)

    def _fetch_single_item(item):
        item["page_data"] = fetch_page_content(item["url"])
        pdata = item["page_data"]
        label = item.get("anchor_text") or "Senza Etichetta"
        if pdata.get("status") == "success":
            print(f"  [OK] ({pdata.get('word_count', 0):4d} parole, {len(pdata.get('images', [])):2d} img) | '{label[:30]}'")
        return item

    with ThreadPoolExecutor(max_workers=10) as executor:
        list(executor.map(_fetch_single_item, events_and_dates))

    master_database = {
        "crawl_info": {
            "target_url": target_url,
            "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "status": "COMPLETED"
        },
        "event_name": raw_event_name,
        "summary": {
            "total_links_found": len(seen_urls),
            "social_contacts_count": len(social_and_contacts),
            "active_events_count": len(events_and_dates),
            "ignored_links_count": len(generic_or_legal)
        },
        "data": {
            "main_page": main_page_data,
            "social_and_contacts": social_and_contacts,
            "events_and_dates": events_and_dates,
            "ignored_or_legal_links": generic_or_legal
        }
    }

    # 1. Export JSON Master
    with open(os.path.join(output_dir, "database_strutturato.json"), 'w', encoding='utf-8') as f:
        json.dump(master_database, f, ensure_ascii=False, indent=2)

    # 2. Export TXT 01: Social e Contatti
    with open(os.path.join(output_dir, "01_social_e_contatti.txt"), 'w', encoding='utf-8') as f:
        f.write(f"# CANALI SOCIAL E CONTATTI - EVENTO: {raw_event_name}\n")
        f.write(f"# TARGET: {target_url}\n\n")
        for item in social_and_contacts:
            f.write(f"TIPO        : {item['contact_type']}\n")
            f.write(f"URL/TARGET  : {item['url']}\n")
            f.write(f"ETICHETTA   : {item['anchor_text']}\n")
            f.write("-" * 60 + "\n")

    # 3. Export TXT 02: Lista Link Eventi
    with open(os.path.join(output_dir, "02_link_eventi.txt"), 'w', encoding='utf-8') as f:
        f.write(f"# LINK EVENTI E DATE CORRENTI O FUTURI - EVENTO: {raw_event_name}\n\n")
        for item in events_and_dates:
            f.write(f"SCORE: {item['relevance_score']} Pts | URL: {item['url']} | ETICHETTA: '{item['anchor_text']}'\n")

    # 4. Export TXT 03: Testo Estratto dalle Pagine Eventi
    with open(os.path.join(output_dir, "03_testo_eventi_estratto.txt"), 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write(f" REPORT TESTUALE EVENTI - EVENTO: {raw_event_name}\n")
        f.write(f" TARGET: {target_url}\n")
        f.write(f" DATA  : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")

        for idx, item in enumerate(events_and_dates, start=1):
            pdata = item.get("page_data", {})
            f.write("━" * 80 + "\n")
            f.write(f"RECORD #{idx} | SCORE: {item['relevance_score']} Pts\n")
            f.write(f"URL       : {item['url']}\n")
            f.write(f"TITOLO    : {pdata.get('title', 'N/D')}\n")
            f.write(f"PAROLE    : {pdata.get('word_count', 0)}\n")
            f.write(f"IMMAGINI  : {len(pdata.get('images', []))} trovate\n")
            f.write("━" * 80 + "\n")
            f.write("CONTENUTO TESTUALE:\n\n")
            f.write(pdata.get('text', '') + "\n\n")
            
            if pdata.get('images'):
                f.write("IMMAGINI TROVATE:\n")
                for img in pdata.get('images'):
                    f.write(f"  - {img}\n")
                f.write("\n")

    # 5. Export TXT 04: Altri Link Generici
    with open(os.path.join(output_dir, "04_link_generici.txt"), 'w', encoding='utf-8') as f:
        f.write(f"# ALTRI LINK DEL SITO (GENERICI, LEGALI O EVENTI PASSATI)\n\n")
        for item in generic_or_legal:
            f.write(f"TIPO: {item['link_type']} | URL: {item['url']} | ETICHETTA: '{item['anchor_text']}'\n")

    print("=" * 80)
    print(f" SCANSIONE COMPLETATA CON SUCCESSO!")
    print(f" Tutti i file sono stati salvati nella cartella: {folder_name}")
    print("=" * 80)
    print("  1. Database JSON Master    -> database_strutturato.json")
    print("  2. Social & Contatti       -> 01_social_e_contatti.txt")
    print("  3. Lista Link Eventi       -> 02_link_eventi.txt")
    print("  4. Testo Eventi Estratto   -> 03_testo_eventi_estratto.txt")
    print("  5. Link Scartati / Passati -> 04_link_generici.txt")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "https://www.narcaoblues.it/festival-2026/"
    custom_folder = sys.argv[2] if len(sys.argv) > 2 else None
    run_structured_crawler(target, custom_folder)
