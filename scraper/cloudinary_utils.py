"""
Upload delle immagini eventi su Cloudinary, condiviso da tutti gli
scraper (prima esisteva solo dentro structured_crawler_adapter.py, usato
solo dal crawler AI su singola URL - lo scraper automatico principale
(scraper_runner.py) non lo richiamava affatto e salvava tutto sul disco
locale di Render, che si azzera ad ogni deploy).
"""
import logging
import os

logger = logging.getLogger(__name__)


def cloudinary_configurato() -> bool:
    return bool(
        os.environ.get("CLOUDINARY_CLOUD_NAME")
        and os.environ.get("CLOUDINARY_API_KEY")
        and os.environ.get("CLOUDINARY_API_SECRET")
    )


def carica_su_cloudinary(sorgente: str | None, folder: str = "isola-eventi") -> str | None:
    """Carica un'immagine su Cloudinary a partire da un URL remoto o un
    percorso locale, e ritorna l'URL sicuro risultante. Se Cloudinary non
    e' configurato, o l'upload fallisce, ritorna la sorgente originale
    invariata - mai un errore che blocca lo scraping."""
    if not sorgente:
        return sorgente
    if isinstance(sorgente, str) and "cloudinary.com" in sorgente:
        return sorgente  # gia' su Cloudinary, niente da fare
    if not cloudinary_configurato():
        return sorgente

    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
            api_key=os.environ["CLOUDINARY_API_KEY"],
            api_secret=os.environ["CLOUDINARY_API_SECRET"],
        )
        res = cloudinary.uploader.upload(
            sorgente,
            folder=folder,
            transformation=[
                {"width": 800, "height": 1000, "crop": "limit"},
                {"quality": "auto:eco", "fetch_format": "auto"},
            ],
        )
        cloud_url = res.get("secure_url")
        if cloud_url:
            logger.info(f"Immagine caricata su Cloudinary: {sorgente} -> {cloud_url}")
            return cloud_url
        return sorgente
    except Exception as e:
        logger.warning(f"Impossibile caricare '{sorgente}' su Cloudinary: {e}")
        return sorgente
