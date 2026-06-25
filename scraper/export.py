import csv
import json
import logging
from pathlib import Path
from typing import List

from .models import Evento

logger = logging.getLogger(__name__)


def esporta_json(eventi: List[Evento], percorso: str = "eventi_sardegna.json") -> Path:
    path = Path(percorso)
    dati = [e.to_dict() for e in eventi]
    path.write_text(json.dumps(dati, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Esportati {len(eventi)} eventi in {path}")
    return path


def esporta_csv(eventi: List[Evento], percorso: str = "eventi_sardegna.csv") -> Path:
    path = Path(percorso)
    if not eventi:
        logger.warning("Nessun evento da esportare in CSV.")
        return path

    campi = list(eventi[0].to_dict().keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=campi)
        writer.writeheader()
        for e in eventi:
            writer.writerow(e.to_dict())

    logger.info(f"Esportati {len(eventi)} eventi in {path}")
    return path
