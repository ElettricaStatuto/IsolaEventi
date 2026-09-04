import { useState, useEffect } from "react";
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
import { getAssetUrl, getEventImageUrl } from "../lib/utils";

export function Home() {
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/eventi/:idAndSlug");
  const [, setLocation] = useLocation();
  const [showEventList, setShowEventList] = useState(true);
  // Su mobile, il pannello filtri (ricerca/date/categorie) e' molto alto e
  // schiaccia la mappa quando si e' in "modalita' mappa". Lo teniamo
  // espanso di default in modalita' lista (dove serve subito), compresso
  // in modalita' mappa (dove l'utente vuole vedere la mappa, non i filtri) -
  // resta comunque riapribile con un tocco. Da schermi lg in su i filtri
  // restano sempre visibili, indipendentemente da questo stato.
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Listen for global "toggle-map-view" event from the nav "Mappa" button
  useEffect(() => {
    const handleToggle = () => setShowEventList((prev) => !prev);
    window.addEventListener("toggle-map-view", handleToggle);
    return () => window.removeEventListener("toggle-map-view", handleToggle);
  }, []);

  useEffect(() => {
    setFiltersExpanded(showEventList);
  }, [showEventList]);

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
    <div className="flex flex-col h-[calc(100dvh-4rem)] gap-0">
      {/* ── Sidebar + Map layout ── */}
      <div className="flex flex-1 gap-4 min-h-0 lg:flex-row flex-col">
        {/* ── Left sidebar: controls always on top, then list or map below ── */}
        <aside
          className={
            showEventList
              ? "w-full lg:w-[380px] xl:w-[440px] flex-shrink-0 flex flex-col gap-3 h-full min-h-0 min-w-0"
              : "w-full lg:flex-[2] flex-shrink-0 flex flex-col gap-0 h-full min-h-0 min-w-0"
          }
        >
          {/* Barra compatta: solo su mobile, solo quando i filtri sono chiusi
              (di norma in modalita' mappa) - un tocco per riaprirli. */}
          {!filtersExpanded && (
            <button
              type="button"
              onClick={() => setFiltersExpanded(true)}
              className="lg:hidden flex items-center justify-center gap-2 bg-card rounded-xl shadow-sm border border-border px-4 py-2.5 flex-shrink-0 text-sm font-semibold text-foreground cursor-pointer"
            >
              🔍 Filtri e ricerca
              {(searchQuery || selectedCategories.length > 0 || selectedTags.length > 0 || dateRange) && (
                <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          )}

          {/* Controls panel */}
          <div className={`${filtersExpanded ? "flex" : "hidden lg:flex"} bg-card rounded-xl shadow-sm border border-border p-4 flex-col gap-3.5 flex-shrink-0`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-0.5">
                  Esplora Eventi
                </h2>
                <div className="flex flex-col gap-0.5">
                  <p className="font-serif text-base font-semibold text-foreground leading-snug">
                    Il tuo calendario sardo:
                  </p>
                  <p className="text-sm text-muted-foreground">
                    vivi la tua Sardegna.
                  </p>
                </div>
              </div>
              {!showEventList && (
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(false)}
                  className="lg:hidden text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer shrink-0 mt-0.5"
                >
                  Mostra mappa ✕
                </button>
              )}
            </div>

            {/* Barra di ricerca testuale */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground text-sm">🔍</span>
              <input
                type="text"
                placeholder="Cerca per titolo, città o locale..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Date range picker */}
            <DateFilter
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Categorie principali */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Categorie</span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {(() => {
                  const categoryStyles: Record<string, { color: string; icon: string }> = {
                    Musica: { color: "#3b82f6", icon: "🎵" },
                    Teatro: { color: "#8b5cf6", icon: "🎭" },
                    Cinema: { color: "#ec4899", icon: "🎬" },
                    Arte: { color: "#10b981", icon: "🎨" },
                    Incontro: { color: "#f59e0b", icon: "🗣️" },
                    Enogastronomia: { color: "#ea580c", icon: "🍷" },
                    Folklore: { color: "#dc2626", icon: "🥁" },
                    Sport: { color: "#06b6d4", icon: "🏆" },
                    "Eventi per Bambini": { color: "#84cc16", icon: "🎈" },
                  };

                  return Object.entries(categoryStyles).map(([catName, style]) => {
                    const isSelected = selectedCategories.includes(catName);
                    return (
                      <button
                        key={catName}
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            isSelected ? prev.filter((c) => c !== catName) : [...prev, catName]
                          )
                        }
                        style={{
                          borderColor: isSelected ? style.color : "transparent",
                          backgroundColor: isSelected ? `${style.color}15` : "",
                          color: isSelected ? style.color : "",
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] border font-semibold cursor-pointer transition-all ${
                          isSelected 
                            ? "shadow-sm border-2" 
                            : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/40"
                        }`}
                      >
                        <span>{style.icon}</span>
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

          {/* Scrollable event list — shown when "Mappa" is OFF */}
          {showEventList && (
            <EventList
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              onTagClick={handleTagClick}
              isLoading={isLoading}
              isError={isError}
            />
          )}

          {/* Map in sidebar — shown when "Mappa" is ON (no gap, flush under controls) */}
          {!showEventList && (
            <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-border min-h-0 mt-0">
              <MapContainer
                events={filteredEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
              />
            </div>
          )}
        </aside>

        {/* ── Right map area — solo da schermi grandi in su, quando la lista e' visibile.
            Sotto lg, lista e mappa condividono la stessa area (il toggle "Mappa"
            decide quale delle due mostrare) invece di impilarsi una sopra l'altra. ── */}
        {showEventList && (
          <div className="hidden lg:block flex-1 rounded-xl overflow-hidden shadow-sm border border-border min-h-0">
            <MapContainer
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}
      </div>

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
