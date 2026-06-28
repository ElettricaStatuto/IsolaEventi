import { useGetEventStats, getGetEventStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, CalendarDays, MapPin, Database } from "lucide-react";
import { Loader2 } from "lucide-react";

export function Stats() {
  const { data: stats, isLoading, isError } = useGetEventStats({
    query: {
      enabled: true,
      queryKey: getGetEventStatsQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center p-8 text-destructive">
        Errore nel caricamento delle statistiche.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Statistiche Eventi</h1>
        <p className="text-muted-foreground text-lg">Panoramica degli eventi culturali in Sardegna.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Totale Eventi</p>
              <h3 className="text-3xl font-bold text-foreground">{stats.totale}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <Map className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mappati</p>
              <h3 className="text-3xl font-bold text-foreground">{stats.con_coordinate}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Prossimi 7 giorni</p>
              <h3 className="text-3xl font-bold text-foreground">{stats.prossimi_7_giorni}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card shadow-sm border-border">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> 
            Top Località
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.luoghi.map((luogo, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors">
                <span className="font-medium text-foreground">{luogo.luogo || "Non specificato"}</span>
                <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-bold">
                  {luogo.count}
                </span>
              </div>
            ))}
            {stats.luoghi.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nessun dato disponibile sulle località.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}