import React, { useState } from "react";
import { MapPin, Calendar, ExternalLink, Filter } from "lucide-react";

const EVENTS = [
  { id: 1, titolo: "Sagra del Pecorino di Pattada", luogo: "Pattada", data_inizio: "2026-07-05", data_fine: "2026-07-07", link: "#", lat: 40.5686, lon: 9.1352 },
  { id: 2, titolo: "S'Ardia di Sedilo", luogo: "Sedilo", data_inizio: "2026-07-06", data_fine: "2026-07-07", link: "#", lat: 40.1726, lon: 8.9285 },
  { id: 3, titolo: "Festival Internazionale del Jazz di Nuoro", luogo: "Nuoro", data_inizio: "2026-07-12", data_fine: "2026-07-19", link: "#", lat: 40.3215, lon: 9.3268 },
  { id: 4, titolo: "Festimannu di Alghero", luogo: "Alghero", data_inizio: "2026-07-15", data_fine: "2026-07-20", link: "#", lat: 40.5587, lon: 8.3197 },
  { id: 5, titolo: "Notte dei Poeti di Nora", luogo: "Pula", data_inizio: "2026-07-18", data_fine: "2026-07-20", link: "#", lat: 38.9948, lon: 8.9996 },
  { id: 6, titolo: "Cavalcata Sarda di Sassari", luogo: "Sassari", data_inizio: "2026-07-25", data_fine: "2026-07-25", link: "#", lat: 40.7269, lon: 8.5574 },
  { id: 7, titolo: "Estate Musicale Internazionale di Cagliari", luogo: "Cagliari", data_inizio: "2026-08-01", data_fine: "2026-08-31", link: "#", lat: 39.2238, lon: 9.1217 },
  { id: 8, titolo: "Corsa degli Scalzi di Cabras", luogo: "Cabras", data_inizio: "2026-09-06", data_fine: "2026-09-06", link: "#", lat: 39.9247, lon: 8.5321 },
  { id: 9, titolo: "Processione di Nostra Signora di Gonare", luogo: "Orani", data_inizio: "2026-08-09", data_fine: "2026-08-09", link: "#", lat: 40.2393, lon: 9.1772 },
];

export function MapImmersive() {
  const [filter, setFilter] = useState("Tutto");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Quick helper to format dates
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("it-IT", { day: 'numeric', month: 'short' });
  };

  const filteredEvents = EVENTS.filter((e) => {
    if (filter === "Tutto") return true;
    if (filter === "Questo weekend") return e.id % 2 === 0; // mockup logic
    if (filter === "Prossima settimana") return e.id % 2 !== 0; // mockup logic
    return true;
  });

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans">
      {/* Map Background (Simulated) */}
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at center, #F5EAE1 0%, #E3D3C2 100%)",
          backgroundImage: "radial-gradient(#C15C2E 0.5px, transparent 0.5px), radial-gradient(#C15C2E 0.5px, #F5EAE1 0.5px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
          opacity: 0.8
        }}
      >
        {/* Simulated map points */}
        {EVENTS.map((event) => {
          // Normalize lat/lon to percentage (very rough approximation for visual effect)
          const latPercent = ((41.5 - event.lat) / (41.5 - 38.8)) * 100;
          const lonPercent = ((event.lon - 8.1) / (9.8 - 8.1)) * 100;
          
          const isSelected = selectedEventId === event.id;

          return (
            <div
              key={event.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{
                top: `${latPercent}%`,
                left: `${lonPercent}%`,
              }}
              onClick={() => setSelectedEventId(event.id)}
            >
              <div 
                className={`flex items-center justify-center rounded-full shadow-lg transition-all ${isSelected ? 'w-6 h-6 z-20' : 'w-4 h-4 z-10 hover:scale-125'}`}
                style={{ 
                  backgroundColor: isSelected ? "#C15C2E" : "#1B3A5C",
                  border: "2px solid white"
                }}
              >
                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Overlay Panel */}
      <div 
        className="absolute left-4 top-4 bottom-4 w-[22rem] rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
        style={{
          backgroundColor: "rgba(250, 248, 246, 0.85)", // stone-50/85 approx
          color: "#1B3A5C"
        }}
      >
        {/* Header & Filters */}
        <div className="p-6 pb-4 border-b border-gray-200/50">
          <h1 className="text-2xl font-bold mb-4 tracking-tight" style={{ color: "#1B3A5C" }}>
            Sardegna Eventi
          </h1>
          
          <div className="flex items-center gap-2 mb-2">
            <Filter size={16} style={{ color: "#C15C2E" }} />
            <span className="text-sm font-medium uppercase tracking-wider text-gray-500">Filtra per data</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {["Tutto", "Questo weekend", "Prossima settimana"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
                style={{
                  backgroundColor: filter === f ? "#1B3A5C" : "rgba(27, 58, 92, 0.08)",
                  color: filter === f ? "white" : "#1B3A5C"
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Event List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredEvents.map((event) => (
            <div 
              key={event.id}
              className="p-4 rounded-xl transition-all cursor-pointer bg-white/60 hover:bg-white shadow-sm border border-transparent hover:border-orange-100"
              style={{
                borderColor: selectedEventId === event.id ? "#C15C2E" : undefined,
                boxShadow: selectedEventId === event.id ? "0 4px 12px rgba(193, 92, 46, 0.15)" : undefined,
                backgroundColor: selectedEventId === event.id ? "white" : undefined,
              }}
              onClick={() => setSelectedEventId(event.id)}
            >
              <h3 className="font-bold text-base leading-tight mb-2" style={{ color: "#1B3A5C" }}>
                {event.titolo}
              </h3>
              
              <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar size={14} style={{ color: "#C15C2E" }} />
                  <span>
                    {formatDate(event.data_inizio)} 
                    {event.data_fine !== event.data_inizio && ` - ${formatDate(event.data_fine)}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: "#C15C2E" }} />
                  <span>{event.luogo}</span>
                </div>
              </div>

              {selectedEventId === event.id && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                  <a 
                    href={event.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide hover:opacity-80 transition-opacity"
                    style={{ color: "#C15C2E" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Dettagli
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
          
          {filteredEvents.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Nessun evento trovato per questo filtro.
            </div>
          )}
        </div>
      </div>
      
      {/* Hide scrollbar styles inline */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(27, 58, 92, 0.1);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
