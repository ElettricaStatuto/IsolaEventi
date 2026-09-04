"""
================================================================================
          CENTRALINA DEI PROMPT GENERATIVI — SARDEGNA EVENTI / ISOLA EVENTI
================================================================================
Questo file contiene i testi delle istruzioni (prompt) inviati a Gemini AI,
E l'UNICA definizione dello schema JSON che l'AI deve produrre.

REGOLA D'ORO: qualunque campo si voglia aggiungere/rinominare/rimuovere dallo
schema evento va modificato SOLO in questo file (sezione "SCHEMA CONDIVISO"
qui sotto). Tutti e tre gli analyzer (PDF, Festival, Locandina Standard)
riusano la stessa identica struttura, sia nel testo del prompt sia nello
schema rigido (`response_json_schema`) passato a Gemini per vincolare
l'output.
================================================================================
"""
import json

# ==============================================================================
#  SCHEMA CONDIVISO — versione "2.0"
# ==============================================================================

SCHEMA_VERSION = "2.0"

CATEGORIE_VALIDE = [
    "Musica", "Teatro", "Cinema", "Arte", "Incontro",
    "Enogastronomia", "Folklore", "Sport", "Eventi per Bambini", "Altro",
]

# Lista chiusa di tag: a differenza di `categoria` (una sola, obbligatoria),
# un evento puo' avere PIU' tag insieme se pertinenti (es. un festival
# "Musica" con anche un mercatino artigianale prende sia "Musica" sia
# "Mercatino/Artigianato"). Elenco volutamente piccolo e concreto - niente
# tag inventati liberamente dall'AI. L'ingresso gratuito NON e' un tag:
# e' gia' un campo a se' (`is_ingresso_gratuito`), mostrato in UI come
# bollino a parte invece che come tag selezionabile.
TAG_VALIDI = [
    "Musica", "Teatro", "Cinema", "Arte/Mostra", "Enogastronomia",
    "Folklore/Tradizione", "Sport", "Bambini/Famiglie", "Mercatino/Artigianato",
]

# Domini per cui oggi chiediamo dettagli extra strutturati. Aggiungerne uno
# nuovo (es. Enogastronomia) richiede: 1) un blocco "Dettagli<Dominio>" qui
# sotto, 2) una chiave in DettagliDominio, 3) una voce in EVENTO_FIGLIO_EXAMPLE.
_DETTAGLI_CINEMA_PROPS = {
    "titolo_originale": {"type": ["string", "null"]},
    "anno_produzione": {"type": ["integer", "null"]},
    "regista": {"type": ["string", "null"]},
    "paese_produzione": {"type": ["string", "null"]},
    "durata_minuti": {"type": ["integer", "null"]},
    "genere": {"type": ["string", "null"]},
    "cast_principale": {"type": "array", "items": {"type": "string"}},
    "sinossi_dettagliata": {"type": ["string", "null"]},
    "premi_e_riconoscimenti": {"type": ["string", "null"]},
}

_DETTAGLI_TEATRO_PROPS = {
    "regia": {"type": ["string", "null"]},
    "drammaturgia_autori": {"type": ["string", "null"]},
    "compagnia_teatrale": {"type": ["string", "null"]},
    "attori_cast": {"type": "array", "items": {"type": "string"}},
    "genere_teatrale": {"type": ["string", "null"]},
    "durata_spettacolo_minuti": {"type": ["integer", "null"]},
    "descrizione_opera": {"type": ["string", "null"]},
}

