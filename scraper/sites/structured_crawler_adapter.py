import os
import json
import logging
from urllib.parse import urlparse
from typing import List

from ..base import BaseScraper
from ..models import Evento, SottoEvento
from ..crawler_ai.crawler_strutturato import run_structured_crawler, sanitize_folder_name
from ..crawler_ai.estrai_schema_locandina_ai_con_llm import genera_database_relazionale_con_llm

logger = logging.getLogger(__name__)


def ensure_cloudinary_image(url: str | None) -> str | None:
    if not url or not isinstance(url, str) or not url.startswith("http") or "cloudinary.com" in url:
        return url
    
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = os.environ.get("CLOUDINARY_API_KEY")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")

    if not (cloud_name and api_key and api_secret):
        return url

    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret
        )
        res = cloudinary.uploader.upload(
            url,
            folder="isola-eventi",
            transformation=[
                {"width": 1200, "crop": "limit"},
                {"quality": "auto", "fetch_format": "auto"}
            ]
        )
        cloud_url = res.get("secure_url")
        if cloud_url:
            logger.info(f"Immagine caricata su Cloudinary: {url} -> {cloud_url}")
            return cloud_url
        return url
    except Exception as e:
        logger.warning(f"Impossibile caricare immagine {url} su Cloudinary: {e}")
        return url


class StructuredCrawlerScraper(BaseScraper):
    """
    Adapter per collegare crawler_strutturato.py e estrai_schema_locandina_ai_con_llm.py
    al nostro sistema di Eventi / SottoEventi per l'interfaccia Admin e Render.
    """

    def __init__(self, target_url: str, max_links: int = 70):
        super().__init__()
        url_str = target_url.strip()
        if not url_str.startswith("http://") and not url_str.startswith("https://"):
            url_str = f"https://{url_str}"
        self.target_url = url_str
        self.max_links = max_links
        parsed = urlparse(self.target_url)
        self.nome_fonte = parsed.netloc.replace("www.", "")
        self.url_base = f"{parsed.scheme}://{parsed.netloc}"

    def scrapa_eventi(self) -> List[Evento]:
        logger.info(f"[{self.nome_fonte}] Avvio Crawler Strutturato su {self.target_url}...")
        
        # 1. Esegui il crawler strutturato
        folder_name = sanitize_folder_name(urlparse(self.target_url).path.strip('/') or "Evento")
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.path.join(base_dir, "crawler_ai", folder_name)
        
        run_structured_crawler(self.target_url, custom_folder_name=output_dir)

        # 2. Esegui l'arricchimento semantico con LLM Gemini
        try:
            genera_database_relazionale_con_llm(output_dir)
        except Exception as e:
            logger.error(f"[{self.nome_fonte}] Errore durante generazione LLM: {e}")

        rel_json_path = os.path.join(output_dir, "08_database_relazionale_eventi_LLM.json")
        if not os.path.exists(rel_json_path):
            logger.warning(f"[{self.nome_fonte}] Arricchimento LLM non ha prodotto JSON, fallback a GenericUrlScraper")
            from .generic import GenericUrlScraper
            return GenericUrlScraper(self.target_url, max_links=self.max_links).scrapa_eventi()

        with open(rel_json_path, 'r', encoding='utf-8') as f:
            rel_db = json.load(f)

        eventi_list = rel_db.get("eventi", [])
        if not eventi_list:
            from .generic import GenericUrlScraper
            return GenericUrlScraper(self.target_url, max_links=self.max_links).scrapa_eventi()

        padre = eventi_list[0]
        if not padre.get("testo_estratto") and not padre.get("descrizione"):
            logger.warning(f"[{self.nome_fonte}] Dati evento padre insufficienti, fallback a GenericUrlScraper")
            from .generic import GenericUrlScraper
            return GenericUrlScraper(self.target_url, max_links=self.max_links).scrapa_eventi()

        figli = eventi_list[1:] if len(eventi_list) > 1 else []

        # 3. Converti i figli in oggetti SottoEvento
        sotto_eventi_list: List[SottoEvento] = []
        for f in figli:
            raw_img = f.get("approfondimenti_extra", {}).get("immagine") or f.get("immagine")
            cloud_img = ensure_cloudinary_image(raw_img)
            se = SottoEvento(
                titolo=f.get("titolo", "Sotto-evento"),
                data_inizio=f.get("data_inizio", ""),
                data_fine=f.get("data_fine", ""),
                date_testuali=f.get("date_testuali") or f.get("data_inizio", ""),
                luogo=f.get("luogo", padre.get("luogo", "")),
                url=f.get("url", self.target_url),
                descrizione=f.get("descrizione") or f.get("testo_estratto", ""),
                immagine=cloud_img
            )
            sotto_eventi_list.append(se)

        parent_cloud_img = ensure_cloudinary_image(padre.get("immagine"))

        # 4. Crea l'oggetto Evento principale (Padre/Festival)
        evento_padre_obj = Evento(
            titolo=padre.get("titolo", "Festival / Rassegna"),
            data_inizio=padre.get("data_inizio"),
            data_fine=padre.get("data_fine"),
            luogo=padre.get("luogo"),
            descrizione=padre.get("testo_estratto") or padre.get("descrizione"),
            url=self.target_url,
            fonte=self.nome_fonte,
            categoria=padre.get("categoria", "Festival"),
            immagine=parent_cloud_img,
            is_festival=True,
            sotto_eventi=sotto_eventi_list,
            dettagli_extra={
                "crawler_relazionale": True,
                "totale_sotto_eventi": len(sotto_eventi_list),
                "is_ingresso_gratuito": padre.get("is_ingresso_gratuito", False),
                "tags": padre.get("tags", []),
                "artisti": padre.get("artisti", []),
                "bio_artisti": padre.get("bio_artisti", [])
            }
        )

        return [evento_padre_obj]
