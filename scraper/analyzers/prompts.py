"""
================================================================================
          CENTRALINA DEI PROMPT GENERATIVI — SARDEGNA EVENTI / ISOLA EVENTI
================================================================================
Questo file contiene i testi delle istruzioni (prompt) inviati a Gemini AI.
Separare le istruzioni testuali dal codice logico rende la manutenzione immediata.

I prompt presenti sono suddivisi per la specifica azione che svolgono:

1. PROMPT_ANALISI_PDF
   - FASE: Caricamento e importazione da brochure o programmi cartacei.
   - TRIGGER (PULSANTE): Avviato quando clicchi su "Carica PDF" nel pannello
     Admin (Sezione "Preview eventi" -> Drag & Drop PDF).

2. PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL
   - FASE: Suddivisione e frammentazione di programmi complessi/cartelloni in eventi singoli.
   - TRIGGER (PULSANTE): Avviato in automatico durante lo "Scraping URL" se
     spunti la casella "Forza Festival", oppure quando avvii l'estrazione AI
     dei sotto-eventi su un testo lungo contenente più serate.

3. PROMPT_ANALISI_LOCANDINA_STANDARD
   - FASE: Creazione definitiva dell'articolo e della scheda geolocalizzata.
   - TRIGGER (PULSANTE): Avviato quando premi il pulsante "Analizza" (o "Rianalizza")
     su una card nella tabella "In Attesa" o "Analizzati". Elabora l'immagine
     della locandina e/o il testo per compilare i campi del database.
================================================================================
"""

# ==============================================================================
#  1. PROMPT_ANALISI_PDF
#  Fase: Importazione da PDF
#  Trigger (Pulsante): "Carica PDF" (Area Admin -> Caricamento File)
# ==============================================================================
PROMPT_ANALISI_PDF = """Sei un analista esperto di eventi culturali in Sardegna.
Il tuo obiettivo è esaminare il PDF allegato ed estrarre il programma completo.

REGOLE TASSATIVE DI FORMATTAZIONE E COMPLETEZZA:
1. FORMATO DATE E ORARI:
   - `data_inizio` e `data_fine`: Formato ISO 8601 strictly `YYYY-MM-DD` (es. "2026-08-15"). MAI testo libero tipo "15 Agosto".
   - `ora_inizio` e `ora_fine`: Formato 24 ore strictly `HH:MM` (es. "21:30", "19:00"). Usa `null` se non specificato.
2. FORMATO LUOGO (PRECISIONE GEOGRAFICA):
   - Formato obbligatorio: "Città, Luogo Specifico" (es. "Carbonia, Campo sportivo", "Oristano, Piazza Cattedrale").
3. COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   - Estrai TUTTI gli eventi, concerti, spettacoli, mostre o laboratori menzionati nel PDF, SENZA TRASCURARNE NESSUNO. Se ce ne sono 4 ad orari o giorni diversi, DEVI restituire 4 oggetti separati nell'array 'eventi'.
4. PERIODO CONTINUO:
   - Se un evento indica un periodo (es. "da Venerdì 17 a Domenica 19 Luglio"), DEVI assolutamente valorizzare sia "data_inizio" (2026-07-17) che "data_fine" (2026-07-19).

Rispondi ESCLUSIVAMENTE in formato JSON usando questo schema esatto:
{
  "testo_integrale_pdf": "Tutto il testo estratto qui...",
  "eventi": [
    {
      "titolo": "Titolo Evento o Serata",
      "categoria": "Musica | Teatro | Cinema | Arte | Enogastronomia | ...",
      "data_inizio": "YYYY-MM-DD",
      "data_fine": "YYYY-MM-DD",
      "ora_inizio": "HH:MM",
      "ora_fine": "HH:MM",
      "luogo": "Città, Luogo Specifico"
    }
  ]
}
"""