# --- JSON Schema rigoroso (per response_json_schema, formato standard) ------
_JSON_SCHEMA_DEFS = {
    "BioArtista": {
        "type": "object",
        "properties": {
            "nome": {"type": "string"},
            "bio": {"type": "string"},
        },
        "required": ["nome", "bio"],
        "additionalProperties": False,
    },
    "ApprofondimentiExtra": {
        "type": "object",
        "properties": {
            "bio_artisti": {"type": "array", "items": {"$ref": "#/$defs/BioArtista"}},
            "social_contatti": {"type": "array", "items": {"type": "string"}},
            "crediti_regia_autori": {"type": ["string", "null"]},
            "orari_dettagliati": {"type": ["string", "null"]},
            "info_biglietti": {"type": ["string", "null"]},
            "contatti_utili": {"type": ["string", "null"]},
            "immagine_pulita_e_pubblicabile": {"type": "boolean"},
            "motivo_immagine_non_pulita": {"type": ["string", "null"]},
        },
        "required": [
            "bio_artisti", "social_contatti", "crediti_regia_autori", "orari_dettagliati",
            "info_biglietti", "contatti_utili", "immagine_pulita_e_pubblicabile", "motivo_immagine_non_pulita",
        ],
        "additionalProperties": False,
    },
    "DettagliCinema": {
        "type": ["object", "null"],
        "properties": _DETTAGLI_CINEMA_PROPS,
        "required": list(_DETTAGLI_CINEMA_PROPS.keys()),
        "additionalProperties": False,
    },
    "DettagliTeatro": {
        "type": ["object", "null"],
        "properties": _DETTAGLI_TEATRO_PROPS,
        "required": list(_DETTAGLI_TEATRO_PROPS.keys()),
        "additionalProperties": False,
    },
    "DettagliDominio": {
        "type": "object",
        "properties": {
            "dettagli_cinema": {"$ref": "#/$defs/DettagliCinema"},
            "dettagli_teatro": {"$ref": "#/$defs/DettagliTeatro"},
        },
        "required": ["dettagli_cinema", "dettagli_teatro"],
        "additionalProperties": False,
    },
    "DiarioVoce": {
        "type": "object",
        "properties": {
            "campo_modificato": {"type": "string"},
            "tipo_intervento": {"type": "string", "enum": ["DEDOTTO", "GENERATO"]},
            "motivazione": {"type": "string"},
        },
        "required": ["campo_modificato", "tipo_intervento", "motivazione"],
        "additionalProperties": False,
    },
    "EventoFiglio": {
        "type": "object",
        "properties": {
            "is_evento": {"type": "boolean"},
            "titolo": {"type": "string"},
            "categoria": {"type": "string", "enum": CATEGORIE_VALIDE},
            "testo_estratto": {"type": "string"},
            "data_inizio": {"type": ["string", "null"]},
            "data_fine": {"type": ["string", "null"]},
            "ora_inizio": {"type": ["string", "null"]},
            "ora_fine": {"type": ["string", "null"]},
            "luogo": {"type": ["string", "null"]},
            "link_organizzatore": {"type": ["string", "null"]},
            "link_biglietti": {"type": ["string", "null"]},
            "is_ingresso_gratuito": {"type": "boolean"},
            "artisti": {"type": "array", "items": {"type": "string"}},
            "tags": {"type": "array", "items": {"type": "string", "enum": TAG_VALIDI}},
            "dettagli_dominio": {"$ref": "#/$defs/DettagliDominio"},
            "approfondimenti_extra": {"$ref": "#/$defs/ApprofondimentiExtra"},
        },
        "required": [
            "is_evento", "titolo", "categoria", "testo_estratto", "data_inizio", "data_fine",
            "ora_inizio", "ora_fine", "luogo", "link_organizzatore", "link_biglietti",
            "is_ingresso_gratuito", "artisti", "tags", "dettagli_dominio", "approfondimenti_extra",
        ],
        "additionalProperties": False,
    },
}


def _documento_json_schema(extra_top_level_props=None, extra_required=None):
    """Costruisce lo schema JSON rigido del documento completo (padre + figli).
    Usato identico da Standard e Festival; il PDF ci aggiunge solo 'testo_integrale_pdf'.
    """
    props = {
        "schema_version": {"type": "string"},
        "metadati_operazioni": {
            "type": "object",
            "properties": {
                "timestamp_analisi_ai": {"type": "string"},
                "modello_utilizzato": {"type": "string"},
            },
            "required": ["timestamp_analisi_ai", "modello_utilizzato"],
            "additionalProperties": False,
        },
        "gestione_gerarchia": {
            "type": "object",
            "properties": {
                "is_festival_padre": {"type": "boolean"},
                "is_sotto_evento": {"type": "boolean"},
                "nome_festival_riferimento": {"type": ["string", "null"]},
            },
            "required": ["is_festival_padre", "is_sotto_evento", "nome_festival_riferimento"],
            "additionalProperties": False,
        },
        "dati_curati_ai": {"$ref": "#/$defs/EventoFiglio"},
        "diario_di_bordo_ai": {"type": "array", "items": {"$ref": "#/$defs/DiarioVoce"}},
        "lista_sotto_eventi_estratti": {"type": "array", "items": {"$ref": "#/$defs/EventoFiglio"}},
    }
    required = list(props.keys())
    if extra_top_level_props:
        props.update(extra_top_level_props)
        required += extra_required or list(extra_top_level_props.keys())
    return {
        "$defs": _JSON_SCHEMA_DEFS,
        "type": "object",
        "properties": props,
        "required": required,
        "additionalProperties": False,
    }


