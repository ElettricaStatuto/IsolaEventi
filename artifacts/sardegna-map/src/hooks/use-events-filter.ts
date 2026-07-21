import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Event } from "@workspace/api-client-react";

export function useEventsFilter(events: Event[] = []) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    let list = events;

    // 1. Filter by date if range is selected
    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

      list = list.filter((evt) => {
        if (!evt.data_inizio) return true;
        const evtStart = parseISO(evt.data_inizio);
        const evtEnd = evt.data_fine ? parseISO(evt.data_fine) : evtStart;
        return evtStart <= to && evtEnd >= from;
      });
    }

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((evt) => {
        const titleMatch = evt.titolo?.toLowerCase().includes(q);
        const locationMatch = evt.luogo?.toLowerCase().includes(q);
        const addrMatch = evt.dettagli_extra?.indirizzo_completo?.toLowerCase().includes(q);
        return titleMatch || locationMatch || addrMatch;
      });
    }

    // 3. Filter by category
    if (selectedCategory) {
      list = list.filter((evt) => evt.categoria === selectedCategory);
    }

    // 4. Filter by tag
    if (selectedTag) {
      list = list.filter((evt) => evt.tags?.includes(selectedTag));
    }

    // 5. Sort events: future events first (ascending by start date), then past events (descending by start date)
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${day}`;

    return [...list].sort((a, b) => {
      const getIsPast = (evt: Event) => {
        if (!evt.data_inizio) return false;
        // Event is past only if its end date is past, or if there's no end date, its start date is past
        const compareDate = evt.data_fine || evt.data_inizio;
        return compareDate < localTodayStr;
      };

      const isPastA = getIsPast(a);
      const isPastB = getIsPast(b);

      if (isPastA !== isPastB) {
        return isPastA ? 1 : -1; // Future first, past second
      }

      if (!isPastA) {
        // Both are future: sort by data_inizio ascending
        if (!a.data_inizio) return 1;
        if (!b.data_inizio) return -1;
        return a.data_inizio.localeCompare(b.data_inizio);
      } else {
        // Both are past: sort by data_inizio descending
        if (!a.data_inizio) return 1;
        if (!b.data_inizio) return -1;
        return b.data_inizio.localeCompare(a.data_inizio);
      }
    });
  }, [events, dateRange, searchQuery, selectedCategory, selectedTag]);

  return {
    filteredEvents,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
  };
}