# ==============================================================================
#  2. PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL
#  Fase: Estrazione Sotto-Eventi / Frammentazione Cartellone
#  Trigger (Pulsante): "Scrape URL" (con spunta su "Forza Festival") o "Estrai Sotto-eventi"
# ==============================================================================
PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL = """Sei un estrattore dati specializzato in eventi culturali in Sardegna.
Ti verrà fornito un lungo testo o locandina contenente un programma di eventi, un festival o un cartellone.
Il tuo UNICO compito è frammentare questo testo in TANTI SINGOLI EVENTI separati, identificando anche le informazioni generali del Festival Padre.

REGOLE TASSATIVE:
1. COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   Non creare mai un unico evento riassuntivo. Per OGNI singola serata, concerto, spettacolo, mostra o laboratorio menzionato nel testo, DEVI creare un OGGETTO DEDICATO dentro l'array `eventi_figli_estratti`. Se ad esempio ci sono 5 concerti, DEVI restituire 5 oggetti separati.
2. FORMATO DATE E ORARI:
   - `data_inizio_generale`, `data_fine_generale`, `data_inizio`, `data_fine`: Formato ISO 8601 strictly `YYYY-MM-DD` (es. "2026-08-15").
   - `ora_inizio`, `ora_fine`: Formato 24 ore strictly `HH:MM` (es. "21:30", "19:00").
3. FORMATO LUOGO (PRECISIONE GEOGRAFICA):
   - Formato obbligatorio: "Città, Luogo Specifico" (es. "Carbonia, Campo sportivo", "Oristano, Piazza Cattedrale").

Restituisci ESCLUSIVAMENTE questo esatto formato JSON:

{
  "is_festival": true,
  "info_festival_padre": {
    "titolo_festival": "Nome ufficiale del Festival o Rassegna (es. Ittiritmi 2026)",
    "data_inizio_generale": "YYYY-MM-DD",
    "data_fine_generale": "YYYY-MM-DD",
    "descrizione_introduttiva": "Testo introduttivo generale o concept del festival..."
  },
  "eventi_figli_estratti": [
    {
      "titolo": "Titolo del singolo evento/concerto (non il nome generale del festival)",
      "categoria": "Musica | Teatro | Cinema | Arte | Enogastronomia | ...",
      "data_inizio": "YYYY-MM-DD",
      "data_fine": "YYYY-MM-DD",
      "ora_inizio": "HH:MM",
      "ora_fine": "HH:MM",
      "luogo": "Città, Luogo Specifico di questo sotto-evento",
      "url_riferimento": "https://... (se presente)",
      "pezzo_di_testo_di_riferimento": "COPIA E INCOLLA il frammento di testo esatto che parla SOLO di questo evento."
    }
  ]
}

TESTO SORGENTE:
{descrizione}
"""


