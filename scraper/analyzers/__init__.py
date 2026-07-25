"""
Package analyzers: moduli dedicati all'analisi AI degli eventi in Sardegna.
"""

from .pdf_analyzer import struttura_eventi_da_pdf
from .extractor_analyzer import extract_sub_events_from_program
from .standard_analyzer import analyze_standard_event, extract_text_from_url


def analyze_event(ev_dict: dict, target: str = "text", force_festival: bool = False, use_proxy: bool = False, mode: str = "analyze") -> dict:
    """
    Funzione adapter principale per garantire il 100% di retrocompatibilità
    con tutti i runner e gli script esistenti.
    """
    if mode == "extract":
        descrizione = ev_dict.get("descrizione") or ""
        return extract_sub_events_from_program(
            descrizione=descrizione,
            force_festival=force_festival,
            use_proxy=use_proxy
        )
    else:
        return analyze_standard_event(
            ev_dict=ev_dict,
            target=target,
            force_festival=force_festival,
            use_proxy=use_proxy
        )


__all__ = [
    "struttura_eventi_da_pdf",
    "extract_sub_events_from_program",
    "analyze_standard_event",
    "extract_text_from_url",
    "analyze_event",
]
