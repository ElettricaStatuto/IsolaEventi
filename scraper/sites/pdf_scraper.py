import logging
import os
import re
from pypdf import PdfReader

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from ..base import BaseScraper
from ..models import Evento

logger = logging.getLogger(__name__)

class PdfScraper(BaseScraper):
    def __init__(self, file_path: str):
        super().__init__()
        self.file_path = file_path
        self.nome_fonte = "File PDF"

    def scrapa_eventi(self) -> list[Evento]:
        if not os.path.exists(self.file_path):
            logger.error(f"File PDF non trovato: {self.file_path}")
            return []

        safe_name = os.path.basename(self.file_path)
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('-', '_', '.')).rstrip()

        immagine_path = None
        if fitz is not None:
            logger.info("Tento conversione in immagine della locandina...")
            try:
                doc = fitz.open(self.file_path)
                if len(doc) > 0:
                    page = doc.load_page(0)
                    pix = page.get_pixmap(dpi=150)
                    os.makedirs(os.path.join("data", "event-images"), exist_ok=True)
                    img_filename = f"pdf_img_{safe_name[:30]}.png"
                    img_filepath = os.path.join("data", "event-images", img_filename)
                    pix.save(img_filepath)
                    immagine_path = img_filename
            except Exception as e:
                logger.error(f"Errore nella conversione del PDF in immagine: {e}")

        try:
            import shutil
            os.makedirs(os.path.join("data", "event-pdfs"), exist_ok=True)
            pdf_dest_path = os.path.join("data", "event-pdfs", safe_name)
            shutil.copy2(self.file_path, pdf_dest_path)
            pdf_rel_path = os.path.join("data", "event-pdfs", safe_name).replace("\\", "/")
            dettagli_extra = {"pdf_path": pdf_rel_path}
        except Exception as e:
            logger.error(f"Errore nella copia del PDF: {e}")
            dettagli_extra = {}

        # Usa l'IA per strutturare il PDF
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from ai_analyzer import struttura_eventi_da_pdf
        
        eventi_base = struttura_eventi_da_pdf(self.file_path)
        
        out_eventi = []
        if len(eventi_base) > 1:
            from ..models import SottoEvento
            sotto_eventi = [
                SottoEvento(
                    titolo=eb.get("titolo", "Evento da PDF"),
                    data_inizio=eb.get("data_inizio") or "",
                    data_fine=eb.get("data_fine") or eb.get("data_inizio") or "",
                    luogo=eb.get("luogo")
                ) for eb in eventi_base
            ]
            
            # Find earliest start date and latest end date
            valid_start_dates = [eb.get("data_inizio") for eb in eventi_base if eb.get("data_inizio")]
            valid_end_dates = [eb.get("data_fine") or eb.get("data_inizio") for eb in eventi_base if eb.get("data_fine") or eb.get("data_inizio")]
            
            evento = Evento(
                titolo=f"Programma Eventi: {safe_name.replace('.pdf', '')}",
                data_inizio=min(valid_start_dates) if valid_start_dates else None,
                data_fine=max(valid_end_dates) if valid_end_dates else None,
                luogo=eventi_base[0].get("luogo") if eventi_base else None,
                url=f"/api/event-pdfs/{safe_name}",
                descrizione="",
                immagine=immagine_path,
                fonte=self.nome_fonte,
                is_festival=True,
                sotto_eventi=sotto_eventi,
                dettagli_extra=dettagli_extra
            )
            out_eventi.append(evento)
        else:
            for eb in eventi_base:
                evento = Evento(
                    titolo=eb.get("titolo", "Evento da PDF"),
                    data_inizio=eb.get("data_inizio"),
                    data_fine=eb.get("data_fine"),
                    luogo=eb.get("luogo"),
                    url=f"/api/event-pdfs/{safe_name}",
                    descrizione="", 
                    immagine=immagine_path,
                    fonte=self.nome_fonte,
                    dettagli_extra=dettagli_extra
                )
                out_eventi.append(evento)

        if not out_eventi:
             # Fallback
             evento = Evento(
                 titolo=os.path.basename(self.file_path),
                 url=f"/api/event-pdfs/{safe_name}",
                 immagine=immagine_path,
                 fonte=self.nome_fonte,
                 dettagli_extra=dettagli_extra
             )
             out_eventi.append(evento)

        return out_eventi
