import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Eye, Database } from "lucide-react";

const LS_KEY = "sardegna_admin_key";

interface EventPreview {
  titolo: string;
  data_inizio: string | null;
  data_fine: string | null;
  luogo: string | null;
  latitudine: number | null;
  longitudine: number | null;
  link: string | null;
  descrizione: string | null;
  immagine: string | null;
  fonte: string;
  is_new?: boolean;
}

interface RefreshResult {
  success: boolean;
  nuovi: number;
  aggiornati: number;
  errori: number;
  messaggio: string;
  events?: EventPreview[];
}

function apiFetch(url: string, method: "GET" | "POST" | "DELETE", body?: unknown, key?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) headers["x-admin-key"] = key;
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function Admin() {
  const [adminKey, setAdminKey] = useState("");
  const [step, setStep] = useState<"key" | "preview" | "result">("key");
  const [previewEvents, setPreviewEvents] = useState<EventPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] = useState<RefreshResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setAdminKey(saved);
  }, []);

  const handlePreview = async () => {
    if (!adminKey.trim()) {
      setError("Inserisci la chiave admin.");
      return;
    }
    setError(null);
    setApprovalResult(null);
    setLoading(true);

    try {
      const resp = await apiFetch("/api/events/refresh/preview", "POST", undefined, adminKey.trim());
      if (resp.status === 403) {
        setError("Chiave non valida. Accesso negato.");
        setLoading(false);
        return;
      }
      if (!resp.ok) {
        setError(`Errore del server: ${resp.status}`);
        setLoading(false);
        return;
      }
      const data: RefreshResult = await resp.json();
      if (!data.success) {
        setError(data.messaggio || "Errore durante il preview");
        setLoading(false);
        return;
      }
      const evs = data.events || [];
      setPreviewEvents(evs);
      setSelectedIds(new Set(evs.map((_, i) => i)));
      setStep("preview");
      localStorage.setItem(LS_KEY, adminKey.trim());
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (selectedIds.size === 0) {
      setError("Seleziona almeno un evento da approvare.");
      return;
    }
    const toApprove = Array.from(selectedIds).map((i) => previewEvents[i]);
    setLoading(true);
    setError(null);

    try {
      const resp = await apiFetch("/api/events/approve", "POST", { events: toApprove }, adminKey.trim());
      if (resp.status === 403) {
        setError("Chiave non valida.");
        setLoading(false);
        return;
      }
      if (!resp.ok) {
        setError(`Errore del server: ${resp.status}`);
        setLoading(false);
        return;
      }
      const data: RefreshResult = await resp.json();
      setApprovalResult(data);
      setStep("result");
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem(LS_KEY);
    setAdminKey("");
    setStep("key");
    setPreviewEvents([]);
    setSelectedIds(new Set());
    setApprovalResult(null);
    setError(null);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(previewEvents.map((_, i) => i)));
    else setSelectedIds(new Set());
  };

  const toggleOne = (idx: number, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(idx);
    else next.delete(idx);
    setSelectedIds(next);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">Area Admin</h1>
            <p className="text-xs text-muted-foreground">Sardegna Eventi — approvazione manuale degli eventi</p>
          </div>
        </div>

        {/* Step: Key input */}
        {step === "key" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview eventi</CardTitle>
              <CardDescription>
                Lo scraper recupera eventi dai siti fonte. Puoi vedere l'anteprima, selezionare quelli da pubblicare e approvarli.
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
                  onKeyDown={(e) => e.key === "Enter" && !loading && handlePreview()}
                  autoComplete="off"
                />
              </div>

              <Button onClick={handlePreview} disabled={loading || !adminKey.trim()} className="w-full">
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recupero preview…</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" /> Mostra preview eventi</>
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
        )}

        {/* Step: Preview table */}
        {step === "preview" && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{previewEvents.length} eventi trovati</CardTitle>
                  <CardDescription>
                    Seleziona gli eventi da pubblicare sulla mappa. I deselezionati verranno ignorati (ma non registrati come rifiutati).
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep("key")}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {previewEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Nessun nuovo evento trovato.</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Checkbox
                      checked={selectedIds.size === previewEvents.length && previewEvents.length > 0}
                      onCheckedChange={(v) => toggleAll(v === true)}
                    />
                    <span className="text-sm font-medium">
                      {selectedIds.size} / {previewEvents.length} selezionati
                    </span>
                  </div>

                  <div className="max-h-[60vh] overflow-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="w-10 p-2"></th>
                          <th className="p-2 text-left">Immagine</th>
                          <th className="p-2 text-left">Titolo</th>
                          <th className="p-2 text-left">Data</th>
                          <th className="p-2 text-left">Luogo</th>
                          <th className="p-2 text-left">Fonte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewEvents.map((ev, i) => (
                          <tr key={i} className="border-t border-border hover:bg-muted/40">
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(i)}
                                onCheckedChange={(v) => toggleOne(i, v === true)}
                              />
                            </td>
                            <td className="p-2">
                              {ev.immagine ? (
                                <img
                                  src={ev.immagine.startsWith("http") ? ev.immagine : `/api/event-images/${ev.immagine}`}
                                  alt={ev.titolo}
                                  className="w-16 h-12 object-cover rounded border"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                                  —
                                </div>
                              )}
                            </td>
                            <td className="p-2 font-medium">
                              {ev.link ? (
                                <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {ev.titolo}
                                </a>
                              ) : (
                                ev.titolo
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground whitespace-nowrap">
                              {ev.data_inizio ?? "—"}
                              {ev.data_fine && ev.data_fine !== ev.data_inizio ? (
                                <span className="text-xs"> → {ev.data_fine}</span>
                              ) : null}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {ev.luogo ?? "—"}
                              {ev.latitudine != null && ev.longitudine != null && (
                                <span className="text-xs text-green-600 ml-1">✓ geo</span>
                              )}
                            </td>
                            <td className="p-2">
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                                {ev.fonte}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleApprove} disabled={loading} className="flex-1">
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approvazione…</>
                      ) : (
                        <><Database className="w-4 h-4 mr-2" /> Pubblica {selectedIds.size} eventi</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setStep("key")}>
                      Annulla
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Result */}
        {step === "result" && approvalResult && (
          <Card className="border-green-500/40 bg-green-50/30">
            <CardContent className="pt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-sm">{approvalResult.messaggio}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { label: "Nuovi", value: approvalResult.nuovi, color: "text-green-700" },
                  { label: "Aggiornati", value: approvalResult.aggiornati, color: "text-blue-700" },
                  { label: "Errori", value: approvalResult.errori, color: "text-red-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/60 rounded-lg p-2 text-center border border-border/50">
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-2" onClick={() => setStep("key")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Torna al preview
              </Button>
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
