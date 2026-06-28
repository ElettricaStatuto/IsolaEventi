import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

const LS_KEY = "sardegna_admin_key";

interface RefreshResult {
  success: boolean;
  nuovi: number;
  aggiornati: number;
  errori: number;
  messaggio: string;
}

export function Admin() {
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-load key from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setAdminKey(saved);
  }, []);

  const handleRefresh = async () => {
    if (!adminKey.trim()) {
      setError("Inserisci la chiave admin.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/events/refresh`, {
        method: "POST",
        headers: {
          "x-admin-key": adminKey.trim(),
          "Content-Type": "application/json",
        },
      });

      if (resp.status === 403) {
        setError("Chiave non valida. Accesso negato.");
        return;
      }

      if (!resp.ok) {
        setError(`Errore del server: ${resp.status}`);
        return;
      }

      const data: RefreshResult = await resp.json();
      setResult(data);

      // Save key to localStorage only on success
      if (data.success) {
        localStorage.setItem(LS_KEY, adminKey.trim());
      }
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem(LS_KEY);
    setAdminKey("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">Area Admin</h1>
            <p className="text-xs text-muted-foreground">Sardegna Eventi — solo accesso autorizzato</p>
          </div>
        </div>

        {/* Key input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aggiornamento eventi</CardTitle>
            <CardDescription>
              Inserisci la chiave admin e premi il tasto per lanciare lo scraper.
              La chiave verrà salvata nel browser dopo il primo utilizzo riuscito.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-key">Chiave admin</Label>
              <Input
                id="admin-key"
                type="password"
                placeholder="Incolla qui la chiave…"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleRefresh()}
                autoComplete="off"
              />
            </div>

            <Button
              onClick={handleRefresh}
              disabled={loading || !adminKey.trim()}
              className="w-full"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aggiornamento in corso…</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" /> Aggiorna eventi</>
              )}
            </Button>

            {adminKey && (
              <button
                onClick={handleClearKey}
                className="text-xs text-muted-foreground hover:text-foreground text-center underline"
              >
                Rimuovi chiave salvata
              </button>
            )}
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className={result.success ? "border-green-500/40 bg-green-50/30" : "border-destructive/40 bg-destructive/5"}>
            <CardContent className="pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {result.success
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-destructive" />}
                <span className="font-medium text-sm">{result.messaggio}</span>
              </div>
              {result.success && (
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { label: "Nuovi", value: result.nuovi, color: "text-green-700" },
                    { label: "Aggiornati", value: result.aggiornati, color: "text-blue-700" },
                    { label: "Errori", value: result.errori, color: "text-red-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/60 rounded-lg p-2 text-center border border-border/50">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-2">
          Questa pagina non è linkata pubblicamente.
        </p>
      </div>
    </div>
  );
}