STANDARD_RESPONSE_SCHEMA = _documento_json_schema()
FESTIVAL_RESPONSE_SCHEMA = _documento_json_schema()
PDF_RESPONSE_SCHEMA = _documento_json_schema(
    extra_top_level_props={"testo_integrale_pdf": {"type": "string"}},
)

# --- Esempio leggibile (per il testo del prompt, non per la validazione) ---
EVENTO_FIGLIO_EXAMPLE = {
    "is_evento": True,
    "titolo": "Titolo Ufficiale Pulito dell'Evento",
    "categoria": "Musica",
    "testo_estratto": "Articolo giornalistico completo e accattivante...",
    "data_inizio": "YYYY-MM-DD",
    "data_fine": "YYYY-MM-DD",
    "ora_inizio": "HH:MM",
    "ora_fine": "HH:MM",
    "luogo": "Città, Luogo Specifico (es. Carbonia, Campo sportivo)",
    "link_organizzatore": "URL ufficiale o null",
    "link_biglietti": "URL vendita biglietti o null",
    "is_ingresso_gratuito": True,
    "artisti": ["Nome Artista 1", "Nome Artista 2"],
    "tags": ["Musica", "Mercatino/Artigianato"],
    "dettagli_dominio": {
        "dettagli_cinema": None,
        "dettagli_teatro": None,
    },
    "approfondimenti_extra": {
        "bio_artisti": [{"nome": "Nome Artista", "bio": "Breve biografia"}],
        "social_contatti": ["URL o contatto social/email"],
        "crediti_regia_autori": "Regia, cast o null",
        "orari_dettagliati": "Apertura cancelli ore 19:00, inizio ore 21:30",
        "info_biglietti": "Prezzi o 'Ingresso gratuito'",
        "contatti_utili": "Telefono, email o null",
        "immagine_pulita_e_pubblicabile": True,
        "motivo_immagine_non_pulita": "Descrizione se l'immagine è una foto scattata o sgranata, altrimenti null",
    },
}

_DOCUMENTO_EXAMPLE = {
    "schema_version": SCHEMA_VERSION,
    "metadati_operazioni": {
        "timestamp_analisi_ai": "YYYY-MM-DDTHH:MM:SSZ",
        "modello_utilizzato": "{model_name}",
    },
    "gestione_gerarchia": {
        "is_festival_padre": False,
        "is_sotto_evento": False,
        "nome_festival_riferimento": None,
    },
    "dati_curati_ai": EVENTO_FIGLIO_EXAMPLE,
    "diario_di_bordo_ai": [
        {"campo_modificato": "nome del campo es. data_inizio", "tipo_intervento": "DEDOTTO o GENERATO", "motivazione": "Spiegazione sintetica della deduzione"}
    ],
    "lista_sotto_eventi_estratti": [EVENTO_FIGLIO_EXAMPLE],
}

REGOLA_CATEGORIA_TXT = f'`categoria` deve essere ESATTAMENTE una tra: {json.dumps(CATEGORIE_VALIDE, ensure_ascii=False)}.'

REGOLA_TAG_TXT = (
    f'REGOLA `tags`: scegli SOLO tra questi valori, {json.dumps(TAG_VALIDI, ensure_ascii=False)} - '
    "MAI inventarne altri. A differenza di `categoria` (una sola) puoi indicarne PIU' di uno se pertinenti "
    "(es. un festival musicale con anche un mercatino artigianale prende sia \"Musica\" sia "
    "\"Mercatino/Artigianato\"). Se nessuno di questi si applica davvero, lascia l'array vuoto - non forzare "
    "un tag poco pertinente pur di averne uno. Non includere mai un concetto di \"ingresso gratuito\": quello "
    "e' gestito a parte dal campo `is_ingresso_gratuito`."
)

