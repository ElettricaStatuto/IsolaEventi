import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Event } from "@workspace/api-client-react";

export function useEventsFilter(events: Event[] = []) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filteredEvents = useMemo(() => {
    if (!dateRange?.from) return events;

    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    return events.filter((evt) => {
      if (!evt.data_inizio) return true;
      const evtStart = parseISO(evt.data_inizio);
      const evtEnd = evt.data_fine ? parseISO(evt.data_fine) : evtStart;
      // Include event if it overlaps with selected range
      return evtStart <= to && evtEnd >= from;
    });
  }, [events, dateRange]);

  return { filteredEvents, dateRange, setDateRange };
}
