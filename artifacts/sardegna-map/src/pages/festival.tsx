import { useParams } from "wouter";
import { useGetEvent, useListEvents } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Flag, Calendar, MapPin, ArrowLeft, Clock } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function FestivalPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  // @ts-ignore
  const { data: festival, isLoading: isLoadingFestival } = useGetEvent(id, {
    query: { enabled: id > 0, queryKey: ['getEvent', id] as any }
  });

  const { data: allEvents = [], isLoading: isLoadingEvents } = useListEvents();
  
  // Find all sub-events that belong to this festival
  const subEvents = allEvents.filter(e => e.parent_id === id).sort((a, b) => {
    if (!a.data_inizio || !b.data_inizio) return 0;
    return new Date(a.data_inizio).getTime() - new Date(b.data_inizio).getTime();
  });

  if (isLoadingFestival || isLoadingEvents) {
    return (
      <div className="flex flex-col gap-6 p-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-2xl font-bold font-serif mb-4">Festival non trovato</h2>
        <Link href="/">
          <a className="text-primary hover:underline flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Torna alla mappa
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-16 animate-in fade-in duration-500">
      <Link href="/">
        <a className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Torna agli eventi
        </a>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image & Details */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl ring-1 ring-border">
            {festival.immagine ? (
              <img 
                src={`/api/images/${festival.immagine}`} 
                alt={festival.titolo}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <Flag className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute top-4 left-4 bg-primary/90 backdrop-blur text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 shadow-sm">
              <Flag className="w-4 h-4" /> Festival
            </div>
          </div>
          
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
            <h1 className="font-serif text-3xl font-bold leading-tight mb-4">{festival.titolo}</h1>
            
            <div className="flex flex-col gap-3 text-muted-foreground">
              {festival.luogo && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground">{festival.luogo}</span>
                </div>
              )}
              {festival.data_inizio && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground capitalize">
                    {format(parseISO(festival.data_inizio), "MMMM yyyy", { locale: it })}
                  </span>
                </div>
              )}
            </div>
            
            {festival.testo_estratto && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Informazioni (IA)</h3>
                <p className="text-foreground leading-relaxed">{festival.testo_estratto}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline of Sub-Events */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" /> Programma del Festival
          </h2>

          {subEvents.length === 0 ? (
            <div className="bg-muted/50 rounded-2xl p-8 text-center border border-border border-dashed">
              <p className="text-muted-foreground">Nessun dettaglio giornaliero disponibile per questo festival.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-primary/20 ml-4 md:ml-6 space-y-8 pb-4">
              {subEvents.map((se, index) => {
                const date = se.data_inizio ? parseISO(se.data_inizio) : null;
                
                return (
                  <div key={se.id} className="relative pl-6 md:pl-8 group">
                    <div className="absolute -left-[11px] top-1.5 w-5 h-5 rounded-full bg-background border-2 border-primary group-hover:bg-primary transition-colors duration-300" />
                    
                    <Card className="overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
                      <CardContent className="p-5 flex flex-col gap-2">
                        {date && (
                          <div className="flex items-center gap-2 text-primary font-medium text-sm">
                            <Clock className="w-4 h-4" />
                            <span className="capitalize">{format(date, "EEEE d MMMM yyyy", { locale: it })}</span>
                          </div>
                        )}
                        <h3 className="text-lg font-bold leading-tight">{se.titolo}</h3>
                        
                        {(se.luogo || se.descrizione) && (
                          <div className="mt-2 text-muted-foreground text-sm flex flex-col gap-1">
                            {se.luogo && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {se.luogo}</span>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
