import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Event } from "@workspace/api-client-react";

// Marker disegnato ad hoc nell'accento terracotta del sito, al posto del
// pin blu di default di Leaflet — pensato per spiccare sullo sfondo scuro
// della mappa. Il riquadro è 44x44px (soglia minima consigliata per un
// bersaglio tap comodo su mobile) anche se il segno visibile è più piccolo.
const PIN_COLOR = "#C2694A";
const PIN_STROKE = "#1F4A48";

function buildPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "sm-map-pin",
    html: `
      <div style="width:44px;height:44px;display:flex;align-items:flex-end;justify-content:center;">
        <svg width="30" height="30" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
          <path d="M12 2C7.58 2 4 5.58 4 10c0 6.5 8 12 8 12s8-5.5 8-12c0-4.42-3.58-8-8-8z" fill="${PIN_COLOR}" stroke="${PIN_STROKE}" stroke-width="1"/>
          <circle cx="12" cy="10" r="3.4" fill="#FAF8F5"/>
        </svg>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 41],
    popupAnchor: [0, -36],
  });
}

interface MapContainerProps {
  events: Event[];
  selectedEventId: number | null;
  onSelectEvent: (id: number) => void;
}

const SARDINIA_CENTER: [number, number] = [40.12, 9.07];
const DEFAULT_ZOOM = 7;

// Constraint: map cannot pan/zoom outside Sardinia bounding box
// Extent with small buffer: lat 38.5°N–41.5°N, lon 7.8°E–10.2°E
const SARDINIA_BOUNDS: L.LatLngBoundsLiteral = [
  [38.5, 7.8],  // SW corner
  [41.5, 10.2], // NE corner
];

export function MapContainer({
  events,
  selectedEventId,
  onSelectEvent,
}: MapContainerProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapDivRef.current || leafletMap.current) return;

    const map = L.map(mapDivRef.current, {
      center: SARDINIA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      maxBounds: SARDINIA_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 7,
      maxZoom: 20,
    });

    // Base scura e desaturata (CARTO Dark Matter) al posto del classico
    // stile stradale colorato: si intona alla sezione mappa teal del sito
    // invece di sembrare un widget di Google Maps incollato sopra.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributations">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Zoom control in bottom-right to avoid overlap with fullscreen button
    L.control.zoom({ position: "bottomright" }).addTo(map);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Invalidate map size when container dimensions may have changed
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  // Re-run whenever events list length changes (sidebar may collapse/expand)
  }, [events.length]);

  // Rebuild markers whenever events change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    events.forEach((evt) => {
      if (evt.latitudine == null || evt.longitudine == null) return;

      const marker = L.marker([evt.latitudine, evt.longitudine], { icon: buildPinIcon() });

      const dateStr = evt.data_inizio
        ? `${evt.data_inizio}${evt.data_fine && evt.data_fine !== evt.data_inizio ? " – " + evt.data_fine : ""}`
        : "";

      const parentLink = evt.parent_id ? `<a href="/festival/${evt.parent_id}" style="font-size:11px;color:#5c6d54;text-decoration:underline;display:block;margin-top:4px;">↑ Vedi Festival Padre</a>` : '';
      const festivalLink = (evt as any).children_count > 0 ? `<a href="/festival/${evt.id}" style="font-size:11px;color:white;font-weight:bold;display:block;margin-top:6px;background:${PIN_COLOR};padding:6px 10px;border-radius:8px;text-align:center;text-decoration:none;box-shadow: 0 1px 3px rgba(0,0,0,0.15);">🏆 Vedi Programma Festival</a>` : '';

      marker.bindPopup(`
        <div style="min-width:190px;font-family:sans-serif;">
          <strong style="font-size:13px;line-height:1.35;display:block;margin-bottom:5px;">${evt.titolo}</strong>
          ${dateStr ? `<div style="font-size:11px;color:#847c6f;margin-bottom:3px;">${dateStr}</div>` : ""}
          ${evt.luogo ? `<div style="font-size:11px;font-weight:600;margin-bottom:5px;">${evt.luogo}</div>` : ""}
          ${(evt as any).link_organizzatore ? `<a href="${(evt as any).link_organizzatore}" target="_blank" rel="noreferrer" style="font-size:11px;color:${PIN_COLOR};font-weight:bold;text-decoration:underline;display:block;margin-top:4px;">Sito Organizzatore →</a>` : ""}
          ${parentLink}
          ${festivalLink}
        </div>
      `);

      // Marker click → select event → EventList scrolls to it
      marker.on("click", () => {
        onSelectEvent(evt.id);
      });

      marker.addTo(map);
      markersRef.current.set(evt.id, marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Sync map to selected event: fly to marker and open popup
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || selectedEventId === null) return;

    const marker = markersRef.current.get(selectedEventId);
    if (marker) {
      map.flyTo(marker.getLatLng(), 12, { duration: 0.8 });
      marker.openPopup();
    }
  }, [selectedEventId]);

  return (
    <div className="relative w-full h-full">
      {/* Leaflet map div — fills the parent container */}
      <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />

    </div>
  );
}
