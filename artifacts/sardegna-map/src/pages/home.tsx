import { useState, useMemo } from "react";
import { useListEvents, getListEventsQueryKey, useRefreshEvents } from "@workspace/api-client-react";
import { MapView } from "../components/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, addDays, nextSunday, isAfter, isBefore } from "date-fns";
import { MapPin, Calendar, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function Home() {
  const [dateFilter, setDateFilter] = useState<"all" | "weekend" | "next_week">("all");
  const queryClient = useQueryClient();
  
  const queryParams = useMemo(() => {
    if (dateFilter === "all") return {};
    const today = new Date();
    if (dateFilter === "weekend") {
      const thisSunday = nextSunday(today);
      return {
        date_from: format(today, "yyyy-MM-dd"),
        date_to: format(thisSunday, "yyyy-MM-dd")
      };
    }
    if (dateFilter === "next_week") {
      return {
        date_from: format(today, "yyyy-MM-dd"),
        date_to: format(addDays(today, 7), "yyyy-MM-dd")
      };
    }
    return {};
  }, [dateFilter]);

  const { data: events, isLoading, isError } = useListEvents(queryParams, {
    query: {
      enabled: true,
      queryKey: getListEventsQueryKey(queryParams)
    }
  });

  const refreshMutation = useRefreshEvents({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(queryParams) });
      }
    }
  });

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const handleRefresh = () => {
    refreshMutation.mutate(undefined);
  };

  return (
    <div className="flex flex-col h-full lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">
        <div className="flex flex-col gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Esplora Eventi</h2>
            <p className="text-sm text-muted-foreground">Scopri le sagre e i festival in Sardegna.</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={dateFilter === "all" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setDateFilter("all")}
              className={dateFilter === "all" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
            >
              Tutto
            </Button>
            <Button 
              variant={dateFilter === "weekend" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setDateFilter("weekend")}
              className={dateFilter === "weekend" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
            >
              Questo weekend
            </Button>
            <Button 
              variant={dateFilter === "next_week" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setDateFilter("next_week")}
              className={dateFilter === "next_week" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
            >
              Prossima settimana
            </Button>
          </div>

          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshMutation.isPending}
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {refreshMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Aggiorna eventi
          </Button>
        </div>

        <div className="flex-1 bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground">
              {isLoading ? "Caricamento in corso..." : `${events?.length || 0} eventi trovati`}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 flex flex-col gap-3">
              {isLoading && (
                <div className="flex justify-center p-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              {isError && (
                <div className="text-center p-4 text-destructive">
                  Errore nel caricamento degli eventi.
                </div>
              )}
              {!isLoading && !isError && events?.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                  Nessun evento trovato per queste date.
                </div>
              )}
              {!isLoading && !isError && events?.map(evt => (
                <Card 
                  key={evt.id} 
                  className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedEventId === evt.id ? 'border-primary shadow-sm bg-primary/5' : 'bg-card'}`}
                  onClick={() => setSelectedEventId(evt.id)}
                >
                  <CardContent className="p-4">
                    <h3 className="font-bold text-foreground mb-2 leading-tight">{evt.titolo}</h3>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      {evt.data_inizio && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {format(new Date(evt.data_inizio), "dd/MM/yyyy")}
                            {evt.data_fine && evt.data_fine !== evt.data_inizio && ` - ${format(new Date(evt.data_fine), "dd/MM/yyyy")}`}
                          </span>
                        </div>
                      )}
                      {evt.luogo && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-secondary" />
                          <span className="font-medium">{evt.luogo}</span>
                        </div>
                      )}
                      {evt.link && (
                        <a href={evt.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline mt-1" onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3.5 h-3.5" /> Vedi fonte
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="w-full lg:w-2/3 h-[50vh] lg:h-full relative rounded-xl overflow-hidden shadow-sm border border-border">
        {isLoading ? (
          <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MapView events={events || []} selectedEventId={selectedEventId} />
        )}
      </div>
    </div>
  );
}