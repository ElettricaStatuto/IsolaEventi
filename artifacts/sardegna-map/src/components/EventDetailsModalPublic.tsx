import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, Globe, Calendar, MapPin, Clock } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface EventDetailsModalPublicProps {
  event: any;
  onClose: () => void;
  allEvents: any[];
  onSelectEvent: (id: number) => void;
  imageUrl: (ev: any) => string | null;
}

export const EventDetailsModalPublic: React.FC<EventDetailsModalPublicProps> = ({
  event,
  onClose,
  allEvents,
  onSelectEvent,
  imageUrl,
}) => {
  if (!event) return null;

  const [subEvents, setSubEvents] = React.useState<any[]>([]);
  const [isLoadingSubEvents, setIsLoadingSubEvents] = React.useState(false);
  const miniMapRef = React.useRef<HTMLDivElement>(null);
  const leafletMiniMap = React.useRef<any>(null);

  React.useEffect(() => {
    if (!miniMapRef.current || event.latitudine == null || event.longitudine == null) return;

    if (leafletMiniMap.current) {
      leafletMiniMap.current.remove();
      leafletMiniMap.current = null;
    }

    try {
      const map = L.map(miniMapRef.current, {
        center: [event.latitudine, event.longitudine],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      L.marker([event.latitudine, event.longitudine]).addTo(map);

      leafletMiniMap.current = map;
    } catch (err) {
      console.error("Error creating mini map:", err);
    }

    return () => {
      if (leafletMiniMap.current) {
        leafletMiniMap.current.remove();
        leafletMiniMap.current = null;
      }
    };
  }, [event.id, event.latitudine, event.longitudine]);

  React.useEffect(() => {
    if (!event.id) return;
    setIsLoadingSubEvents(true);
    fetch(`/api/events/${event.id}/children`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSubEvents(data);
        }
      })
      .catch((err) => console.error("Error fetching sub-events:", err))
      .finally(() => setIsLoadingSubEvents(false));
  }, [event.id]);

  // Trova eventuale festival padre
  const parentEvent = event.parent_id ? allEvents.find((e) => e.id === event.parent_id) : null;

  const img = imageUrl(event);

  // Esclude anche la bio artisti/artista se questo evento è un festival (isFestival = true).
  const isFestival = Boolean(
    event.is_festival ||
    event.dettagli_extra?.is_festival ||
    subEvents.length > 0 ||
    event.titolo?.toLowerCase().includes("festival") ||
    event.titolo?.toLowerCase().includes("sagra")
  );
  const extraDetails = event.dettagli_extra
    ? Object.entries(event.dettagli_extra).filter(
        ([key, value]) =>
          key !== "diario_di_bordo_ai" &&
          key !== "metadati_operazioni" &&
          key !== "_usage" &&
          key !== "id_key" &&
          key !== "parent_temp_id" &&
          key !== "festival_padre" &&
          key !== "telegram_chat_id" &&
          key !== "metodo_estrazione" &&
          key !== "motivo_immagine_non_pulita" &&
          key !== "telegram_user" &&
          key !== "ricevuto_il" &&
          key !== "immagine_pulita_e_pubblicabile" &&
          key !== "ora_inizio" &&
          key !== "ora_fine" &&
          (!isFestival || (key !== "bio_artisti" && key !== "bio_artista" && key !== "bio_artista_o_opera")) &&
          value !== null &&
          value !== ""
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative bg-card border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="w-full mr-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                {event.categoria && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {event.categoria}
                  </Badge>
                )}
                {isFestival ? (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black border border-amber-600">
                    ⭐ FESTIVAL
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-xl font-serif font-bold text-foreground leading-tight mt-1">
                {event.titolo}
              </CardTitle>
              {parentEvent && (
                <button
                  onClick={() => onSelectEvent(parentEvent.id)}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 uppercase tracking-wide text-left hover:underline bg-transparent border-none p-0 cursor-pointer mt-1"
                >
                  ★ Fa parte del festival: {parentEvent.titolo} (Apri Festival →)
                </button>
              )}
            </div>
            <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0 shrink-0 hover:bg-muted rounded-full">
              <XCircle className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Foto + Info Generali */}
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Foto e Tags */}
            <div className="flex flex-col gap-3 shrink-0 w-full sm:w-64">
              {img ? (
                <img
                  src={img}
                  alt={event.titolo}
                  className="w-full aspect-[4/3] object-cover rounded-md border border-border shadow-sm"
                />
              ) : (
                <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center rounded-md border border-border text-muted-foreground text-xs shrink-0">
                  Nessuna Immagine
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Tag</span>
                  <div className="flex flex-wrap gap-1">
                    {event.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-sky-100/60 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 border-none text-[10px] px-2 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Descrizione (AI summary o fallback) */}
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Descrizione
                </h4>
                <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap font-sans">
                  {event.testo_estratto || event.descrizione || "Nessuna descrizione disponibile."}
                </p>
              </div>

              {event.link_organizzatore && (
                <div className="mt-2">
                  <a
                    href={event.link_organizzatore}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
                  >
                    <Globe className="w-3.5 h-3.5" /> Sito Organizzatore
                  </a>
                </div>
              )}
            </div>
          {/* Data, Orario, Luogo & Mappa */}
          {event.latitudine != null && event.longitudine != null ? (
            <div className="flex flex-col sm:flex-row gap-4 border-t border-border pt-4">
              {/* Left Column: Mini Map */}
              <div className="flex flex-col gap-2 shrink-0">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Posizione sulla Mappa
                </h4>
                <div 
                  ref={miniMapRef} 
                  className="w-full aspect-square sm:w-[240px] sm:h-[240px] h-[200px] rounded-lg border border-border shadow-sm overflow-hidden z-10"
                />
              </div>

              {/* Right Column: Dove & Quando Stacked */}
              <div className="flex-1 flex flex-col gap-3 justify-between">
                {/* Luogo */}
                <div className="p-4 rounded-lg border border-border bg-card flex-1 flex flex-col justify-center">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Dove
                  </h4>
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-semibold">{event.luogo || "Non specificato"}</span>
                  </div>
                </div>

                {/* Date e Orari */}
                <div className="p-4 rounded-lg border border-border bg-card flex-1 flex flex-col justify-center">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Quando
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Calendar className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold">
                        {event.data_inizio ? new Date(event.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                        {event.data_fine && event.data_fine !== event.data_inizio
                          ? ` - ${new Date(event.data_fine).toLocaleDateString("it-IT")}`
                          : ""}
                      </span>
                    </div>
                    {event.dettagli_extra?.ora_inizio && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          Inizio ore <strong className="text-foreground">{event.dettagli_extra.ora_inizio}</strong>
                          {event.dettagli_extra.ora_fine && (
                            <> fino alle <strong className="text-foreground">{event.dettagli_extra.ora_fine}</strong></>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback when no coordinates: classic 2-column grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              {/* Luogo */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Dove
                </h4>
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-semibold">{event.luogo || "Non specificato"}</span>
                </div>
              </div>

              {/* Date e Orari */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Quando
                </h4>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold">
                      {event.data_inizio ? new Date(event.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                      {event.data_fine && event.data_fine !== event.data_inizio
                        ? ` - ${new Date(event.data_fine).toLocaleDateString("it-IT")}`
                        : ""}
                    </span>
                  </div>
                  {event.dettagli_extra?.ora_inizio && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        Inizio ore <strong className="text-foreground">{event.dettagli_extra.ora_inizio}</strong>
                        {event.dettagli_extra.ora_fine && (
                          <> fino alle <strong className="text-foreground">{event.dettagli_extra.ora_fine}</strong></>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sotto-eventi (Programma del Festival) */}
          {isLoadingSubEvents && (
            <div className="border-t border-border pt-4 text-center py-4 text-muted-foreground text-xs">
              Caricamento programma del festival...
            </div>
          )}

          {subEvents.length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Programma del Festival ({subEvents.length} eventi)
              </h4>
              <div className="flex flex-col gap-2 pr-1">
                {subEvents.map((se) => (
                  <div
                    key={se.id}
                    onClick={() => onSelectEvent(se.id)}
                    className="p-3 bg-muted/40 hover:bg-muted/80 rounded-lg border border-border/40 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">{se.titolo}</span>
                      <span className="text-xs text-muted-foreground truncate">{se.luogo}</span>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs font-mono font-medium text-primary">
                        {se.data_inizio ? new Date(se.data_inizio).toLocaleDateString("it-IT") : ""}
                      </span>
                      {se.dettagli_extra?.ora_inizio && (
                        <span className="text-[10px] text-muted-foreground">
                          Ore {se.dettagli_extra.ora_inizio}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
