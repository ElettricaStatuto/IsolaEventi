import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Navigation, Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay, addDays, isSaturday, isSunday, nextSaturday, endOfWeek, endOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import type { Event } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useUserLocation } from "../hooks/use-user-location";
import { WeatherBadge } from "../hooks/use-weather";
import { getEventImageUrl, distanzaKm, stimaDistanzaStradaleKm } from "../lib/utils";

type Periodo = "oggi" | "weekend" | "settimana" | "mese";

const PERIODO_LABEL: Record<Periodo, string> = {
  oggi: "Oggi",
  weekend: "Questo weekend",
  settimana: "Questa settimana",
  mese: "Questo mese",
};

/** Intervallo [inizio, fine] di date coperto dal periodo scelto, a partire da oggi. */
function intervalloPeriodo(periodo: Periodo): [Date, Date] {
  const oggi = startOfDay(new Date());
  switch (periodo) {
    case "oggi":
      return [oggi, endOfDay(oggi)];
    case "weekend": {
      let sabato: Date;
      if (isSaturday(oggi)) sabato = oggi;
      else if (isSunday(oggi)) sabato = addDays(oggi, -1);
      else sabato = nextSaturday(oggi);
      return [sabato, endOfDay(addDays(sabato, 1))];
    }
    case "settimana":
      return [oggi, endOfDay(endOfWeek(oggi, { weekStartsOn: 1 }))];
    case "mese":
      return [oggi, endOfDay(endOfMonth(oggi))];
  }
}

function eventoNelPeriodo(evt: Event, inizio: Date, fine: Date): boolean {
  if (!evt.data_inizio) return false;
  const evtInizio = new Date(`${evt.data_inizio}T00:00:00`);
  const evtFine = evt.data_fine ? new Date(`${evt.data_fine}T23:59:59`) : endOfDay(evtInizio);
  return evtInizio <= fine && evtFine >= inizio;
}

interface NearbySectionProps {
  events: Event[];
  /** Categorie attualmente selezionate nei filtri della pagina - se presenti,
   * la sezione mostra solo quelle (riusa la stessa preferenza espressa li',
   * invece di introdurre un sistema di preferenze separato). */
  selectedCategories: string[];
  onSelectEvent: (id: number) => void;
}

export function NearbySection({ events, selectedCategories, onSelectEvent }: NearbySectionProps) {
  const [periodo, setPeriodo] = useState<Periodo>("settimana");
  const location = useUserLocation();

  const eventiFiltrati = useMemo(() => {
    const [inizio, fine] = intervalloPeriodo(periodo);

    let risultato = events.filter((evt) => {
      if (evt.latitudine == null || evt.longitudine == null) return false; // "vicino a te" richiede una posizione nota
      if (!eventoNelPeriodo(evt, inizio, fine)) return false;
      if (selectedCategories.length > 0 && !(evt.categoria && selectedCategories.includes(evt.categoria))) return false;
      return true;
    });

    if (location.position) {
      const { lat, lon } = location.position;
      risultato = risultato
        .map((evt) => ({
          evt,
          km: distanzaKm(lat, lon, evt.latitudine as number, evt.longitudine as number),
        }))
        .sort((a, b) => a.km - b.km)
        .map((r) => r.evt);
    } else {
      risultato = [...risultato].sort(
        (a, b) => new Date(a.data_inizio || 0).getTime() - new Date(b.data_inizio || 0).getTime()
      );
    }

    return risultato.slice(0, 12);
  }, [events, periodo, selectedCategories, location.position]);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-serif text-xl font-semibold text-foreground tracking-tight">
          Nei prossimi giorni, vicino a te
        </h2>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:border-primary/50 transition-colors cursor-pointer"
            >
              {PERIODO_LABEL[periodo]}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {PERIODO_LABEL[p]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Attivazione posizione: una tantum, ricordata per le prossime visite */}
      {location.state !== "pronto" && (
        <button
          type="button"
          onClick={location.richiedi}
          disabled={location.state === "richiedendo"}
          className="self-start flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer disabled:opacity-60"
        >
          {location.state === "richiedendo" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rilevo la tua posizione…
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" /> Attiva la posizione per ordinare per vicinanza
            </>
          )}
        </button>
      )}
      {location.state === "errore" && (
        <span className="text-xs text-muted-foreground">{location.errorMessage}</span>
      )}

      {eventiFiltrati.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nessun evento trovato per questo periodo{selectedCategories.length > 0 ? " con le categorie selezionate" : ""}.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {eventiFiltrati.map((evt) => {
            const img = getEventImageUrl(evt.immagine);
            const km = location.position
              ? distanzaKm(location.position.lat, location.position.lon, evt.latitudine as number, evt.longitudine as number)
              : null;
            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => onSelectEvent(evt.id)}
                className="flex-shrink-0 w-[220px] text-left rounded-lg border border-border bg-background hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer overflow-hidden flex flex-col"
              >
                <span className="text-xs font-bold text-foreground leading-snug px-2.5 pt-2.5 pb-1.5 line-clamp-2">
                  {evt.titolo}
                </span>

                <div className="w-full h-24 bg-muted flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Navigation className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>

                <div className="p-2.5 flex flex-col gap-1">
                  {evt.categoria && (
                    <span className="self-start text-[10px] font-semibold text-secondary uppercase tracking-wide bg-secondary/10 border border-secondary/25 rounded-full px-2 py-0.5 mb-0.5">
                      {evt.categoria}
                    </span>
                  )}
                  <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {evt.data_inizio && format(new Date(`${evt.data_inizio}T00:00:00`), "EEEE d MMMM", { locale: it })}
                    </span>
                    {evt.luogo && <span>{evt.luogo}</span>}
                    <div className="flex items-center gap-1.5">
                      {km != null && (() => {
                        const stradale = stimaDistanzaStradaleKm(km);
                        return <span>{stradale < 1 ? "< 1 km di strada" : `~${Math.round(stradale)} km di strada`}</span>;
                      })()}
                      <WeatherBadge latitudine={evt.latitudine} longitudine={evt.longitudine} dataInizio={evt.data_inizio} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
