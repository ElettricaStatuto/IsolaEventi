import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface AdminClientErrorsProps {
  adminKey: string;
}

interface ErroreRaggruppato {
  codice: string;
  messaggio: string;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  occorrenze: number;
  ultimaVolta: string;
  primaVolta: string;
}

/**
 * Elenca gli errori JavaScript segnalati dai dispositivi dei visitatori
 * (vedi lib/error-reporting.ts + error-boundary.tsx), raggruppati per
 * codice cosi' da vedere subito quali problemi sono i piu' diffusi invece
 * di scorrere una riga per ogni singola occorrenza.
 */
export function AdminClientErrors({ adminKey }: AdminClientErrorsProps) {
  const [errori, setErrori] = useState<ErroreRaggruppato[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client-errors", { headers: { "x-admin-key": adminKey } });
      const json = await res.json();
      setErrori(json.errori ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    carica();
  }, [carica]);

  if (loading && !errori) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-6">
        <AlertCircle className="w-5 h-5" /> {error}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Errori segnalati dai visitatori</CardTitle>
          <CardDescription>
            Raggruppati per codice: stesso errore ricorrente = stesso codice. Se un utente ti
            scrive "codice XXXXXX", cercalo qui.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={carica} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Aggiorna
        </Button>
      </CardHeader>
      <CardContent>
        {!errori || errori.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nessun errore segnalato finora — ottimo segno.
          </p>
        ) : (
          <div className="space-y-2">
            {errori.map((e) => (
              <div key={e.codice} className="border border-border rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setEspanso(espanso === e.codice ? null : e.codice)}
                  className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {e.codice}
                      </span>
                      <span className="font-medium text-sm truncate">{e.messaggio}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.occorrenze}× · prima volta {new Date(e.primaVolta).toLocaleString("it-IT")} · ultima{" "}
                      {new Date(e.ultimaVolta).toLocaleString("it-IT")}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {e.occorrenze} occorrenz{e.occorrenze === 1 ? "a" : "e"}
                  </span>
                </button>
                {espanso === e.codice && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                    {e.url && (
                      <p>
                        <span className="text-muted-foreground">Pagina: </span>
                        <span className="break-all">{e.url}</span>
                      </p>
                    )}
                    {e.userAgent && (
                      <p>
                        <span className="text-muted-foreground">Dispositivo: </span>
                        <span className="break-all">{e.userAgent}</span>
                      </p>
                    )}
                    {e.stack && (
                      <pre className="whitespace-pre-wrap break-all bg-muted p-2 rounded text-[11px] max-h-64 overflow-y-auto">
                        {e.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
