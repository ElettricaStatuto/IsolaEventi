import { useState, useEffect, type CSSProperties } from "react";
import { Search, Maximize2, Minimize2 } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import {
  useListEvents,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { useEventsFilter } from "../hooks/use-events-filter";
import { DateFilter } from "../components/date-filter";
import { EventList } from "../components/event-list";
import { MapContainer } from "../components/map-container";
import { EventDetailsModalPublic } from "../components/EventDetailsModalPublic";
import { ErrorBoundary } from "../components/error-boundary";
import { NearbySection } from "../components/nearby-section";
import { getAssetUrl, getEventImageUrl } from "../lib/utils";

/**
 * Etichetta diagnostica TEMPORANEA per capire perche' la mappa non si vede
 * su alcuni telefoni: mostra numeri reali letti dal browser dell'utente
 * (dimensioni schermo, risultato della media query, eventuali errori
 * JavaScript catturati) invece di continuare a ipotizzare alla cieca da
 * remoto. Da rimuovere una volta risolto il problema.
 */
function DebugOverlay() {
  const [info, setInfo] = useState<string>("...");
  const [errore, setErrore] = useState<string | null>(null);
  const [mappaRect, setMappaRect] = useState<string>("non ancora misurata");

  useEffect(() => {
    const aggiorna = () => {
      const lg = window.matchMedia("(min-width: 1024px)").matches;
      setInfo(
        `${window.innerWidth}x${window.innerHeight}px · dpr=${window.devicePixelRatio} · lg=${lg} · ` +
        `${navigator.userAgent.slice(0, 60)}`
      );
    };
    aggiorna();
    window.addEventListener("resize", aggiorna);

    const onError = (e: ErrorEvent) => {
      setErrore(`${e.message} @ ${e.filename}:${e.lineno}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      setErrore(`Promise non gestita: ${String(e.reason)}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const timer = setTimeout(() => {
      const divs = Array.from(document.querySelectorAll(".leaflet-container"));
      if (divs.length === 0) {
        setMappaRect("nessun elemento .leaflet-container trovato nel DOM");
      } else {
        const rects = divs.map((d) => {
          const r = d.getBoundingClientRect();
          return `${Math.round(r.width)}x${Math.round(r.height)}`;
        });
        setMappaRect(`${divs.length} mappa/e trovate, dimensioni: ${rects.join(", ")}`);
      }
    }, 1500);

    return () => {
      window.removeEventListener("resize", aggiorna);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-300 text-black text-[10px] leading-tight p-2 font-mono break-all border-b-4 border-black">
      <strong>DEBUG:</strong> {info}
      <br />
      <strong>Mappa nel DOM:</strong> {mappaRect}
      {errore && (
        <>
          <br />
          <strong className="text-red-700">ERRORE JS:</strong> {errore}
        </>
      )}
    </div>
  );
}

export function Home() {
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/eventi/:idAndSlug");
  const [, setLocation] = useLocation();
  // Su schermi piccoli (sotto lg) si parte dalla mappa, non dalla lista -
  // su mobile e' quello che si vuole vedere subito aprendo il sito. Da lg
  // in su lista e mappa sono affiancate, quindi si parte comunque con la
  // lista visibile a sinistra.
  //
  // Usiamo matchMedia sulla STESSA soglia (1024px) del breakpoint "lg" di
  // Tailwind, invece di window.innerWidth: sono due sistemi diversi che su
  // alcuni browser mobili (es. i browser integrati di Instagram/Facebook,
  // "richiedi sito desktop", certi zoom) possono disallinearsi - risultato,
  // il JS sceglie "lista" ma il CSS nasconde comunque il pannello mappa
  // riservato al desktop, lasciando l'utente senza ne' l'uno ne' l'altro.
  // matchMedia interroga la stessa media query CSS che decide il layout,
  // quindi i due non possono piu' contraddirsi.
  const [showEventList, setShowEventList] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  // Su schermi piccoli la mappa e' spesso troppo piccola per navigarla
  // comodamente (pizzicare/trascinare in uno spazio ridotto). Un tocco sul
  // pulsante di espansione la fa crescere quasi a schermo intero, restando
  // pero' nel normale flusso di pagina (i filtri sopra restano raggiungibili
  // scorrendo su, non vengono nascosti).
  const [mappaEspansa, setMappaEspansa] = useState(false);

  // Listen for global "toggle-map-view" event from the nav "Mappa" button
  useEffect(() => {
    const handleToggle = () => setShowEventList((prev) => !prev);
    window.addEventListener("toggle-map-view", handleToggle);
    return () => window.removeEventListener("toggle-map-view", handleToggle);
  }, []);

  // Altezza dell'area lista/mappa su mobile, misurata DIRETTAMENTE in
  // JavaScript (window.innerHeight) invece di affidarsi a unita' CSS come
  // vh/dvh - alcuni browser mobili le calcolano in modo incoerente rispetto
  // allo spazio davvero visibile, risultando in un'area alta 0px (quindi
  // mappa invisibile) su certi telefoni. innerHeight e' un numero reale,
  // uguale per tutti i motori di rendering.
  const [altezzaMappaMobile, setAltezzaMappaMobile] = useState<number>(() =>
    typeof window !== "undefined" ? Math.round(window.innerHeight * 0.7) : 500
  );
  useEffect(() => {
    const aggiorna = () => setAltezzaMappaMobile(Math.round(window.innerHeight * 0.7));
    aggiorna();
    window.addEventListener("resize", aggiorna);
    window.addEventListener("orientationchange", aggiorna);
    return () => {
      window.removeEventListener("resize", aggiorna);
      window.removeEventListener("orientationchange", aggiorna);
    };
  }, []);

  // Fetch all events not yet ended (client-side filtering handles the rest)
  const {
    data: events = [],
    isLoading,
    isError,
  } = useListEvents({ solo_futuri: true }, { query: { queryKey: getListEventsQueryKey({ solo_futuri: true }) } });

  // Derive selectedEventId from URL
  const selectedEventId = params?.idAndSlug ? parseInt(params.idAndSlug.split("-")[0], 10) : null;

  const [selectedEventDetail, setSelectedEventDetail] = useState<any | null>(null);

  // Fetch full details of the selected event if not present in the pre-loaded list (e.g. sub-events)
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventDetail(null);
      return;
    }
    const localMatch = events.find((e) => e.id === selectedEventId);
    if (localMatch) {
      setSelectedEventDetail(localMatch);
    } else {
      fetch(`/api/events/${selectedEventId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setSelectedEventDetail(data);
          }
        })
        .catch((err) => console.error("Error fetching single event:", err));
    }
  }, [selectedEventId, events]);

  // Client-side date range filtering
  const {
    filteredEvents,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    selectedTags,
    setSelectedTags,
  } = useEventsFilter(events);

  const handleSelectEvent = (id: number) => {
    const ev = events.find((e) => e.id === id);
    if (ev) {
      const slug = ev.titolo
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setLocation(`/eventi/${id}-${slug}`);
    } else {
      // For sub-events or events not currently in list, redirect using generic slug
      // The router matches the ID and the useEffect loads it dynamically
      setLocation(`/eventi/${id}-evento`);
    }
  };

  // Cliccando un tag (dalla card in lista o dalla scheda dettaglio): chiude
  // l'eventuale scheda aperta, mostra la lista (non la mappa) e filtra su
  // quel solo tag - tutti gli eventi futuri con quella caratteristica.
  const handleTagClick = (tag: string) => {
    setSelectedTags([tag]);
    setShowEventList(true);
    setLocation("/");
  };

  return (
    <div className="flex flex-col gap-0 lg:h-[calc(100dvh-4rem)]">
      <DebugOverlay />
      {/* Mappa espansa: nasconde tutto il resto (filtri, lista, "vicino a
          te") per navigare solo la mappa, su qualunque dimensione di
          schermo - un'esplicita scelta dell'utente, non lo stato di default. */}
      {mappaEspansa ? (
        <div className="relative flex-1 h-[calc(100dvh-4rem)] rounded-xl overflow-hidden shadow-sm border border-border">
          <MapContainer
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            interattiva
          />
          <button
            type="button"
            onClick={() => setMappaEspansa(false)}
            title="Chiudi la mappa a schermo intero"
            className="absolute top-3 left-3 z-[1001] flex items-center justify-center w-9 h-9 rounded-lg bg-card/95 border border-border shadow-sm text-foreground cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
      <NearbySection
        events={events}
        selectedCategories={selectedCategories}
        onSelectEvent={handleSelectEvent}
      />

      {/* ── Sidebar + Map layout — su schermi sotto lg impilati in normale
          flusso di pagina (scrollabile), cosi' la mappa resta sempre
          raggiungibile scendendo; da lg in su affiancati e vincolati
          all'altezza dello schermo, senza scroll di pagina. ── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:flex-1 lg:min-h-0">
        {/* ── Left sidebar: controls always on top, then list or map below ── */}
        <aside
          className={
            showEventList
              ? "w-full lg:w-[380px] xl:w-[440px] flex-shrink-0 flex flex-col gap-3 lg:h-full lg:min-h-0 min-w-0"
              : "w-full lg:flex-[2] flex-shrink-0 flex flex-col gap-0 lg:h-full lg:min-h-0 min-w-0"
          }
        >
          {/* Controls panel — sempre visibile, su ogni dimensione di schermo */}
          <div className="flex bg-card rounded-xl shadow-sm border border-border p-4 flex-col gap-3.5 flex-shrink-0">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-1.5 tracking-tight">
                Esplora Eventi
              </h2>
              <div className="flex flex-col gap-1">
                <p className="font-serif text-base font-semibold text-foreground leading-snug">
                  Il tuo calendario sardo:
                </p>
                <p className="text-sm text-muted-foreground">
                  vivi la tua Sardegna.
                </p>
              </div>
            </div>

            {/* Barra di ricerca testuale — a pillola, piena larghezza */}
            <div className="relative">
              <Search className="absolute inset-y-0 left-3.5 my-auto w-3.5 h-3.5 pointer-events-none text-muted-foreground" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Cerca per titolo, città o locale..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-full pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Date range picker — piena larghezza, stessa "riga" della ricerca */}
            <DateFilter
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Categorie principali — pillole outline: la selezionata ha il
                bordo in terracotta (l'accento principale, usato con
                parsimonia), le altre in verde salvia. Vanno tutte a capo,
                cosi' sono visibili tutte insieme anche su mobile. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Categorie</span>
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const categoryIcons: Record<string, string> = {
                    Musica: "🎵",
                    Teatro: "🎭",
                    Cinema: "🎬",
                    Arte: "🎨",
                    Incontro: "🗣️",
                    Enogastronomia: "🍷",
                    Folklore: "🥁",
                    Sport: "🏆",
                    "Eventi per Bambini": "🎈",
                  };

                  return Object.entries(categoryIcons).map(([catName, icon]) => {
                    const isSelected = selectedCategories.includes(catName);
                    return (
                      <button
                        key={catName}
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            isSelected ? prev.filter((c) => c !== catName) : [...prev, catName]
                          )
                        }
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] border-2 font-semibold cursor-pointer transition-all shrink-0 bg-transparent ${
                          isSelected
                            ? "border-primary text-primary"
                            : "border-secondary/40 text-secondary hover:border-secondary hover:bg-secondary/5"
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{catName}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Tag attivo (impostato cliccando un tag su una card) */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200 text-[10px] font-semibold px-2 py-1 rounded-full border border-sky-300 dark:border-sky-700/60"
                  >
                    Tag: {tag}
                    <button
                      type="button"
                      onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                      className="hover:text-red-600 cursor-pointer bg-transparent border-none p-0"
                      aria-label={`Rimuovi filtro tag ${tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Indicatori filtri attivi e tasto reset */}
            {(searchQuery || selectedCategories.length > 0 || selectedTags.length > 0 || dateRange) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategories([]);
                  setSelectedTags([]);
                  setDateRange(undefined);
                }}
                className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 py-1.5 rounded-md border border-red-200 transition-colors cursor-pointer w-full"
              >
                ✕ Azzera Tutti i Filtri
              </button>
            )}
          </div>

          {/* Mappa: SEMPRE visibile sotto "lg", subito dopo i filtri - via
              pura media query CSS (block/lg:hidden), MAI dietro a un
              calcolo di larghezza in JavaScript. Su alcuni telefoni (anche
              Chrome, fascia bassa) il rilevamento "e' desktop?" in JS puo'
              sbagliare e nascondere per errore un blocco condizionato da
              quello - mettendo la mappa fuori da qualunque condizione JS
              non puo' piu' succedere. A schermi lg in su questo blocco e'
              nascosto: la' la mappa vive nell'area affiancata piu' sotto,
              o come vista "larga" quando si sceglie la modalita' mappa. */}
          <div
            className="relative block lg:hidden flex-1 rounded-xl overflow-hidden shadow-sm border border-border"
            style={{ height: altezzaMappaMobile }}
          >
            <MapContainer
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              interattiva={false}
            />
            <div
              className="absolute inset-0 z-[999]"
              onClick={() => setMappaEspansa(true)}
              aria-label="Tocca per espandere e navigare la mappa"
            />
            <button
              type="button"
              onClick={() => setMappaEspansa(true)}
              title="Espandi la mappa per navigarla meglio"
              className="absolute top-3 left-3 z-[1001] flex items-center justify-center w-9 h-9 rounded-lg bg-card/95 border border-border shadow-sm text-foreground cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Lista eventi: sotto la mappa su mobile (sempre raggiungibile
              scorrendo), contenuto principale della sidebar su desktop
              quando si sceglie "Lista" invece di "Mappa". */}
          {showEventList && (
            <div
              className="flex-1 h-[var(--h-mappa-mobile)] lg:h-auto lg:min-h-0 flex flex-col"
              style={{ "--h-mappa-mobile": `${altezzaMappaMobile}px` } as CSSProperties}
            >
              <EventList
                events={filteredEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                onTagClick={handleTagClick}
                isLoading={isLoading}
                isError={isError}
              />
            </div>
          )}

          {/* Mappa "larga": solo da lg in su, quando si sceglie la modalita'
              Mappa al posto della lista - su mobile la mappa e' gia' sempre
              visibile piu' sopra, quindi qui resta nascosta. */}
          {!showEventList && (
            <div className="relative hidden lg:block flex-1 lg:h-auto lg:min-h-0 rounded-xl overflow-hidden shadow-sm border border-border mt-0">
              <MapContainer
                events={filteredEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                interattiva
              />
            </div>
          )}
        </aside>

        {/* ── Right map area — solo da schermi grandi in su, quando la lista e' visibile.
            Sotto lg, lista e mappa condividono la stessa area (il toggle "Mappa"
            decide quale delle due mostrare) invece di impilarsi una sopra l'altra. ── */}
        {showEventList && (
          <div className="relative hidden lg:block flex-1 rounded-xl overflow-hidden shadow-sm border border-border min-h-0">
            <MapContainer
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              interattiva
            />
            <button
              type="button"
              onClick={() => setMappaEspansa(true)}
              title="Espandi la mappa per navigarla meglio"
              className="absolute top-3 left-3 z-[1001] flex items-center justify-center w-9 h-9 rounded-lg bg-card/95 border border-border shadow-sm text-foreground cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
        </>
      )}

      {/* Public Event Details Overlay */}
      {(() => {
        const getImageUrl = (ev: any) => {
          return getEventImageUrl(ev?.immagine);
        };

        return selectedEventDetail ? (
          <ErrorBoundary fallbackTitle="Non riesco a mostrare questo evento">
            <EventDetailsModalPublic
              event={selectedEventDetail}
              onClose={() => setLocation("/")}
              allEvents={events}
              onSelectEvent={handleSelectEvent}
              imageUrl={getImageUrl}
              onTagClick={handleTagClick}
            />
          </ErrorBoundary>
        ) : null;
      })()}
    </div>
  );
}