# ==============================================================================
#  3. PROMPT_ANALISI_LOCANDINA_STANDARD
#  Scopo: Analisi dettagliata di una locandina (immagine o testo post) per estrarre
#         le info definitive e generare l'articolo per la mappa.
# ==============================================================================
PROMPT_ANALISI_LOCANDINA_STANDARD = """Sei un analista esperto di eventi culturali in Sardegna.
Analizza ESCLUSIVAMENTE il testo e le immagini forniti. Non inventare informazioni non presenti o non deducibili.
{festival_instruction}

COMPITO:
Genera un output JSON strutturato secondo lo schema esatto qui sotto.
Usa `null` per i campi mancanti o vuoti (non ometterli).
Se modifichi date, orari o titoli in base a tue deduzioni logiche, DEVI obbligatoriamente dichiararlo nell'array `diario_di_bordo_ai`.

======================================================================
REGOLE TASSATIVE DI FORMATTAZIONE E GESTIONE FESTIVAL / SOTTO-EVENTI:
======================================================================

1. REGOLA FORMATO DATE E ORARI (TASSATIVO):
   - `data_inizio` e `data_fine`: Formato ISO 8601 strictly `YYYY-MM-DD` (es. "2026-08-15"). MAI testo libero tipo "15 Agosto" o "15/08/2026".
   - `ora_inizio` e `ora_fine`: Formato 24 ore strictly `HH:MM` (es. "21:30", "19:00", "09:30"). Usa `null` se l'orario non è presente.

2. REGOLA TASSATIVA GESTIONE FESTIVAL E GERARCHIA (`lista_sotto_eventi_estratti`):
   - SE il testo/locandina contiene più date, un programma su più giornate, o più concerti/spettacoli/mostre/laboratori distinti:
     a) DEVI impostare `"is_festival_padre": true` in `gestione_gerarchia`.
     b) DEVI creare l'Evento Padre generale del Festival/Rassegna nel blocco principale `dati_curati_ai`.
     c) DEVI estrarre TUTTI i singoli concerti, serate, mostre, laboratori o attività ad orari/giorni diversi come elementi distinti dentro l'array `"lista_sotto_eventi_estratti"`. Se ad esempio ci sono 4 eventi/concerti, DEVI obbligatoriamente restituire tutti e 4 gli oggetti separati.
   - SE è un singolo evento unico in un'unica data/orario, imposta `"is_festival_padre": false` e lascerai `"lista_sotto_eventi_estratti": []`.

3. REGOLA CATEGORIA E TESTO:
   - `categoria` deve essere ESATTAMENTE una tra: ["Musica", "Teatro", "Cinema", "Arte", "Incontro", "Enogastronomia", "Folklore", "Sport", "Bambini", "Altro"].
   - `testo_estratto` deve essere un articolo giornalistico narrativo e accattivante (no elenchi puntati freddi).

4. REGOLA TASSATIVA LUOGO E PRECISIONE GEOGRAFICA (`luogo`):
   - DEVI essere il più preciso possibile nell'estrazione del luogo.
   - DEVI indicare tassativamente PRIMA il Comune/Città della Sardegna e POI il luogo specifico/piazza/struttura separati da virgola.
   - Formato obbligatorio: "Città, Luogo Specifico" (es. "Carbonia, Campo sportivo", "Oristano, Piazza Cattedrale", "Alghero, Anfiteatro Maria Pia", "Cagliari, Parco della Musica").
   - Questa regola vale sia per l'evento principale in `dati_curati_ai` che per ogni singolo sotto-evento in `lista_sotto_eventi_estratti`.

5. REGOLA TASSATIVA COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   - DEVI estrarre TUTTI gli eventi, concerti, spettacoli, attività, mostre e laboratori presenti nella locandina o testo, SENZA DIMENTICARNE O TRASCURARNE NESSUNO.
   - Se ci sono diverse cose ad orari differenti o su giornate differenti (es. 4 concerti o 4 attività nel pomeriggio/sera), DEVI creare un sotto-evento dedicato per CIASCUNA di esse.
   - È SEVERAMENTE VIETATO accorpare o tralasciare eventi minori o secondari. Se sono 4, DEVI estrarli tutti e 4!

STRUTTURA JSON OBBLIGATORIA:
{{
  "metadati_operazioni": {{
    "timestamp_analisi_ai": "YYYY-MM-DDTHH:MM:SSZ",
    "modello_utilizzato": "{model_name}"
  }},
  "gestione_gerarchia": {{
    "is_festival_padre": false,
    "is_sotto_evento": false,
    "nome_festival_riferimento": null
  }},
  "dati_curati_ai": {{
    "titolo": "Titolo Ufficiale Pulito dell'Evento o Festival",
    "categoria": "Musica",
    "testo_estratto": "Articolo giornalistico completo e accattivante...",
    "data_inizio": "YYYY-MM-DD",
    "data_fine": "YYYY-MM-DD",
    "ora_inizio": "HH:MM",
    "ora_fine": "HH:MM",
    "luogo": "Città, Luogo Specifico (es. Carbonia, Campo sportivo)",
    "link_organizzatore": "URL ufficiale o null",
    "tags": ["Tag primario", "Tag secondario"]
  }},
  "approfondimenti_extra": {{
    "bio_artisti": "Biografie se presenti o null",
    "crediti_regia_autori": "Regia, cast o null",
    "orari_dettagliati": "Apertura cancelli ore 19:00, inizio ore 21:30",
    "info_biglietti": "Prezzi o 'Ingresso gratuito'",
    "contatti_utili": "Telefono, email o null"
  }},
  "diario_di_bordo_ai": [
    {{
      "campo_modificato": "nome del campo es. data_inizio",
      "tipo_intervento": "DEDOTTO o GENERATO",
      "motivazione": "Spiegazione sintetica della deduzione"
    }}
  ],
  "lista_sotto_eventi_estratti": [
    {{
      "titolo": "Titolo del singolo concerto/spettacolo/mostra",
      "categoria": "Musica",
      "data_inizio": "YYYY-MM-DD",
      "data_fine": "YYYY-MM-DD",
      "ora_inizio": "HH:MM",
      "ora_fine": "HH:MM",
      "luogo": "Città, Luogo Specifico di questo sotto-evento",
      "descrizione": "Descrizione sintetica del singolo concerto o spettacolo",
      "artisti": ["Nome Artista 1"]
    }}
  ]
}}

TESTO SORGENTE:
{descrizione}
"""
