import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, ExternalLink, Loader2, Flag, Share2, Globe, FileText } from "lucide-react";
import { format } from "date-fns";
import type { Event } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";

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

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const jsonLd = selectedEvent ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": selectedEvent.titolo,
    "description": selectedEvent.descrizione || selectedEvent.testo_estratto || "",
    "startDate": selectedEvent.data_inizio,
    ...(selectedEvent.data_fine ? { "endDate": selectedEvent.data_fine } : {}),
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "eventStatus": "https://schema.org/EventScheduled",
    "location": {
      "@type": "Place",
      "name": selectedEvent.luogo || "Sardegna",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": selectedEvent.luogo || "Sardegna",
        "addressRegion": "Sardegna",
        "addressCountry": "IT"
      },
      ...(selectedEvent.latitudine && selectedEvent.longitudine ? {
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": selectedEvent.latitudine,
          "longitude": selectedEvent.longitudine
        }
      } : {})
    },
    ...(selectedEvent.immagine ? { "image": [selectedEvent.immagine.startsWith("http") ? selectedEvent.immagine : `https://sardegnaeventi.it/api/event-images/${selectedEvent.immagine}`] } : {})
  } : null;

  return (
    <div className="flex-1 bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col min-h-0">
      {selectedEvent && (
        <Helmet>
          <title>{`${selectedEvent.titolo} - Sardegna Eventi`}</title>
          <meta name="description" content={selectedEvent.descrizione?.slice(0, 155) || `Dettagli per ${selectedEvent.titolo}`} />
          <meta property="og:title" content={selectedEvent.titolo} />
          <meta property="og:description" content={selectedEvent.descrizione?.slice(0, 155)} />
          {selectedEvent.immagine && <meta property="og:image" content={selectedEvent.immagine} />}
          <script type="application/ld+json">
            {JSON.stringify(jsonLd)}
          </script>
        </Helmet>
      )}

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
                    className={`cursor-pointer transition-all duration-300 ${
                      isFestival
                        ? selectedEventId === evt.id
                          ? "border-amber-500 shadow-md bg-amber-500/5 ring-1 ring-amber-500/30"
                          : "border-amber-200 hover:border-amber-400 bg-amber-50/30 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        : selectedEventId === evt.id
                          ? "border-primary shadow-sm bg-primary/5"
                          : "bg-card hover:border-primary/50"
                    }`}
                    onClick={() => onSelectEvent(evt.id)}
                  >
                    <CardContent className="p-4 relative">
                      {isFestival && (
                        <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1 uppercase">
                          <Flag className="w-3 h-3 text-amber-600 fill-amber-600" />
                          Festival
                        </div>
                      )}
                      <h3 className={`font-bold text-foreground mb-1.5 leading-tight text-sm pr-16 ${isFestival ? "text-amber-950 dark:text-amber-100" : ""}`}>
                        {evt.titolo}
                      </h3>
                      {evt.tags && evt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {evt.tags.map((tag, i) => (
                            <span key={i} className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        {evt.data_inizio && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${isFestival ? "text-amber-600" : ""}`} />
                            <span>
                              {format(new Date(evt.data_inizio), "dd/MM/yyyy")}
                              {evt.data_fine && evt.data_fine !== evt.data_inizio
                                ? ` - ${format(new Date(evt.data_fine), "dd/MM/yyyy")}`
                                : ""}
                            </span>
                          </div>
                        )}
                        {(evt.dettagli_extra?.indirizzo_completo || evt.luogo) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isFestival ? "text-amber-600" : "text-muted-foreground"}`} />
                            <span className="font-medium text-foreground">
                              {(() => {
                                const venue = evt.luogo;
                                const addr = evt.dettagli_extra?.indirizzo_completo;
                                if (venue && addr) {
                                  if (addr.toLowerCase().includes(venue.toLowerCase())) return addr;
                                  return `${venue}, ${addr}`;
                                }
                                return venue || addr || "Sardegna";
                              })()}
                            </span>
                          </div>
                        )}
                        
                        {isFestival ? (
                          <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-amber-200/50">
                            <Link href={`/festival/${evt.id}`}>
                              <a 
                                className="flex items-center gap-1.5 text-white font-semibold bg-amber-600 hover:bg-amber-700 transition-colors w-fit px-3 py-1.5 rounded-md text-xs shadow-sm hover:shadow" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Flag className="w-3.5 h-3.5" />
                                Approfondisci Programma →
                              </a>
                            </Link>
                            
                            {evt.dettagli_extra?.pdf_path && (
                              <a
                                href={`/api/event-pdfs/${String(evt.dettagli_extra.pdf_path).split('/').pop()}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-white font-semibold bg-red-600 hover:bg-red-700 transition-colors w-fit px-3 py-1.5 rounded-md text-xs shadow-sm hover:shadow"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Locandina PDF
                              </a>
                            )}
                            
                            {selectedEventId === evt.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const slug = evt.titolo
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, "-")
                                    .replace(/(^-|-$)/g, "");
                                  const url = `${window.location.origin}/eventi/${evt.id}-${slug}`;
                                  if (navigator.share) {
                                    navigator.share({
                                      title: evt.titolo,
                                      text: evt.descrizione || "",
                                      url: url
                                    }).catch(() => {});
                                  } else {
                                    navigator.clipboard.writeText(url);
                                    alert("Link copiato negli appunti!");
                                  }
                                }}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs bg-transparent border-none cursor-pointer mt-1"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Condividi Festival
                              </button>
                            )}
                          </div>
                        ) : evt.parent_id ? (
                          <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-blue-200/50">
                            <Link href={`/festival/${evt.parent_id}`}>
                              <a 
                                className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors w-fit px-3 py-1.5 rounded-md text-xs shadow-sm hover:shadow" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Flag className="w-3.5 h-3.5 text-blue-500" />
                                Fa parte di un Festival →
                              </a>
                            </Link>
                            
                            {evt.dettagli_extra?.pdf_path && (
                              <a
                                href={`/api/event-pdfs/${String(evt.dettagli_extra.pdf_path).split('/').pop()}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-red-700 font-semibold bg-red-50 hover:bg-red-100 border border-red-200 transition-colors w-fit px-3 py-1.5 rounded-md text-xs shadow-sm hover:shadow"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Locandina PDF
                              </a>
                            )}
                          </div>
                        ) : (
                           selectedEventId === evt.id && (
                            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/50">
                              {/* Event Description */}
                              {(evt.testo_estratto || evt.descrizione) && (
                                <p className="text-xs text-foreground/80 leading-relaxed font-sans">
                                  {evt.testo_estratto || evt.descrizione}
                                </p>
                              )}

                              {/* Box Artista / Bio (AI arricchita) */}
                              {evt.dettagli_extra?.bio_artista && (
                                <div className="bg-muted/70 p-3 rounded-lg border border-border/50 mt-1">
                                  <h4 className="font-semibold text-xs text-primary mb-1 flex items-center gap-1">
                                    <span>👤</span> L'Artista / Protagonista
                                  </h4>
                                  <p className="text-[11px] text-muted-foreground leading-normal font-sans italic">
                                    {evt.dettagli_extra.bio_artista}
                                  </p>
                                </div>
                              )}

                              {/* Altri dettagli extra */}
                              {((evt.dettagli_extra?.genere_musicale) || (evt.dettagli_extra?.artisti_principali)) && (
                                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 bg-muted/30 p-2 rounded border border-border/30">
                                  {evt.dettagli_extra.genere_musicale && (
                                    <span><strong>Genere:</strong> {evt.dettagli_extra.genere_musicale}</span>
                                  )}
                                  {evt.dettagli_extra.artisti_principali && (
                                    <span><strong>Artisti:</strong> {evt.dettagli_extra.artisti_principali}</span>
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-3 pt-1">
                                {evt.link_organizzatore && (
                                  <a
                                    href={evt.link_organizzatore}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-amber-600 hover:underline text-xs font-semibold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                    Sito Organizzatore
                                  </a>
                                )}
                                {evt.dettagli_extra?.pdf_path && (
                                  <a
                                    href={`/api/event-pdfs/${String(evt.dettagli_extra.pdf_path).split('/').pop()}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-red-600 hover:underline text-xs font-semibold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    PDF
                                  </a>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const slug = evt.titolo
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]+/g, "-")
                                      .replace(/(^-|-$)/g, "");
                                    const url = `${window.location.origin}/eventi/${evt.id}-${slug}`;
                                    if (navigator.share) {
                                      navigator.share({
                                        title: evt.titolo,
                                        text: evt.descrizione || "",
                                        url: url
                                      }).catch(() => {});
                                    } else {
                                      navigator.clipboard.writeText(url);
                                      alert("Link copiato negli appunti!");
                                    }
                                  }}
                                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs bg-transparent border-none cursor-pointer"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  Condividi
                                </button>
                              </div>
                            </div>
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
