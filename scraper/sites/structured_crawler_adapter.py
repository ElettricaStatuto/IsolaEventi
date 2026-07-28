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


class StructuredCrawlerScraper(BaseScraper):
    """
    Adapter per collegare crawler_strutturato.py e estrai_schema_locandina_ai_con_llm.py
    al nostro sistema di Eventi / SottoEventi per l'interfaccia Admin e Render.
    """

    def __init__(self, target_url: str, max_links: int = 70):
        super().__init__()
        self.target_url = target_url.strip()
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
        figli = eventi_list[1:] if len(eventi_list) > 1 else []

        # 3. Converti i figli in oggetti SottoEvento
        sotto_eventi_list: List[SottoEvento] = []
        for f in figli:
            imgs = f.get("approfondimenti_extra", {}).get("immagine") or f.get("immagine")
            se = SottoEvento(
                titolo=f.get("titolo", "Sotto-evento"),
                data_inizio=f.get("data_inizio", ""),
                data_fine=f.get("data_fine", ""),
                date_testuali=f.get("date_testuali") or f.get("data_inizio", ""),
                luogo=f.get("luogo", padre.get("luogo", "")),
                url=f.get("url", self.target_url),
                descrizione=f.get("descrizione") or f.get("testo_estratto", ""),
                immagine=imgs
            )
            sotto_eventi_list.append(se)

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
            immagine=padre.get("immagine"),
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