REGOLA_DETTAGLI_DOMINIO_TXT = (
    "REGOLA `dettagli_dominio`: compila SOLO il blocco corrispondente alla `categoria` scelta "
    "(`dettagli_cinema` se categoria è \"Cinema\", `dettagli_teatro` se categoria è \"Teatro\"). "
    "Lascia l'ALTRO blocco a `null`. Se `categoria` non è né Cinema né Teatro, lascia ENTRAMBI i blocchi a `null`. "
    "Non inventare informazioni non presenti nel testo/immagine: usa `null` sui singoli campi mancanti."
)

REGOLA_DATE_ORARI_TXT = (
    "- `data_inizio` e `data_fine`: Formato ISO 8601 strictly `YYYY-MM-DD` (es. \"2026-08-15\"). MAI testo libero tipo \"15 Agosto\".\n"
    "- `ora_inizio` e `ora_fine`: Formato 24 ore strictly `HH:MM` (es. \"21:30\", \"19:00\"). Usa `null` se l'orario non è presente. "
    "L'ORARIO DI FINE (ora_fine) DEVE ESSERE IMPOSTATO A NULL A MENO CHE non sia esplicitamente scritto. "
    "È SEVERAMENTE VIETATO dedurre o ipotizzare l'orario di fine. Se non è scritto in chiaro, imposta ora_fine a null."
)

REGOLA_LUOGO_TXT = (
    "Formato obbligatorio: \"Città, Luogo Specifico\" (es. \"Carbonia, Campo sportivo\", \"Oristano, Piazza Cattedrale\")."
)

REGOLA_IS_EVENTO_TXT = (
    "REGOLA `is_evento`: valuta per OGNI evento/sotto-evento se descrive davvero un evento specifico con una data o "
    "periodo di svolgimento reale (concerto, spettacolo, mostra, sagra, proiezione...). Imposta `false` se il testo è "
    "puramente informativo, un avviso generico o non descrive nulla di concreto."
)


# ==============================================================================
#  1. PROMPT_ANALISI_PDF
#  Fase: Importazione da PDF
# ==============================================================================
PROMPT_ANALISI_PDF = f"""Sei un analista esperto di eventi culturali in Sardegna.
Il tuo obiettivo è esaminare il PDF allegato ed estrarre il programma completo, secondo lo SCHEMA CONDIVISO del progetto (identico a quello usato per le locandine singole e per i cartelloni festival).

REGOLE TASSATIVE DI FORMATTAZIONE E COMPLETEZZA:
1. FORMATO DATE E ORARI:
{REGOLA_DATE_ORARI_TXT}
2. FORMATO LUOGO (PRECISIONE GEOGRAFICA):
   - {REGOLA_LUOGO_TXT}
3. COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   - Estrai TUTTI gli eventi, concerti, spettacoli, mostre o laboratori menzionati nel PDF, SENZA TRASCURARNE NESSUNO, in `lista_sotto_eventi_estratti`. Se ce ne sono 4 ad orari o giorni diversi, DEVI restituire 4 oggetti separati.
4. PERIODO CONTINUO:
   - Se un evento indica un periodo (es. "da Venerdì 17 a Domenica 19 Luglio"), DEVI assolutamente valorizzare sia "data_inizio" che "data_fine".
5. {REGOLA_CATEGORIA_TXT}
6. {REGOLA_DETTAGLI_DOMINIO_TXT}
7. {REGOLA_IS_EVENTO_TXT}
8. `dati_curati_ai` rappresenta il programma/opuscolo nel suo complesso (titolo generale, date coperte); se il PDF descrive un unico evento con più giornate, imposta `gestione_gerarchia.is_festival_padre` a true.
9. REGOLA TESTO: il campo `testo_estratto` NON deve MAI essere lasciato vuoto — sia in `dati_curati_ai` sia in OGNI singolo elemento di `lista_sotto_eventi_estratti` — DEVI scrivere un breve articolo giornalistico narrativo e accattivante (no elenchi puntati freddi, no semplice copia-incolla del testo sorgente).

Rispondi ESCLUSIVAMENTE in formato JSON usando questo schema esatto:
{json.dumps(_DOCUMENTO_EXAMPLE, indent=2, ensure_ascii=False)}

Aggiungi inoltre il campo "testo_integrale_pdf" con tutto il testo estratto dal documento.
"""


