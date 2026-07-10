import { useState, useEffect } from "react";
import { useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { useEventsFilter } from "../hooks/use-events-filter";
import { DateFilter } from "../components/date-filter";
import { EventList } from "../components/event-list";
import { MapContainer } from "../components/map-container";

export function Home() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for global "toggle-map-fullscreen" event from the nav "Mappa" button
  useEffect(() => {
    const handleToggle = () => setIsFullscreen((prev) => !prev);
    window.addEventListener("toggle-map-fullscreen", handleToggle);
    return () => window.removeEventListener("toggle-map-fullscreen", handleToggle);
  }, []);

  // Fetch all events (no server-side date filter — filtering happens client-side)
  const { data: events = [], isLoading, isError } = useListEvents(
    {},
    { query: { queryKey: getListEventsQueryKey({}) } }
  );

  // Client-side date range filtering
  const { filteredEvents, dateRange, setDateRange } = useEventsFilter(events);

  const handleSelectEvent = (id: number) => {
    setSelectedEventId(id);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* ── Sidebar + Map layout ── */}
      <div className="flex flex-1 gap-4 min-h-0 lg:flex-row flex-col">

        {/* ── Left sidebar (hidden when fullscreen) ── */}
        {!isFullscreen && (
          <aside className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col gap-3 h-full min-h-0">
            {/* Controls panel */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4 flex flex-col gap-3 flex-shrink-0">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-0.5">
                  Esplora Eventi
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sagre e festival in Sardegna.
                </p>
              </div>

              {/* Date range picker */}
              <DateFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>

            {/* Scrollable event list */}
            <EventList
              events={filteredEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              isLoading={isLoading}
              isError={isError}
            />
          </aside>
        )}

        {/* ── Map area ── */}
        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-50 bg-background"
              : "flex-1 rounded-xl overflow-hidden shadow-sm border border-border min-h-[50vh] lg:min-h-0"
          }
        >
          <MapContainer
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      </div>
    </div>
  );
}
