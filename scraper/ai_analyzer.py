"""
Modulo ai_analyzer.py (Proxy di retrocompatibilità).

Re-importa e riesporta tutte le funzioni dai sottomoduli dedicati in `scraper.analyzers`:
- `prompts.py`: Contiene tutti i prompt di testo per Gemini
- `pdf_analyzer.py`: Estrazione e analisi da brochure PDF
- `extractor_analyzer.py`: Frammentazione di cartelloni e programmi lunghi
- `standard_analyzer.py`: Analisi di locandine (JPG/PNG), pagine web e testi
"""

try:
    from .analyzers import (
        analyze_event,
        struttura_eventi_da_pdf,
        extract_text_from_url,
        extract_sub_events_from_program,
        analyze_standard_event,
    )
except ImportError:
    from analyzers import (
        analyze_event,
        struttura_eventi_da_pdf,
        extract_text_from_url,
        extract_sub_events_from_program,
        analyze_standard_event,
    )

__all__ = [
    "analyze_event",
    "struttura_eventi_da_pdf",
    "extract_text_from_url",
    "extract_sub_events_from_program",
    "analyze_standard_event",
]