# ==============================================================================
#  2. PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL
#  Fase: Estrazione Sotto-Eventi / Frammentazione Cartellone
# ==============================================================================
PROMPT_ESTRAZIONE_PROGRAMMA_FESTIVAL = f"""Sei un estrattore dati specializzato in eventi culturali in Sardegna.
Ti verrà fornito un lungo testo o locandina contenente un programma di eventi, un festival o un cartellone.
Il tuo UNICO compito è frammentare questo testo in TANTI SINGOLI EVENTI separati, secondo lo SCHEMA CONDIVISO del progetto (identico a quello usato per le locandine singole e per i PDF), identificando anche le informazioni generali del Festival Padre in `dati_curati_ai`.

REGOLE TASSATIVE:
1. COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   Non creare mai un unico evento riassuntivo. Per OGNI singola serata, concerto, spettacolo, mostra o laboratorio menzionato nel testo, DEVI creare un OGGETTO DEDICATO dentro l'array `lista_sotto_eventi_estratti`. Se ad esempio ci sono 5 concerti, DEVI restituire 5 oggetti separati.
2. FORMATO DATE E ORARI:
{REGOLA_DATE_ORARI_TXT}
3. FORMATO LUOGO (PRECISIONE GEOGRAFICA):
   - {REGOLA_LUOGO_TXT}
4. {REGOLA_CATEGORIA_TXT}
5. {REGOLA_DETTAGLI_DOMINIO_TXT}
6. {REGOLA_IS_EVENTO_TXT}
7. Imposta `gestione_gerarchia.is_festival_padre` a true.
8. REGOLA TESTO: il campo `testo_estratto` NON deve MAI essere lasciato vuoto — sia in `dati_curati_ai` (il festival nel suo complesso) sia in OGNI singolo elemento di `lista_sotto_eventi_estratti` (ogni sotto-evento) — DEVI scrivere un breve articolo giornalistico narrativo e accattivante (no elenchi puntati freddi, no semplice copia-incolla del testo sorgente).

Restituisci ESCLUSIVAMENTE questo esatto formato JSON:
{json.dumps(_DOCUMENTO_EXAMPLE, indent=2, ensure_ascii=False)}

TESTO SORGENTE:
{{descrizione}}
"""


