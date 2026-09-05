import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, Globe, Calendar, MapPin, Clock, FileText, Facebook, Instagram, Navigation, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAssetUrl, googleMapsUrl, findSocialLink, formatDurata } from "../lib/utils";
import { useWeather } from "../hooks/use-weather";
import { useTravelTime } from "../hooks/use-travel-time";
import { PoiSection } from "./poi-section";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default icon using local bundled assets (avoids Vite bundler issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface EventDetailsModalPublicProps {
  event: any;
  onClose: () => void;
  allEvents: any[];
  onSelectEvent: (id: number) => void;
  imageUrl: (ev: any) => string | null;
  /** Cliccando un tag si chiude la scheda e si apre il calendario filtrato
   * su quel tag, con tutti gli eventi futuri che lo hanno. */
  onTagClick?: (tag: string) => void;
}

export const EventDetailsModalPublic: React.FC<EventDetailsModalPublicProps> = ({
  event,
  onClose,
  allEvents,
  onSelectEvent,
  imageUrl,
  onTagClick,
}) => {
  if (!event) return null;

  const [subEvents, setSubEvents] = React.useState<any[]>([]);
  const [isLoadingSubEvents, setIsLoadingSubEvents] = React.useState(false);
  const miniMapRef = React.useRef<HTMLDivElement>(null);
  const leafletMiniMap = React.useRef<any>(null);
  const weather = useWeather(event.latitudine, event.longitudine, event.data_inizio);
  const travelTime = useTravelTime(event.latitudine, event.longitudine);

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
                {event.is_ingresso_gratuito && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-bold border border-emerald-600">
                    Gratuito
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl font-serif font-bold text-foreground leading-tight mt-1 break-words">
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

              {/* Locandina PDF (Flyer) Button */}
              {event.dettagli_extra?.pdf_path && (
                <a
                  href={getAssetUrl(`/api/event-pdfs/${String(event.dettagli_extra.pdf_path).split('/').pop()}`) || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01] text-xs uppercase tracking-wider"
                >
                  <FileText className="w-4 h-4" />
                  Visualizza Locandina PDF
                </a>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Tag</span>
                  <div className="flex flex-wrap gap-1">
                    {event.tags.map((tag: string, i: number) =>
                      onTagClick ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onTagClick(tag)}
                          title={`Vedi tutti gli eventi con il tag "${tag}"`}
                        >
                          <Badge
                            variant="secondary"
                            className="bg-sky-100/60 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 border-none text-[10px] px-2 py-0.5 cursor-pointer hover:bg-sky-200/70 dark:hover:bg-sky-800/40 transition-colors"
                          >
                            {tag}
                          </Badge>
                        </button>
                      ) : (
                        <Badge key={i} variant="secondary" className="bg-sky-100/60 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 border-none text-[10px] px-2 py-0.5">
                          {tag}
                        </Badge>
                      )
                    )}
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

              {(event.link_organizzatore || event.social_contatti?.length > 0) && (
                <div className="mt-2 flex items-center gap-2">
                  {event.link_organizzatore && (
                    <a
                      href={event.link_organizzatore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
                    >
                      <Globe className="w-3.5 h-3.5" /> Sito Organizzatore
                    </a>
                  )}
                  {(() => {
                    const fb = findSocialLink(event.social_contatti, "facebook");
                    const ig = findSocialLink(event.social_contatti, "instagram");
                    return (
                      <>
                        {fb && (
                          <a
                            href={fb}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Pagina Facebook"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#1877F2] hover:brightness-110 text-white shadow-sm transition-all hover:scale-105"
                          >
                            <Facebook className="w-4 h-4" fill="currentColor" />
                          </a>
                        )}
                        {ig && (
                          <a
                            href={ig}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Profilo Instagram"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 hover:brightness-110 text-white shadow-sm transition-all hover:scale-105"
                          >
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
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

              {/* Right Column: Quando & Dove Stacked */}
              <div className="flex-1 flex flex-col gap-3 justify-between">
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
                    {weather && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6" title={weather.descrizione}>
                        <span className="text-base leading-none">{weather.icon}</span>
                        <span>
                          {weather.descrizione} · <strong className="text-foreground">{Math.round(weather.tempMax)}°</strong> / {Math.round(weather.tempMin)}°
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Luogo */}
                <div className="p-4 rounded-lg border border-border bg-card flex-1 flex flex-col justify-center">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Dove
                  </h4>
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-semibold">{event.luogo || "Non specificato"}</span>
                  </div>
                  {(() => {
                    const mapsUrl = googleMapsUrl(event.latitudine, event.longitudine);
                    return mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline w-fit"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Apri in Google Maps
                      </a>
                    ) : null;
                  })()}

                  {/* Tempo di percorrenza dalla posizione dell'utente - solo su richiesta esplicita */}
                  {event.latitudine != null && event.longitudine != null && (
                    <div className="mt-2">
                      {travelTime.state === "idle" && (
                        <button
                          type="button"
                          onClick={travelTime.calcola}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline w-fit cursor-pointer bg-transparent border-none p-0"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Quanto ci metto ad arrivare?
                        </button>
                      )}
                      {(travelTime.state === "richiedendo_posizione" || travelTime.state === "calcolando") && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {travelTime.state === "richiedendo_posizione" ? "Rilevo la tua posizione…" : "Calcolo il percorso…"}
                        </span>
                      )}
                      {travelTime.state === "pronto" && travelTime.result && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Navigation className="w-3.5 h-3.5 text-primary" />
                          ~{formatDurata(travelTime.result.durataMinuti)} in auto ({travelTime.result.distanzaKm} km)
                        </span>
                      )}
                      {travelTime.state === "errore" && (
                        <span className="text-xs text-muted-foreground">{travelTime.errorMessage}</span>
                      )}
                    </div>
                  )}
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

          <PoiSection
            titolo="Da vedere nei dintorni"
            latitudine={event.latitudine}
            longitudine={event.longitudine}
          />

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
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {se.data_inizio ? new Date(se.data_inizio).toLocaleDateString("it-IT", { day: 'numeric', month: 'long', year: 'numeric' }) : ""}
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
