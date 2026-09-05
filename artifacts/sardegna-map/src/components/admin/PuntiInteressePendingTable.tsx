import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Trash2, Loader2, ExternalLink } from "lucide-react";

interface PuntoInteressePending {
  id: number;
  nome: string;
  categoria: string;
  comune: string | null;
  provincia: string | null;
  latitudine: number;
  longitudine: number;
  descrizione: string | null;
  linkEsterno: string | null;
  fonteOsm: string | null;
  creatoIl: string;
}

interface PuntiInteressePendingTableProps {
  adminKey: string;
}

function apiUrl(path: string): string {
  let baseUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl || !baseUrl.startsWith("http")) baseUrl = "https://isolaeventi.onrender.com";
  if (baseUrl.endsWith("/api")) baseUrl = baseUrl.slice(0, -4);
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Revisione dei punti di interesse importati da OpenStreetMap (nuraghi,
 * chiese, grotte, musei, cantine, ecc.) prima che diventino visibili ai
 * visitatori del sito - stesso principio di revisione usato per gli eventi
 * scrapati: niente arriva live senza un controllo umano.
 */
export function PuntiInteressePendingTable({ adminKey }: PuntiInteressePendingTableProps) {
  const [punti, setPunti] = useState<PuntoInteressePending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroTesto, setFiltroTesto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("Tutte");
  const [azioneInCorso, setAzioneInCorso] = useState<number | null>(null);

  const carica = () => {
    setIsLoading(true);
    fetch(apiUrl("/api/admin/punti-interesse-pending"), { headers: { "x-admin-key": adminKey } })
      .then((res) => res.json())
      .then((data) => setPunti(data.success ? data.punti : []))
      .catch(() => setPunti([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categorie = useMemo(
    () => ["Tutte", ...Array.from(new Set(punti.map((p) => p.categoria))).sort()],
    [punti]
  );

  const filtrati = useMemo(() => {
    return punti.filter((p) => {
      if (filtroCategoria !== "Tutte" && p.categoria !== filtroCategoria) return false;
      if (filtroTesto && !p.nome.toLowerCase().includes(filtroTesto.toLowerCase())) return false;
      return true;
    });
  }, [punti, filtroCategoria, filtroTesto]);

  const pubblica = async (id: number) => {
    setAzioneInCorso(id);
    try {
      const resp = await fetch(apiUrl(`/api/admin/punti-interesse-pending/${id}/pubblica`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({}),
      });
      if (resp.ok) setPunti((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setAzioneInCorso(null);
    }
  };

  const scarta = async (id: number) => {
    setAzioneInCorso(id);
    try {
      const resp = await fetch(apiUrl(`/api/admin/punti-interesse-pending/${id}`), {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      if (resp.ok) setPunti((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setAzioneInCorso(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Punti di Interesse — In Revisione</CardTitle>
        <CardDescription>
          Importati da OpenStreetMap, in attesa di conferma prima di comparire nel sito pubblico.
          {!isLoading && ` ${punti.length} in coda.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Cerca per nome..."
            value={filtroTesto}
            onChange={(e) => setFiltroTesto(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            {categorie.map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  filtroCategoria === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtrati.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Nessun punto da revisionare.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            {filtrati.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground truncate">{p.nome}</span>
                    <Badge variant="secondary" className="text-[10px]">{p.categoria}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.comune || "Comune sconosciuto"} · {p.latitudine.toFixed(4)}, {p.longitudine.toFixed(4)}
                    {p.linkEsterno && (
                      <a
                        href={p.linkEsterno}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 ml-2 text-primary hover:underline"
                      >
                        Wikipedia <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={azioneInCorso === p.id}
                  onClick={() => pubblica(p.id)}
                  className="gap-1 text-xs shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pubblica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={azioneInCorso === p.id}
                  onClick={() => scarta(p.id)}
                  className="gap-1 text-xs shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" /> Scarta
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
