import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Event } from "@workspace/api-client-react";

export function useEventsFilter(events: Event[] = []) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filteredEvents = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");

    // Filter out past events that are NOT festivals
    const baseList = events.filter((evt) => {
      const isPast = evt.data_fine
        ? evt.data_fine < todayStr
        : (evt.data_inizio ? evt.data_inizio < todayStr : false);

      if (isPast) {
        // Keep only if it is a festival (has children connected to it)
        const hasChildren = events.some((e) => e.parent_id === evt.id);
        return hasChildren;
      }
      return true;
    });

    if (!dateRange?.from) return baseList;

    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    return baseList.filter((evt) => {
      if (!evt.data_inizio) return true;
      const evtStart = parseISO(evt.data_inizio);
      const evtEnd = evt.data_fine ? parseISO(evt.data_fine) : evtStart;
      // Include event if it overlaps with selected range
      return evtStart <= to && evtEnd >= from;
    });
  }, [events, dateRange]);

  return { filteredEvents, dateRange, setDateRange };
}
