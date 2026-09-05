import { usePuntiInteresseVicini } from "../hooks/use-punti-interesse";

const ICONA_CATEGORIA: Record<string, string> = {
  Nuraghe: "🗿",
  "Domus de Janas": "🪦",
  "Sito archeologico": "🏺",
  "Chiesa storica": "⛪",
  Grotta: "🕳️",
  "Torre costiera": "🏰",
  "Punto panoramico": "🔭",
  Museo: "🏛️",
  Faro: "🗼",
  Cantina: "🍷",
  "Area naturale": "🏞️",
};

interface PoiSectionProps {
  titolo: string;
  latitudine: number | null | undefined;
  longitudine: number | null | undefined;
  raggioKm?: number;
}

/** Sezione "Scopri [comune]" o "Lungo la strada": una riga scorrevole di
 * punti di interesse vicino a un luogo, nello stesso linguaggio visivo
 * delle card di "Vicino a te" nella home. Se non ci sono punti, non
 * renderizza nulla - niente stato vuoto a riempire spazio. */
export function PoiSection({ titolo, latitudine, longitudine, raggioKm = 15 }: PoiSectionProps) {
  const { punti, isLoading } = usePuntiInteresseVicini(latitudine, longitudine, raggioKm);

  if (isLoading || punti.length === 0) return null;

  return (
    <div className="border-t border-border pt-4">
      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
        {titolo}
      </h4>
      {/* touch-pan-x: sulla mappa/scheda che scorre in verticale, dice al
          browser di gestire lo swipe orizzontale qui invece di farlo
          diventare uno scroll verticale della scheda intera. */}
      <div className="flex gap-2.5 overflow-x-auto overflow-y-hidden touch-pan-x pb-1 -mx-1 px-1">
        {punti.map((p) => (
          <a
            key={p.id}
            href={p.link_esterno || `https://www.google.com/maps/search/?api=1&query=${p.latitudine},${p.longitudine}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[150px] text-left rounded-lg border border-border bg-background hover:border-primary/50 hover:shadow-sm transition-all overflow-hidden flex flex-col"
          >
            <div className="relative w-full h-16 bg-muted flex items-center justify-center text-2xl flex-shrink-0">
              {ICONA_CATEGORIA[p.categoria] || "📍"}
              {p.is_partner && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-primary-foreground bg-primary rounded-full px-1.5 py-0.5 shadow-sm">
                  Consigliato
                </span>
              )}
            </div>
            <div className="p-2 flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-foreground leading-snug">
                {p.nome}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {p.comune ? `${p.comune} · ` : ""}
                {p.distanza_km < 1 ? "< 1 km" : `~${Math.round(p.distanza_km)} km`}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
