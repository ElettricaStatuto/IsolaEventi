import React, { useState } from 'react';
import { MapPin, Calendar, ExternalLink, Map as MapIcon, ChevronRight } from 'lucide-react';

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

type FilterType = 'tutto' | 'weekend' | 'settimana';

export function StackedDashboard() {
  const [filter, setFilter] = useState<FilterType>('tutto');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Mock filtering logic for visual effect
  const filteredEvents = EVENTS.filter(event => {
    if (filter === 'tutto') return true;
    if (filter === 'weekend') return [1, 2, 4].includes(event.id);
    if (filter === 'settimana') return [3, 5, 6].includes(event.id);
    return true;
  });

  const formatDate = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return start === end ? s : `${s} - ${e}`;
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] overflow-hidden bg-stone-50 font-sans text-stone-900">
      {/* TOP BAR */}
      <header 
        className="h-14 w-full flex items-center justify-between px-4 shrink-0 shadow-sm z-10"
        style={{ backgroundColor: '#1B3A5C' }}
      >
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-white" />
          <h1 className="text-white font-semibold text-lg tracking-tight">Sardegna Eventi</h1>
        </div>

        <div className="flex items-center bg-black/20 p-1 rounded-md">
          <button
            onClick={() => setFilter('tutto')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              filter === 'tutto' ? 'bg-[#C15C2E] text-white shadow' : 'text-stone-300 hover:text-white'
            }`}
          >
            Tutti
          </button>
          <button
            onClick={() => setFilter('weekend')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              filter === 'weekend' ? 'bg-[#C15C2E] text-white shadow' : 'text-stone-300 hover:text-white'
            }`}
          >
            Questo Weekend
          </button>
          <button
            onClick={() => setFilter('settimana')}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              filter === 'settimana' ? 'bg-[#C15C2E] text-white shadow' : 'text-stone-300 hover:text-white'
            }`}
          >
            Prossima Settimana
          </button>
        </div>

        <div className="bg-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {filteredEvents.length} eventi
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-row min-h-0 w-full">
        {/* LEFT: MAP (55%) */}
        <div className="w-[55%] relative bg-stone-200 border-r border-stone-300 shadow-[inset_-4px_0_12px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Fake Map Background */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ 
              backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-30 text-stone-500 font-medium">
            <div className="flex flex-col items-center gap-2">
              <MapIcon className="w-12 h-12" />
              <span>Map Visualization Area</span>
            </div>
          </div>

          {/* Fake Map Markers */}
          {filteredEvents.map(event => {
            const isSelected = selectedEventId === event.id;
            // Extremely rough mapping of lat/lon to percentage for visual mockup purposes
            // Lat ranges roughly 38.9 to 41.2 in Sardinia. Lon roughly 8.1 to 9.8.
            const topPct = 100 - ((event.lat - 38.8) / (41.3 - 38.8)) * 100;
            const leftPct = ((event.lon - 8.0) / (9.9 - 8.0)) * 100;

            return (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={`absolute w-4 h-4 rounded-full -ml-2 -mt-2 border-2 transition-all duration-200 z-10 ${
                  isSelected 
                    ? 'bg-[#C15C2E] border-white scale-150 shadow-lg' 
                    : 'bg-[#1B3A5C] border-white hover:scale-125 shadow-md'
                }`}
                style={{ top: `${topPct}%`, left: `${leftPct}%` }}
                title={event.titolo}
              />
            )
          })}
        </div>

        {/* RIGHT: COMPACT EVENT LIST (45%) */}
        <div className="w-[45%] bg-stone-50 flex flex-col">
          <div className="px-4 py-3 border-b border-stone-200 bg-white flex justify-between items-center shrink-0">
            <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Eventi in programma</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">
                Nessun evento trovato per questi filtri.
              </div>
            ) : (
              filteredEvents.map(event => {
                const isSelected = selectedEventId === event.id;
                
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`group p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-[#C15C2E] bg-orange-50/50 shadow-sm' 
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-semibold text-[15px] leading-tight truncate mb-1.5 ${
                          isSelected ? 'text-[#C15C2E]' : 'text-stone-900 group-hover:text-[#1B3A5C]'
                        }`}>
                          {event.titolo}
                        </h3>
                        
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center text-xs text-stone-600 gap-1.5">
                            <Calendar className="w-3.5 h-3.5 opacity-70 shrink-0" />
                            <span className="truncate">{formatDate(event.data_inizio, event.data_fine)}</span>
                          </div>
                          <div className="flex items-center text-xs text-stone-600 gap-1.5">
                            <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                            <span className="truncate">{event.luogo}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#C15C2E]/10 text-[#C15C2E]' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'
                      }`}>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
