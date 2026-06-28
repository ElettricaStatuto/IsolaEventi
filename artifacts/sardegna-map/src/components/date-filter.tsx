import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { it } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "react-day-picker/style.css";

interface DateFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function DateFilter({ dateRange, onDateRangeChange }: DateFilterProps) {
  const [open, setOpen] = useState(false);

  const label = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "d MMM", { locale: it })} → ${format(dateRange.to, "d MMM", { locale: it })}`
      : format(dateRange.from, "d MMM yyyy", { locale: it })
    : "Filtra per date";

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
          <DayPicker
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              if (range?.from && range?.to) setOpen(false);
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
