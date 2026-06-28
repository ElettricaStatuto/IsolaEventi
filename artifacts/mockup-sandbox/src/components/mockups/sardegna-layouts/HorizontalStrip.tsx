import React, { useState } from 'react';
import { MapPin, Calendar, ChevronRight, ListFilter } from 'lucide-react';

// Data
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

type FilterType = "Tutto" | "Questo weekend" | "Prossima settimana";

export function HorizontalStrip() {
  const [filter, setFilter] = useState<FilterType>("Tutto");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Formatting date logic (simplified for mockup)
  const formatDate = (start: string, end: string) => {
    if (start === end) return start;
    return `${start} - ${end}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full font-sans overflow-hidden" style={{ backgroundColor: '#F9FAFB', color: '#1B3A5C' }}>
      {/* TOP SECTION: MAP */}
      <div 
        className="w-full relative flex items-center justify-center transition-all duration-500 ease-in-out" 
        style={{ height: '60vh', background: 'linear-gradient(to bottom right, #f5f5f4, #fef3c7)' }}
      >
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#1B3A5C 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        
        <div className="flex flex-col items-center justify-center gap-3 relative z-10 p-6 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/60 shadow-lg">
          <MapPin size={48} style={{ color: '#C15C2E' }} className="animate-pulse" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1B3A5C' }}>Mappa Sardegna</h1>
          <p className="text-sm opacity-70 font-medium tracking-wide uppercase">Esplora gli eventi</p>
        </div>

        {/* Mock Map Pins */}
        {EVENTS.map(ev => {
          const isSelected = selectedEventId === ev.id;
          // Approximate relative positions based on lat/lon (for visual mockup purposes)
          // Lat range approx 38.9 to 40.8 (1.9 deg diff)
          // Lon range approx 8.3 to 9.4 (1.1 deg diff)
          const normalizedY = ((41.0 - ev.lat) / 2.2) * 100; // 0% top, 100% bottom
          const normalizedX = ((ev.lon - 8.0) / 1.6) * 100; // 0% left, 100% right
          
          return (
            <button
              key={ev.id}
              onClick={() => setSelectedEventId(ev.id)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'}`}
              style={{ top: `${normalizedY}%`, left: `${normalizedX}%` }}
            >
              <div 
                className="w-4 h-4 rounded-full shadow-md border-2 border-white"
                style={{ backgroundColor: isSelected ? '#C15C2E' : '#1B3A5C' }}
              />
            </button>
          );
        })}
      </div>

      {/* MIDDLE STRIP: FILTER BAR */}
      <div className="h-14 flex items-center justify-between px-6 bg-white shadow-sm z-20 flex-shrink-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-4">
          <ListFilter size={18} style={{ color: '#C15C2E' }} />
          <div className="flex gap-2">
            {(["Tutto", "Questo weekend", "Prossima settimana"] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: filter === f ? '#1B3A5C' : '#F3F4F6',
                  color: filter === f ? '#FFFFFF' : '#4B5563',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium opacity-70">Eventi visibili</span>
          <span 
            className="px-2.5 py-0.5 rounded-full text-xs font-bold" 
            style={{ backgroundColor: '#fef3c7', color: '#C15C2E' }}
          >
            {EVENTS.length}
          </span>
        </div>
      </div>

      {/* BOTTOM SECTION: HORIZONTAL STRIP */}
      <div className="flex-1 w-full relative overflow-hidden" style={{ height: 'calc(40vh - 56px)', backgroundColor: '#F9FAFB' }}>
        <div 
          className="h-full overflow-x-auto pb-4 pt-6 px-6 scroll-smooth flex items-stretch gap-5" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {EVENTS.map(ev => {
            const isSelected = selectedEventId === ev.id;
            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`w-72 flex-shrink-0 flex flex-col rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'shadow-md scale-[1.02]' : 'shadow-sm hover:shadow-md'}`}
                style={{ 
                  borderColor: isSelected ? '#C15C2E' : '#E5E7EB',
                  backgroundColor: isSelected ? '#fffaf8' : '#FFFFFF',
                  transformOrigin: 'bottom'
                }}
              >
                <div className="flex-1 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2" style={{ color: '#1B3A5C' }}>
                      {ev.titolo}
                    </h3>
                  </div>
                  
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                      <MapPin size={14} />
                      <span className="font-medium">{ev.luogo}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                      <Calendar size={14} />
                      <span>{formatDate(ev.data_inizio, ev.data_fine)}</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="px-5 py-3 border-t flex items-center justify-between mt-auto group"
                  style={{ borderColor: isSelected ? '#fcd34d' : '#E5E7EB', backgroundColor: isSelected ? '#C15C2E' : '#F9FAFB' }}
                >
                  <span className={`text-sm font-semibold transition-colors`} style={{ color: isSelected ? '#FFFFFF' : '#1B3A5C' }}>
                    Dettagli
                  </span>
                  <ChevronRight size={16} className={`transition-transform group-hover:translate-x-1`} style={{ color: isSelected ? '#FFFFFF' : '#C15C2E' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Ensure default export is also available if needed
export default HorizontalStrip;
