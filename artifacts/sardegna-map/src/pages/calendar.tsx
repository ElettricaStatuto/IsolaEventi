import { useMemo } from "react";
import { useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import type { Event } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Clock, MapPin, Flag } from "lucide-react";
import { getEventImageUrl } from "../lib/utils";

function slugify(titolo: string): string {
  return titolo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CalendarPage() {
  const { data: events = [], isLoading, isError } = useListEvents(
    { solo_futuri: true },
    { query: { queryKey: getListEventsQueryKey({ solo_futuri: true }) } }
  );

  const giorni = useMemo(() => {
    // Un evento padre di festival non ha una data unica (attraversa piu' giorni):
    // mostriamo solo i suoi sotto-eventi, ciascuno nel proprio giorno.
    const idConFigli = new Set(
      events.filter((e) => e.parent_id != null).map((e) => e.parent_id)
    );
    const visibili = events.filter((e) => !idConFigli.has(e.id));

    const gruppi = new Map<string, Event[]>();
    for (const ev of visibili) {
      if (!ev.data_inizio) continue;
      const lista = gruppi.get(ev.data_inizio) || [];
      lista.push(ev);
      gruppi.set(ev.data_inizio, lista);
    }

    for (const lista of gruppi.values()) {
      lista.sort((a, b) => {
        const oraA = (a.dettagli_extra as any)?.ora_inizio || "99:99";
        const oraB = (b.dettagli_extra as any)?.ora_inizio || "99:99";
        return String(oraA).localeCompare(String(oraB));
      });
    }

    return Array.from(gruppi.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-destructive">
        Errore nel caricamento del calendario.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Calendario Eventi</h1>
        <p className="text-muted-foreground text-lg">Tutti gli eventi in Sardegna, giorno per giorno.</p>
      </div>

      {giorni.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          Nessun evento in programma al momento.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {giorni.map(([data, eventiDelGiorno]) => {
          const dataObj = new Date(`${data}T00:00:00`);
          const etichetta = format(dataObj, "EEEE d MMMM yyyy", { locale: it });

          return (
            <section key={data} className="flex flex-col gap-3">
              <h2 className="font-serif text-lg font-bold text-foreground sticky top-16 z-10 bg-background/95 backdrop-blur-sm py-2 border-b border-border capitalize">
                {etichetta}
              </h2>
              <div className="flex flex-col gap-2">
                {eventiDelGiorno.map((evt) => {
                  const ora = (evt.dettagli_extra as any)?.ora_inizio as string | undefined;
                  const isFestival = !!evt.is_festival || evt.parent_id != null;
                  const href = `/eventi/${evt.id}-${slugify(evt.titolo)}`;
                  const img = evt.immagine ? getEventImageUrl(evt.immagine) : null;

                  return (
                    <Link key={evt.id} href={href}>
                      <a className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="w-14 h-14 rounded-md object-cover flex-shrink-0 bg-muted"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-md bg-muted flex-shrink-0 flex items-center justify-center text-muted-foreground">
                            <Flag className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{evt.titolo}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {ora && (
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <Clock className="w-3 h-3" /> {ora}
                              </span>
                            )}
                            {evt.luogo && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 flex-shrink-0" /> {evt.luogo}
                              </span>
                            )}
                          </div>
                        </div>
                        {isFestival && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/30 px-2 py-1 rounded-full flex-shrink-0">
                            Festival
                          </span>
                        )}
                      </a>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
