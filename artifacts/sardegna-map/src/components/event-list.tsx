import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, ExternalLink, Loader2, Flag } from "lucide-react";
import { format } from "date-fns";
import type { Event } from "@workspace/api-client-react";
import { Link } from "wouter";

interface EventListProps {
  events: Event[];
  selectedEventId: number | null;
  onSelectEvent: (id: number) => void;
  isLoading?: boolean;
  isError?: boolean;
}

export function EventList({
  events,
  selectedEventId,
  onSelectEvent,
  isLoading,
  isError,
}: EventListProps) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto-scroll to selected event when triggered from map marker click
  useEffect(() => {
    if (selectedEventId === null) return;
    const el = cardRefs.current.get(selectedEventId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedEventId]);

  return (
    <div className="flex-1 bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col min-h-0">
      <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
        <p className="text-sm font-medium text-foreground">
          {isLoading ? "Caricamento..." : `${events.length} event${events.length === 1 ? "o" : "i"} trovati`}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 flex flex-col gap-3">
          {isLoading && (
            <div className="flex justify-center p-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {isError && (
            <div className="text-center p-4 text-destructive text-sm">
              Errore nel caricamento degli eventi.
            </div>
          )}
          {!isLoading && !isError && events.length === 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              Nessun evento nel periodo selezionato.
            </div>
          )}
          {!isLoading &&
            !isError &&
            events.map((evt) => {
              const isFestival = events.some(e => e.parent_id === evt.id);
              
              // Nascondi i sotto-eventi dalla lista principale per non creare confusione
              // (verranno visti nella pagina del festival o sulla mappa)
              if (evt.parent_id) return null;

              return (
                <div
                  key={evt.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(evt.id, el);
                    else cardRefs.current.delete(evt.id);
                  }}
                >
                  <Card
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      selectedEventId === evt.id
                        ? "border-primary shadow-sm bg-primary/5"
                        : "bg-card"
                    }`}
                    onClick={() => onSelectEvent(evt.id)}
                  >
                    <CardContent className="p-4 relative">
                      {isFestival && (
                        <div className="absolute top-4 right-4 bg-primary/10 text-primary p-1.5 rounded-md">
                          <Flag className="w-4 h-4" />
                        </div>
                      )}
                      <h3 className="font-bold text-foreground mb-2 leading-tight text-sm pr-8">
                        {evt.titolo}
                      </h3>
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        {evt.data_inizio && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              {format(new Date(evt.data_inizio), "dd/MM/yyyy")}
                              {evt.data_fine && evt.data_fine !== evt.data_inizio
                                ? ` - ${format(new Date(evt.data_fine), "dd/MM/yyyy")}`
                                : ""}
                            </span>
                          </div>
                        )}
                        {evt.luogo && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-secondary" />
                            <span className="font-medium">{evt.luogo}</span>
                          </div>
                        )}
                        
                        {isFestival ? (
                           <Link href={`/festival/${evt.id}`}>
                             <a className="flex items-center gap-1 text-primary hover:underline mt-2 font-medium bg-primary/5 w-fit px-2 py-1 rounded-md" onClick={(e) => e.stopPropagation()}>
                               Vedi Programma Festival
                             </a>
                           </Link>
                        ) : (
                          evt.link && (
                            <a
                              href={evt.link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Vedi fonte
                            </a>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
