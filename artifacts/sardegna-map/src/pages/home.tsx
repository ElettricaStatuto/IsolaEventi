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

export function Home() {
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/eventi/:idAndSlug");
  const [, setLocation] = useLocation();
  const [showEventList, setShowEventList] = useState(true);

  // Listen for global "toggle-map-view" event from the nav "Mappa" button
  useEffect(() => {
    const handleToggle = () => setShowEventList((prev) => !prev);
    window.addEventListener("toggle-map-view", handleToggle);
    return () => window.removeEventListener("toggle-map-view", handleToggle);
  }, []);

  // Fetch all events (no server-side date filter — filtering happens client-side)
  const {
    data: events = [],
    isLoading,
    isError,
  } = useListEvents({}, { query: { queryKey: getListEventsQueryKey({}) } });

  // Derive selectedEventId from URL
  const selectedEventId = params?.idAndSlug ? parseInt(params.idAndSlug.split("-")[0], 10) : null;

  // Client-side date range filtering
  const {
    filteredEvents,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
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
      setLocation("/");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* ── Sidebar + Map layout ── */}
      <div className="flex flex-1 gap-4 min-h-0 lg:flex-row flex-col">
        {/* ── Left sidebar: controls always on top, then list or map below ── */}
        <aside
          className={
            showEventList
              ? "w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col gap-3 h-full min-h-0"
              : "w-full lg:flex-[2] flex-shrink-0 flex flex-col gap-0 h-full min-h-0"
          }
        >
          {/* Controls panel */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-4 flex flex-col gap-3.5 flex-shrink-0">
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
                    Bambini: { color: "#84cc16", icon: "🎈" },
                  };

                  return Object.entries(categoryStyles).map(([catName, style]) => {
                    const isSelected = selectedCategory === catName;
                    return (
                      <button
                        key={catName}
                        onClick={() => setSelectedCategory(isSelected ? null : catName)}
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

            {/* Indicatori filtri attivi e tasto reset */}
            {(searchQuery || selectedCategory || dateRange) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
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

        {/* ── Right map area — only when event list is visible ── */}
        {showEventList && (
          <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-border min-h-[50vh] lg:min-h-0">
            <MapContainer
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}
      </div>
    </div>
  );
}
