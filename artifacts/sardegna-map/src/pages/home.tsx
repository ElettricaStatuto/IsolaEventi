import { useState, useEffect } from "react";
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

export function Home() {
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/eventi/:idAndSlug");
  const [, setLocation] = useLocation();
  // Su schermi piccoli (sotto lg) si parte dalla mappa, non dalla lista -
  // su mobile e' quello che si vuole vedere subito aprendo il sito. Da lg
  // in su lista e mappa sono affiancate, quindi si parte comunque con la
  // lista visibile a sinistra.
  const [showEventList, setShowEventList] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
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
      {/* Mappa espansa: nasconde tutto il resto (filtri, lista, "vicino a
          te") per navigare solo la mappa, su qualunque dimensione di
          schermo - un'esplicita scelta dell'utente, non lo stato di default. */}
      {mappaEspansa ? (
        <div className="relative flex-1 h-[calc(100dvh-4rem)] rounded-xl overflow-hidden shadow-sm border border-border">
          <MapContainer
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
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

          {/* Scrollable event list — shown when "Mappa" is OFF. Altezza fissa
              (non solo min-height) su mobile: un discendente con height:100%
              (la ScrollArea di Leaflet/EventList) non si risolve contro un
              antenato che ha solo min-height e nessuna altezza esplicita -
              resterebbe alto 0px. Da lg in su torna al comportamento
              originale (flex-1 dentro la colonna ad altezza piena). */}
          {showEventList && (
            <div className="flex-1 h-[70vh] lg:h-auto lg:min-h-0 flex flex-col">
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

          {/* Map in sidebar — shown when "Mappa" is ON (no gap, flush under controls) */}
          {!showEventList && (
            <div className="relative flex-1 h-[70vh] lg:h-auto lg:min-h-0 rounded-xl overflow-hidden shadow-sm border border-border mt-0">
              <MapContainer
                events={filteredEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
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
