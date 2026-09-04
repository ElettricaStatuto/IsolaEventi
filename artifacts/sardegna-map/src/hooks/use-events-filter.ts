import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Event } from "@workspace/api-client-react";

export function useEventsFilter(events: Event[] = []) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  // Piu' categorie possono essere selezionate insieme: un evento passa il
  // filtro se la sua categoria e' una qualunque di quelle scelte (OR), non
  // solo un'unica categoria esclusiva come prima.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Come le categorie: un evento passa se ha ALMENO uno dei tag selezionati.
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

    // 3. Filter by category (un evento passa se la sua categoria e' una
    // qualsiasi tra quelle selezionate)
    if (selectedCategories.length > 0) {
      list = list.filter((evt) => evt.categoria && selectedCategories.includes(evt.categoria));
    }

    // 4. Filter by tag (un evento passa se ha almeno uno dei tag selezionati)
    if (selectedTags.length > 0) {
      list = list.filter((evt) => evt.tags?.some((t) => selectedTags.includes(t)));
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
  }, [events, dateRange, searchQuery, selectedCategories, selectedTags]);

  return {
    filteredEvents,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    selectedTags,
    setSelectedTags,
  };
}
