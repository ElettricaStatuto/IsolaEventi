import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Event } from "@workspace/api-client-react/src/generated/api.schemas";
import { useEffect, useRef } from "react";

// Fix Leaflet default icon with CDN URLs (avoids Vite bundler issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapViewProps {
  events: Event[];
  selectedEventId: number | null;
}

export function MapView({ events, selectedEventId }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [40.12, 9.07],
      zoom: 8,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Update markers when events change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    // Add new markers
    events.forEach((evt) => {
      if (evt.latitudine == null || evt.longitudine == null) return;

      const marker = L.marker([evt.latitudine, evt.longitudine]);

      const popupContent = `
        <div style="min-width:180px;font-family:sans-serif;">
          <strong style="font-size:14px;line-height:1.3;display:block;margin-bottom:6px;">${evt.titolo}</strong>
          ${evt.data_inizio ? `<div style="font-size:12px;color:#666;margin-bottom:3px;">${evt.data_inizio}${evt.data_fine && evt.data_fine !== evt.data_inizio ? " - " + evt.data_fine : ""}</div>` : ""}
          ${evt.luogo ? `<div style="font-size:12px;font-weight:600;margin-bottom:6px;">${evt.luogo}</div>` : ""}
          ${evt.link ? `<a href="${evt.link}" target="_blank" rel="noreferrer" style="font-size:12px;color:#c0661b;text-decoration:underline;">Vedi fonte</a>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(map);
      markersRef.current.set(evt.id, marker);
    });
  }, [events]);

  // Pan to selected event
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !selectedEventId) return;

    const marker = markersRef.current.get(selectedEventId);
    if (marker) {
      map.flyTo(marker.getLatLng(), 12, { duration: 1 });
      marker.openPopup();
    }
  }, [selectedEventId]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", minHeight: 400 }}
    />
  );
}
