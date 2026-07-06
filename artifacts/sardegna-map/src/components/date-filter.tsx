import { useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { it } from "date-fns/locale";
import { eachDayOfInterval, format, isAfter } from "date-fns";
import { CalendarDays, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "react-day-picker/style.css";

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
    : "Filtra per date";

  const step: "start" | "end" | "done" = !dateRange?.from
    ? "start"
    : !dateRange?.to
      ? "end"
      : "done";

  const summaryText = useMemo(() => {
    if (step === "start") return "Seleziona la data di inizio";
    if (step === "end") return "Seleziona la data di fine";
    if (dateRange?.from && dateRange?.to) {
      return `Intervallo: ${format(dateRange.from, "d MMM", { locale: it })} - ${format(dateRange.to, "d MMM", { locale: it })}`;
    }
    return "";
  }, [step, dateRange]);

  // Manual hover preview: only meaningful while waiting for the second click.
  const previewDays = useMemo(() => {
    if (step !== "end" || !dateRange?.from || !hoverDate) return [];
    const [start, end] = isAfter(dateRange.from, hoverDate)
      ? [hoverDate, dateRange.from]
      : [dateRange.from, hoverDate];
    return eachDayOfInterval({ start, end });
  }, [step, dateRange, hoverDate]);

  const handleReset = () => {
    onDateRangeChange(undefined);
    setHoverDate(undefined);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={dateRange?.from ? "default" : "outline"}
            size="sm"
            className={`gap-2 ${dateRange?.from ? "bg-primary text-primary-foreground" : ""}`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
          <div className="flex items-center justify-between gap-3 px-3 pt-3">
            <p className="text-sm font-medium text-foreground">{summaryText}</p>
            {(dateRange?.from || hoverDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
              >
                <RotateCcw className="w-3 h-3" />
                Pulisci filtri
              </Button>
            )}
          </div>
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              if (range?.from && range?.to) {
                setHoverDate(undefined);
                setOpen(false);
              }
            }}
            onDayMouseEnter={(day) => setHoverDate(day)}
            onDayMouseLeave={() => setHoverDate(undefined)}
            modifiers={{ range_preview: previewDays }}
            modifiersStyles={{
              range_preview: {
                backgroundColor: "hsl(var(--primary) / 0.15)",
                borderRadius: 0,
              },
            }}
            locale={it}
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      {dateRange?.from && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground"
          onClick={() => onDateRangeChange(undefined)}
          title="Rimuovi filtro date"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
