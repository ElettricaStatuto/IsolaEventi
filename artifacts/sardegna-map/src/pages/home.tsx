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
  const [showEventList, setShowEventList] = useState(true);

  // Listen for global "toggle-map-view" event from the nav "Mappa" button
  useEffect(() => {
    const handleToggle = () => setShowEventList((prev) => !prev);
    window.addEventListener("toggle-map-view", handleToggle);
    return () => window.removeEventListener("toggle-map-view", handleToggle);
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
