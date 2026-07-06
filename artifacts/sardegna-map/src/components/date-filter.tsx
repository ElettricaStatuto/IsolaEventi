import { useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { it } from "date-fns/locale";
import { eachDayOfInterval, format, isAfter, isBefore } from "date-fns";
import { CalendarDays, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import "react-day-picker/style.css";

// CSS custom per rendere l'hover preview più delicato
const styles = `
  .rdp-day_range_preview {
    background-color: hsl(var(--primary) / 0.1) !important;
    color: hsl(var(--primary));
  }
`;

interface DateFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function DateFilter({ dateRange, onDateRangeChange }: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | undefined>(undefined);

  const label = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "d MMM", { locale: it })} → ${format(dateRange.to, "d MMM", { locale: it })}`
      : format(dateRange.from, "d MMM yyyy", { locale: it })
    : "Seleziona date";

  const summaryText = useMemo(() => {
    if (!dateRange?.from) return "Seleziona data di inizio";
    if (!dateRange?.to) return "Seleziona data di fine";
    return `Intervallo: ${format(dateRange.from, "d MMM", { locale: it })} - ${format(dateRange.to, "d MMM", { locale: it })}`;
  }, [dateRange]);

  const previewDays = useMemo(() => {
    if (!dateRange?.from || dateRange?.to || !hoverDate) return [];

    // Non mostrare preview se l'hover è prima dell'inizio
    if (isBefore(hoverDate, dateRange.from)) return [];

    return eachDayOfInterval({ start: dateRange.from, end: hoverDate });
  }, [dateRange, hoverDate]);

  return (
    <div className="flex items-center gap-1.5">
      <style>{styles}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={dateRange?.from ? "default" : "outline"}
            size="sm"
            className="gap-2 transition-all"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-xl" align="start">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">{summaryText}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onDateRangeChange(undefined)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
          <DayPicker
            mode="range"
            // Visualizza 1 mese su mobile, 2 su desktop
            numberOfMonths={
              typeof window !== "undefined" && window.innerWidth < 768 ? 1 : 2
            }
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              // Chiudi solo quando l'intervallo è completo
              if (range?.from && range?.to) setOpen(false);
            }}
            onDayMouseEnter={(day) => setHoverDate(day)}
            onDayMouseLeave={() => setHoverDate(undefined)}
            modifiers={{ range_preview: previewDays }}
            modifiersClassNames={{ range_preview: "rdp-day_range_preview" }}
            locale={it}
            className="p-3"
            // Opzionale: disabilita date passate
            // disabled={{ before: new Date() }}
          />
        </PopoverContent>
      </Popover>

      {dateRange?.from && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => onDateRangeChange(undefined)}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
