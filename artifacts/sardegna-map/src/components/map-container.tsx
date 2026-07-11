import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Event } from "@workspace/api-client-react";

// Fix Leaflet default icon with CDN URLs (avoids Vite bundler issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">Leaflet</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
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

      const marker = L.marker([evt.latitudine, evt.longitudine]);

      const dateStr = evt.data_inizio
        ? `${evt.data_inizio}${evt.data_fine && evt.data_fine !== evt.data_inizio ? " – " + evt.data_fine : ""}`
        : "";

      marker.bindPopup(`
        <div style="min-width:190px;font-family:sans-serif;">
          <strong style="font-size:13px;line-height:1.35;display:block;margin-bottom:5px;">${evt.titolo}</strong>
          ${dateStr ? `<div style="font-size:11px;color:#666;margin-bottom:3px;">${dateStr}</div>` : ""}
          ${evt.luogo ? `<div style="font-size:11px;font-weight:600;margin-bottom:5px;">${evt.luogo}</div>` : ""}
          ${evt.link ? `<a href="${evt.link}" target="_blank" rel="noreferrer" style="font-size:11px;color:#c0661b;text-decoration:underline;">Vedi fonte →</a>` : ""}
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