# ==============================================================================
#  3. PROMPT_ANALISI_LOCANDINA_STANDARD
#  Scopo: Analisi dettagliata di una locandina (immagine o testo post) per estrarre
#         le info definitive e generare l'articolo per la mappa.
# ==============================================================================
PROMPT_ANALISI_LOCANDINA_STANDARD = f"""Sei un analista esperto di eventi culturali in Sardegna.
Analizza ESCLUSIVAMENTE il testo e le immagini forniti. Non inventare informazioni non presenti o non deducibili.
{{festival_instruction}}

COMPITO:
Genera un output JSON strutturato secondo lo SCHEMA CONDIVISO del progetto (identico a quello usato per PDF e cartelloni festival).
Usa `null` per i campi mancanti o vuoti (non ometterli).
Se modifichi date o titoli in base a tue deduzioni logiche (ad esempio ricavando l'anno mancante dal giorno della settimana), DEVI obbligatoriamente dichiararlo nell'array `diario_di_bordo_ai`. Ricorda che questa regola NON si applica mai all'orario di fine: per l'orario di fine è assolutamente vietata qualsiasi deduzione, deve rimanere null se non scritto esplicitamente.

======================================================================
REGOLE TASSATIVE DI FORMATTAZIONE E GESTIONE FESTIVAL / SOTTO-EVENTI:
======================================================================

1. REGOLA FORMATO DATE E ORARI (TASSATIVO):
{REGOLA_DATE_ORARI_TXT}

2. REGOLA TASSATIVA GESTIONE FESTIVAL E GERARCHIA (`lista_sotto_eventi_estratti`):
   - SE il testo/locandina contiene più date, un programma su più giornate, o più concerti/spettacoli/mostre/laboratori distinti:
     a) DEVI impostare `"is_festival_padre": true` in `gestione_gerarchia`.
     b) DEVI creare l'Evento Padre generale del Festival/Rassegna nel blocco principale `dati_curati_ai`.
     c) DEVI estrarre TUTTI i singoli concerti, serate, mostre, laboratori o attività ad orari/giorni diversi come elementi distinti dentro l'array `"lista_sotto_eventi_estratti"`. Se ad esempio ci sono 4 eventi/concerti, DEVI obbligatoriamente restituire tutti e 4 gli oggetti separati.
   - SE è un singolo evento unico in un'unica data/orario, imposta `"is_festival_padre": false` e lascerai `"lista_sotto_eventi_estratti": []`.

3. REGOLA CATEGORIA, DOMINIO E TESTO:
   - {REGOLA_CATEGORIA_TXT}
   - {REGOLA_TAG_TXT}
   - {REGOLA_DETTAGLI_DOMINIO_TXT}
   - {REGOLA_IS_EVENTO_TXT}
   - `testo_estratto` deve essere un articolo giornalistico narrativo e accattivante (no elenchi puntati freddi).

4. REGOLA TASSATIVA LUOGO E PRECISIONE GEOGRAFICA (`luogo`):
   - DEVI essere il più preciso possibile nell'estrazione del luogo.
   - DEVI indicare tassativamente PRIMA il Comune/Città della Sardegna e POI il luogo specifico/piazza/struttura separati da virgola.
   - {REGOLA_LUOGO_TXT}
   - Questa regola vale sia per l'evento principale in `dati_curati_ai` che per ogni singolo sotto-evento in `lista_sotto_eventi_estratti`.

5. REGOLA TASSATIVA COMPLETEZZA ASSOLUTA (ZERO OMISSIONI):
   - DEVI estrarre TUTTI gli eventi, concerti, spettacoli, attività, mostre e laboratori presenti nella locandina o testo, SENZA DIMENTICARNE O TRASCURARNE NESSUNO.
   - Se ci sono diverse cose ad orari differenti o su giornate differenti (es. 4 concerti o 4 attività nel pomeriggio/sera), DEVI creare un sotto-evento dedicato per CIASCUNA di esse.
   - È SEVERAMENTE VIETATO accorpare o tralasciare eventi minori o secondari. Se sono 4, DEVI estrarli tutti e 4!

6. VALUTAZIONE QUALITÀ IMMAGINE SORGENTE (TASSATIVO):
   - Esamina l'immagine della locandina fornita.
   - Determina se si tratta di una "grafica pulita e pubblicabile" (file JPG originale esportato dal computer, volantino digitale ben definito, locandina nativa ad alta definizione) o se è una "foto scattata a un foglio/schermo" (foto sgranata con smartphone, presenza di dita, sfondi, angolazione imperfetta, riflessi).
   - Inserisci il verdetto booleano in `approfondimenti_extra.immagine_pulita_e_pubblicabile` e descrivi l'eventuale problema in `approfondimenti_extra.motivo_immagine_non_pulita`.

7. REGOLA LINK ORGANIZZATORE (RICERCA WEB):
   - La pagina fonte che stai leggendo si trova su questo dominio: {{link_fonte}}
   - Se il testo/immagine non indica gia' esplicitamente il sito ufficiale dell'evento o dell'organizzatore, USA lo strumento di ricerca Google per cercarlo (es. "<nome evento> sito ufficiale", "<nome organizzatore> Sardegna").
   - Inserisci il link trovato in `link_organizzatore` SOLO se: (a) sei ragionevolmente sicuro che sia il sito autentico e specifico di QUESTO evento/organizzatore (dominio riconducibile al nome, contenuti coerenti con quanto descritto nel testo sorgente), e (b) è un dominio DIVERSO da quello della pagina fonte sopra indicata - se l'unico "sito" che trovi è lo stesso portale/aggregatore da cui hai gia' letto il testo, NON e' informazione utile aggiuntiva: lascia `link_organizzatore` a `null` invece di ripetere lo stesso dominio.
   - Scarta sempre aggregatori di eventi generici, social network, o siti di un evento omonimo ma diverso.
   - Se hai dei dubbi sull'autenticità o non trovi nulla di affidabile, lascia `link_organizzatore` a `null`. È SEVERAMENTE VIETATO inventare o indovinare un URL.

STRUTTURA JSON OBBLIGATORIA:
{json.dumps(_DOCUMENTO_EXAMPLE, indent=2, ensure_ascii=False)}

TESTO SORGENTE:
{{descrizione}}
"""
