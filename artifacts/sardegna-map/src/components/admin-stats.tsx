import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, TrendingUp, MapPin, CheckCircle2, Database, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface AdminStatsProps {
  adminKey: string;
}

interface StatsData {
  totale_pubblicati: number;
  totale_analizzati: number;
  totale_grezzi: number;
  totale_rifiutati: number;
  senza_coordinate: number;
  fonti: { fonte: string; totale: number; analizzati: number }[];
  top_tags: { tag: string; count: number }[];
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function AdminStats({ adminKey }: AdminStatsProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/events/admin-stats", {
          headers: { "x-admin-key": adminKey }
        });
        const json = await response.json();
        
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Errore nel caricamento delle statistiche");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [adminKey]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <p>Errore: {error}</p>
      </div>
    );
  }

  const pieData = [
    { name: "Analizzati (Qualità Alta)", value: data.totale_analizzati },
    { name: "Grezzi (Da Analizzare)", value: data.totale_grezzi }
  ];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Totale Database</p>
              <h3 className="text-2xl font-bold">{data.totale_pubblicati}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Analizzati IA</p>
              <h3 className="text-2xl font-bold">{data.totale_analizzati}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Senza Coordinate</p>
              <h3 className="text-2xl font-bold">{data.senza_coordinate}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Scartati (Blacklist)</p>
              <h3 className="text-2xl font-bold">{data.totale_rifiutati}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── PIE CHART: QUALITA DATI ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Stato Analisi Intelligenza Artificiale
            </CardTitle>
            <CardDescription>Eventi ricchi di dettagli vs Eventi grezzi testuali.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── MIGLIORAMENTI CONIGLIATI ── */}
        <Card className="shadow-sm border-amber-200">
          <CardHeader className="pb-2 bg-amber-50/50">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <TrendingUp className="w-4 h-4" />
              Azioni di Miglioramento Consigliate
            </CardTitle>
            <CardDescription>Aumenta la visibilità degli eventi migliorandone i dati.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            
            {data.totale_grezzi > 0 ? (
              <div className="flex items-start gap-3 p-3 rounded-md bg-amber-100/50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">Analizza {data.totale_grezzi} eventi grezzi</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Hai {data.totale_grezzi} eventi nel database che non sono stati arricchiti dall'IA. 
                    Un'analisi produrrà descrizioni migliori, tag accurati e migliorerà la SEO.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-green-900 text-sm">Tutti gli eventi sono analizzati!</h4>
                  <p className="text-xs text-green-800 mt-1">Ottimo lavoro, il tuo database è di altissima qualità.</p>
                </div>
              </div>
            )}

            {data.senza_coordinate > 0 ? (
              <div className="flex items-start gap-3 p-3 rounded-md bg-blue-50 border border-blue-200">
                <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">{data.senza_coordinate} eventi invisibili sulla mappa</h4>
                  <p className="text-xs text-blue-800 mt-1">
                    Questi eventi non hanno coordinate GPS precise. Prova a modificare il luogo specificando meglio la città o l'indirizzo per permettere il geocoding.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 border border-green-200">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-green-900 text-sm">Nessun evento orfano di mappa!</h4>
                  <p className="text-xs text-green-800 mt-1">Tutti gli eventi pubblicati sono correttamente geolocalizzati.</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* ── BAR CHART: FONTI ── */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resa delle Fonti (Scrapers)</CardTitle>
            <CardDescription>Quali fonti stanno portando più eventi nel database.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.fonti} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="fonte" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <Bar dataKey="totale" name="Totale Estratti" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="analizzati" name="Analizzati IA" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── BAR CHART: TOP TAGS ── */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 15 Categorie (Tags)</CardTitle>
            <CardDescription>Le tipologie di eventi più diffuse in Sardegna.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_tags} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="tag" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" name="Numero di Eventi" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                  {data.top_tags.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
