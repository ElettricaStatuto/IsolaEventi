import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Eye, Database,
  Trash2, RotateCcw, AlertTriangle, Calendar, MapPin, Globe, Search,
} from "lucide-react";

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

interface DbEvent {
  id: number;
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
  aggiornato_il: string;
}

interface RejectedEvent {
  id: number;
  titolo: string;
  fonte: string;
  motivo: string | null;
  rifiutato_il: string;
}

interface RefreshResult {
  success: boolean;
  nuovi: number;
  aggiornati: number;
  errori: number;
  messaggio: string;
  events?: EventPreview[];
}

async function fetchJson<T>(url: string, method: string, body?: unknown, key?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export function Admin() {
  const [adminKey, setAdminKey] = useState("bypass");
  const [keyVerified, setKeyVerified] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scraping");

  // ── Scraping tab ──
  const [previewEvents, setPreviewEvents] = useState<EventPreview[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<number>>(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [approvalResult, setApprovalResult] = useState<RefreshResult | null>(null);
  const [scrapingStep, setScrapingStep] = useState<"input" | "list" | "result">("input");
  const [scrapingLogs, setScrapingLogs] = useState<string[]>([]);

  // ── Published tab ──
  const [publishedEvents, setPublishedEvents] = useState<DbEvent[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);
  const [selectedPubIds, setSelectedPubIds] = useState<Set<number>>(new Set());
  const [filterTitolo, setFilterTitolo] = useState("");
  const [filterDataFrom, setFilterDataFrom] = useState("");
  const [filterDataTo, setFilterDataTo] = useState("");
  const [filterLuogo, setFilterLuogo] = useState("");
  const [filterFonte, setFilterFonte] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    titolo: "", dataFrom: "", dataTo: "", luogo: "", fonte: ""
  });

  // ── Rejected tab ──
  const [rejectedEvents, setRejectedEvents] = useState<RejectedEvent[]>([]);
  const [loadingRejected, setLoadingRejected] = useState(false);

  // ── Preview tab filters ──
  const [prevFilterTitolo, setPrevFilterTitolo] = useState("");
  const [prevFilterDataFrom, setPrevFilterDataFrom] = useState("");
  const [prevFilterDataTo, setPrevFilterDataTo] = useState("");
  const [prevFilterLuogo, setPrevFilterLuogo] = useState("");
  const [prevFilterFonte, setPrevFilterFonte] = useState("");
  const [appliedPrevFilters, setAppliedPrevFilters] = useState({
    titolo: "", dataFrom: "", dataTo: "", luogo: "", fonte: ""
  });

  // ── Rejected tab filters ──
  const [rejFilterTitolo, setRejFilterTitolo] = useState("");
  const [rejFilterFonte, setRejFilterFonte] = useState("");
  const [rejFilterMotivo, setRejFilterMotivo] = useState("");
  const [rejFilterDataFrom, setRejFilterDataFrom] = useState("");
  const [rejFilterDataTo, setRejFilterDataTo] = useState("");
  const [appliedRejFilters, setAppliedRejFilters] = useState({
    titolo: "", fonte: "", motivo: "", dataFrom: "", dataTo: ""
  });

  const applyPrevFilters = () => setAppliedPrevFilters({ titolo: prevFilterTitolo, dataFrom: prevFilterDataFrom, dataTo: prevFilterDataTo, luogo: prevFilterLuogo, fonte: prevFilterFonte });
  const clearPrevFilters = () => { setPrevFilterTitolo(""); setPrevFilterDataFrom(""); setPrevFilterDataTo(""); setPrevFilterLuogo(""); setPrevFilterFonte(""); setAppliedPrevFilters({ titolo: "", dataFrom: "", dataTo: "", luogo: "", fonte: "" }); };

  const applyRejFilters = () => setAppliedRejFilters({ titolo: rejFilterTitolo, fonte: rejFilterFonte, motivo: rejFilterMotivo, dataFrom: rejFilterDataFrom, dataTo: rejFilterDataTo });
  const clearRejFilters = () => { setRejFilterTitolo(""); setRejFilterFonte(""); setRejFilterMotivo(""); setRejFilterDataFrom(""); setRejFilterDataTo(""); setAppliedRejFilters({ titolo: "", fonte: "", motivo: "", dataFrom: "", dataTo: "" }); };

  const filteredPreviewEvents = previewEvents.map((ev, i) => ({ ev, i })).filter(({ ev }) => {
    if (appliedPrevFilters.titolo && !ev.titolo.toLowerCase().includes(appliedPrevFilters.titolo.toLowerCase())) return false;
    if (appliedPrevFilters.luogo && !(ev.luogo || "").toLowerCase().includes(appliedPrevFilters.luogo.toLowerCase())) return false;
    if (appliedPrevFilters.fonte && !ev.fonte.toLowerCase().includes(appliedPrevFilters.fonte.toLowerCase())) return false;
    if (appliedPrevFilters.dataFrom && (ev.data_inizio || "") < appliedPrevFilters.dataFrom) return false;
    if (appliedPrevFilters.dataTo && (ev.data_inizio || "") > appliedPrevFilters.dataTo) return false;
    return true;
  });

  const filteredRejectedEvents = rejectedEvents.filter((ev) => {
    if (appliedRejFilters.titolo && !ev.titolo.toLowerCase().includes(appliedRejFilters.titolo.toLowerCase())) return false;
    if (appliedRejFilters.fonte && !ev.fonte.toLowerCase().includes(appliedRejFilters.fonte.toLowerCase())) return false;
    if (appliedRejFilters.motivo && !(ev.motivo || "").toLowerCase().includes(appliedRejFilters.motivo.toLowerCase())) return false;
    if (appliedRejFilters.dataFrom && ev.rifiutato_il.substring(0,10) < appliedRejFilters.dataFrom) return false;
    if (appliedRejFilters.dataTo && ev.rifiutato_il.substring(0,10) > appliedRejFilters.dataTo) return false;
    return true;
  });

  // ── Global error ──
  const [error, setError] = useState<string | null>(null);

  // Load saved key
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      setAdminKey(saved);
      setKeyVerified(true);
    }
  }, []);

  const verifyKey = useCallback(async () => {
    setKeyError(null);
    if (!adminKey.trim()) {
      setKeyError("Inserisci la chiave admin.");
      return false;
    }
    try {
      await fetchJson("/api/events/rejected", "GET", undefined, adminKey.trim());
      setKeyVerified(true);
      localStorage.setItem(LS_KEY, adminKey.trim());
      return true;
    } catch (e) {
      setKeyVerified(false);
      setKeyError("Chiave non valida. Accesso negato.");
      return false;
    }
  }, [adminKey]);

  const handleClearKey = () => {
    localStorage.removeItem(LS_KEY);
    setAdminKey("");
    setKeyVerified(false);
    setKeyError(null);
    setScrapingStep("input");
    setScrapingLogs([]);
    setPreviewEvents([]);
    setSelectedPreviewIds(new Set());
    setApprovalResult(null);
    setPublishedEvents([]);
    setRejectedEvents([]);
    setSelectedPubIds(new Set());
  };

  // ── Published data & handlers ──
  const loadPublished = useCallback(async (filters: typeof appliedFilters) => {
    if (!adminKey) return;
    setLoadingPublished(true);
    try {
      const params = new URLSearchParams();
      if (filters.titolo) params.set("titolo", filters.titolo);
      if (filters.dataFrom) params.set("date_from", filters.dataFrom);
      if (filters.dataTo) params.set("date_to", filters.dataTo);
      if (filters.luogo) params.set("luogo", filters.luogo);
      if (filters.fonte) params.set("fonte", filters.fonte);
      const data: DbEvent[] = await fetchJson(`/api/events?${params}`, "GET", undefined, adminKey);
      setPublishedEvents(data);
      setSelectedPubIds(new Set());
    } catch (e) {
      setError(`Errore caricamento eventi: ${String(e)}`);
    } finally {
      setLoadingPublished(false);
    }
  }, [adminKey]);

  // ── Scraping handlers ──
  const handlePreview = async () => {
    if (!keyVerified && !(await verifyKey())) return;
    setError(null);
    setApprovalResult(null);
    setLoadingPreview(true);
    setScrapingLogs([]);
    try {
      const resp = await fetch("/api/events/refresh/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim()
        }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalResult: RefreshResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.log) {
                setScrapingLogs(prev => [...prev, parsed.log]);
              } else if (parsed.events || parsed.success !== undefined) {
                finalResult = parsed;
              }
            } catch (e) {
               // ignore
            }
          }
        }
        if (done) break;
      }

      if (buffer.trim()) {
        try {
           const parsed = JSON.parse(buffer);
           if (parsed.log) {
             setScrapingLogs(prev => [...prev, parsed.log]);
           } else if (parsed.events || parsed.success !== undefined) {
             finalResult = parsed;
           }
        } catch (e) {}
      }

      if (!finalResult || !finalResult.success) {
        setError(finalResult?.messaggio || "Errore durante il preview");
        return;
      }
      const evs = finalResult.events || [];
      setPreviewEvents(evs);
      setSelectedPreviewIds(new Set(evs.map((_, i) => i)));
      setScrapingStep("list");
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApprove = async () => {
    if (selectedPreviewIds.size === 0) {
      setError("Seleziona almeno un evento da approvare.");
      return;
    }
    const toApprove = Array.from(selectedPreviewIds).map((i) => previewEvents[i]);
    setLoadingPreview(true);
    setError(null);
    try {
      const data: RefreshResult = await fetchJson("/api/events/approve", "POST", { events: toApprove }, adminKey);
      setApprovalResult(data);
      setScrapingStep("result");
      // Refresh published list if we switch to that tab
      loadPublished(appliedFilters);
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePreviewAll = (checked: boolean) => {
    if (checked) setSelectedPreviewIds(new Set(previewEvents.map((_, i) => i)));
    else setSelectedPreviewIds(new Set());
  };
  const togglePreviewOne = (idx: number, checked: boolean) => {
    const next = new Set(selectedPreviewIds);
    if (checked) next.add(idx);
    else next.delete(idx);
    setSelectedPreviewIds(next);
  };

  useEffect(() => {
    if (activeTab === "published" && keyVerified) {
      loadPublished(appliedFilters);
    }
  }, [activeTab, keyVerified, appliedFilters, loadPublished]);

  const applyFilters = () => {
    setAppliedFilters({
      titolo: filterTitolo,
      dataFrom: filterDataFrom,
      dataTo: filterDataTo,
      luogo: filterLuogo,
      fonte: filterFonte,
    });
  };

  const clearFilters = () => {
    setFilterTitolo("");
    setFilterDataFrom("");
    setFilterDataTo("");
    setFilterLuogo("");
    setFilterFonte("");
    setAppliedFilters({ titolo: "", dataFrom: "", dataTo: "", luogo: "", fonte: "" });
  };

  const deleteEvent = async (id: number, recordRejected: boolean) => {
    if (!confirm(recordRejected
      ? "Eliminare l'evento e aggiungerlo alla blacklist (non verrà più proposto dallo scraper)?"
      : "Eliminare l'evento dalla mappa?")) return;
    setError(null);
    try {
      await fetchJson(`/api/events/${id}`, "DELETE", { record_rejected: recordRejected }, adminKey);
      loadPublished(appliedFilters);
      if (recordRejected) refreshRejected();
    } catch (e) {
      setError(`Errore eliminazione: ${String(e)}`);
    }
  };

  const bulkDelete = async (recordRejected: boolean) => {
    const ids = Array.from(selectedPubIds);
    if (ids.length === 0) return;
    if (!confirm(recordRejected
      ? `Eliminare ${ids.length} eventi e aggiungerli alla blacklist?`
      : `Eliminare ${ids.length} eventi dalla mappa?`)) return;
    setError(null);
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await fetchJson(`/api/events/${id}`, "DELETE", { record_rejected: recordRejected }, adminKey);
        success++;
      } catch {
        failed++;
      }
    }
    loadPublished(appliedFilters);
    if (recordRejected) refreshRejected();
    setSelectedPubIds(new Set());
    if (failed > 0) setError(`${failed} eliminazioni fallite su ${ids.length}`);
  };

  const togglePubAll = (checked: boolean) => {
    if (checked) setSelectedPubIds(new Set(publishedEvents.map((e) => e.id)));
    else setSelectedPubIds(new Set());
  };
  const togglePubOne = (id: number, checked: boolean) => {
    const next = new Set(selectedPubIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedPubIds(next);
  };

  // ── Rejected data & handlers ──
  const refreshRejected = useCallback(async () => {
    if (!adminKey) return;
    setLoadingRejected(true);
    try {
      const data: RejectedEvent[] = await fetchJson("/api/events/rejected", "GET", undefined, adminKey);
      setRejectedEvents(data);
    } catch (e) {
      setError(`Errore caricamento scartati: ${String(e)}`);
    } finally {
      setLoadingRejected(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (activeTab === "rejected" && keyVerified) refreshRejected();
  }, [activeTab, keyVerified, refreshRejected]);

  const restoreRejected = async (id: number) => {
    setError(null);
    try {
      await fetchJson(`/api/events/rejected/${id}`, "DELETE", undefined, adminKey);
      refreshRejected();
    } catch (e) {
      setError(`Errore ripristino: ${String(e)}`);
    }
  };

  // ── Render helpers ──
  const imageUrl = (ev: { immagine: string | null; titolo: string }) => {
    if (!ev.immagine) return null;
    return ev.immagine.startsWith("http") ? ev.immagine : `/api/event-images/${ev.immagine}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">Area Admin</h1>
            <p className="text-xs text-muted-foreground">Sardegna Eventi — gestione eventi e approvazione</p>
          </div>
        </div>



        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="scraping">
              <Eye className="w-4 h-4 mr-1" /> Scraping
            </TabsTrigger>
            <TabsTrigger value="published">
              <Database className="w-4 h-4 mr-1" /> Pubblicati
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <AlertTriangle className="w-4 h-4 mr-1" /> Scartati
            </TabsTrigger>
          </TabsList>

          {/* ── SCRAPING TAB ── */}
          <TabsContent value="scraping" className="mt-4">
            {scrapingStep === "input" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Preview eventi</CardTitle>
                  <CardDescription>
                    Avvia lo scraper per recuperare eventi dai siti fonte. Potrai vedere l'anteprima, selezionare quelli da pubblicare e approvarli.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Button onClick={handlePreview} disabled={loadingPreview || !keyVerified} className="w-full max-w-sm">
                    {loadingPreview ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping in corso…</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" /> Mostra preview eventi</>
                    )}
                  </Button>
                  {!keyVerified && (
                    <p className="text-sm text-muted-foreground">Inserisci e verifica la chiave admin prima di procedere.</p>
                  )}
                  {scrapingLogs.length > 0 && (
                    <div className="mt-4 bg-[#1e1e1e] text-green-400 p-4 rounded-md font-mono text-xs max-h-64 overflow-y-auto shadow-inner border border-border/50">
                      {scrapingLogs.map((log, i) => (
                        <div key={i} className="mb-1"><span className="text-muted-foreground mr-2">{">"}</span> {log}</div>
                      ))}
                      {loadingPreview && <div className="animate-pulse"><span className="text-muted-foreground mr-2">{">"}</span> _</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {scrapingStep === "list" && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{previewEvents.length} eventi trovati</CardTitle>
                      <CardDescription>
                        Seleziona gli eventi da pubblicare. I deselezionati verranno ignorati.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setScrapingStep("input")}>
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
                          checked={selectedPreviewIds.size === previewEvents.length && previewEvents.length > 0}
                          onCheckedChange={(v) => togglePreviewAll(v === true)}
                        />
                        <span className="text-sm font-medium">
                          {selectedPreviewIds.size} / {previewEvents.length} selezionati
                        </span>
                      </div>
                      <div className="max-h-[60vh] overflow-auto border rounded-md">
                        <table className="w-full text-sm">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="w-10 p-2"></th>
                              <th className="p-2 text-left text-xs font-semibold">Immagine</th>
                              <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Search className="w-3 h-3" /> Titolo</div></th>
                              <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Data</div></th>
                              <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Luogo</div></th>
                              <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Globe className="w-3 h-3" /> Fonte</div></th>
                            </tr>
                            <tr className="border-t border-border">
                              <th className="p-1"></th>
                              <th className="p-1"></th>
                              <th className="p-1">
                                <Input placeholder="Filtra titolo…" value={prevFilterTitolo} onChange={(e) => setPrevFilterTitolo(e.target.value)} className="h-7 text-xs" />
                              </th>
                              <th className="p-1">
                                <div className="flex gap-1">
                                  <Input type="date" value={prevFilterDataFrom} onChange={(e) => setPrevFilterDataFrom(e.target.value)} className="h-7 text-xs px-1" />
                                  <Input type="date" value={prevFilterDataTo} onChange={(e) => setPrevFilterDataTo(e.target.value)} className="h-7 text-xs px-1" />
                                </div>
                              </th>
                              <th className="p-1">
                                <Input placeholder="Filtra luogo…" value={prevFilterLuogo} onChange={(e) => setPrevFilterLuogo(e.target.value)} className="h-7 text-xs" />
                              </th>
                              <th className="p-1">
                                <div className="flex gap-1">
                                  <Input placeholder="Filtra fonte…" value={prevFilterFonte} onChange={(e) => setPrevFilterFonte(e.target.value)} className="h-7 text-xs" />
                                  <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={applyPrevFilters}><Search className="w-3 h-3 mr-1" /> Applica</Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" onClick={clearPrevFilters}>Azzera</Button>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPreviewEvents.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">Nessun evento trovato con i filtri attuali.</td>
                              </tr>
                            ) : (
                              filteredPreviewEvents.map(({ ev, i }) => (
                                <tr key={i} className="border-t border-border hover:bg-muted/40">
                                  <td className="p-2">
                                    <Checkbox
                                      checked={selectedPreviewIds.has(i)}
                                      onCheckedChange={(v) => togglePreviewOne(i, v === true)}
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
                                      <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                                    )}
                                  </td>
                                  <td className="p-2 font-medium">
                                    {ev.link ? (
                                      <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{ev.titolo}</a>
                                    ) : ev.titolo}
                                  </td>
                                  <td className="p-2 text-muted-foreground whitespace-nowrap">
                                    {ev.data_inizio ?? "—"}
                                    {ev.data_fine && ev.data_fine !== ev.data_inizio ? <span className="text-xs"> → {ev.data_fine}</span> : null}
                                  </td>
                                  <td className="p-2 text-muted-foreground">
                                    {ev.luogo ?? "—"}
                                    {ev.latitudine != null && ev.longitudine != null && <span className="text-xs text-green-600 ml-1">✓ geo</span>}
                                  </td>
                                  <td className="p-2">
                                    <Badge variant="secondary">{ev.fonte}</Badge>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleApprove} disabled={loadingPreview} className="flex-1">
                          {loadingPreview ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approvazione…</>
                          ) : (
                            <><Database className="w-4 h-4 mr-2" /> Pubblica {selectedPreviewIds.size} eventi</>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setScrapingStep("input")}>Annulla</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {scrapingStep === "result" && approvalResult && (
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
                  <Button variant="outline" className="mt-2" onClick={() => setScrapingStep("input")}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Nuovo preview
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── PUBLISHED TAB ── */}
          <TabsContent value="published" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{publishedEvents.length} eventi pubblicati</CardTitle>
                    <CardDescription>
                      Gestisci gli eventi già sulla mappa. Filtra, seleziona ed elimina.
                    </CardDescription>
                  </div>
                  {loadingPublished && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {/* Bulk actions */}
                {selectedPubIds.size > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">{selectedPubIds.size} selezionati</span>
                    <div className="flex-1"></div>
                    <Button variant="destructive" size="sm" onClick={() => bulkDelete(false)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Elimina
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => bulkDelete(true)}>
                      <AlertTriangle className="w-4 h-4 mr-1" /> Elimina e scarta
                    </Button>
                  </div>
                )}

                <div className="overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="w-10 p-2">
                          <Checkbox
                            checked={publishedEvents.length > 0 && selectedPubIds.size === publishedEvents.length}
                            onCheckedChange={(v) => togglePubAll(v === true)}
                          />
                        </th>
                        <th className="p-2 text-left text-xs font-semibold">Immagine</th>
                        <th className="p-2 text-left text-xs font-semibold">
                          <div className="flex items-center gap-1"><Search className="w-3 h-3" /> Titolo</div>
                        </th>
                        <th className="p-2 text-left text-xs font-semibold">
                          <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Data</div>
                        </th>
                        <th className="p-2 text-left text-xs font-semibold">
                          <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Luogo</div>
                        </th>
                        <th className="p-2 text-left text-xs font-semibold">
                          <div className="flex items-center gap-1"><Globe className="w-3 h-3" /> Fonte</div>
                        </th>
                        <th className="p-2 text-left text-xs font-semibold">Azioni</th>
                      </tr>
                      <tr className="border-t border-border">
                        <th className="p-1"></th>
                        <th className="p-1"></th>
                        <th className="p-1">
                          <Input
                            placeholder="Filtra titolo…"
                            value={filterTitolo}
                            onChange={(e) => setFilterTitolo(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </th>
                        <th className="p-1">
                          <div className="flex gap-1">
                            <Input type="date" value={filterDataFrom} onChange={(e) => setFilterDataFrom(e.target.value)} className="h-7 text-xs px-1" />
                            <Input type="date" value={filterDataTo} onChange={(e) => setFilterDataTo(e.target.value)} className="h-7 text-xs px-1" />
                          </div>
                        </th>
                        <th className="p-1">
                          <Input
                            placeholder="Filtra luogo…"
                            value={filterLuogo}
                            onChange={(e) => setFilterLuogo(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </th>
                        <th className="p-1">
                          <Input
                            placeholder="Filtra fonte…"
                            value={filterFonte}
                            onChange={(e) => setFilterFonte(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </th>
                        <th className="p-1">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs px-2" onClick={applyFilters}>
                              <Search className="w-3 h-3 mr-1" /> Applica
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearFilters}>
                              Azzera
                            </Button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            {loadingPublished ? "Caricamento…" : "Nessun evento trovato con i filtri attuali."}
                          </td>
                        </tr>
                      ) : (
                        publishedEvents.map((ev) => {
                          const img = imageUrl(ev);
                          return (
                            <tr key={ev.id} className="border-t border-border hover:bg-muted/40">
                              <td className="p-2">
                                <Checkbox
                                  checked={selectedPubIds.has(ev.id)}
                                  onCheckedChange={(v) => togglePubOne(ev.id, v === true)}
                                />
                              </td>
                              <td className="p-2">
                                {img ? (
                                  <img src={img} alt={ev.titolo} className="w-16 h-12 object-cover rounded border" loading="lazy" />
                                ) : (
                                  <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                                )}
                              </td>
                              <td className="p-2 font-medium max-w-xs truncate">
                                {ev.link ? (
                                  <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{ev.titolo}</a>
                                ) : ev.titolo}
                              </td>
                              <td className="p-2 text-muted-foreground whitespace-nowrap">
                                {ev.data_inizio ?? "—"}
                                {ev.data_fine && ev.data_fine !== ev.data_inizio ? <span className="text-xs"> → {ev.data_fine}</span> : null}
                              </td>
                              <td className="p-2 text-muted-foreground">
                                {ev.luogo ?? "—"}
                                {ev.latitudine != null && ev.longitudine != null && <span className="text-xs text-green-600 ml-1">✓</span>}
                              </td>
                              <td className="p-2">
                                <Badge variant="secondary">{ev.fonte}</Badge>
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Elimina" onClick={() => deleteEvent(ev.id, false)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Elimina e scarta" onClick={() => deleteEvent(ev.id, true)}>
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── REJECTED TAB ── */}
          <TabsContent value="rejected" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{rejectedEvents.length} eventi scartati</CardTitle>
                    <CardDescription>
                      Eventi aggiunti alla blacklist. Lo scraper li ignorerà. Puoi ripristinarli.
                    </CardDescription>
                  </div>
                  {loadingRejected && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Search className="w-3 h-3" /> Titolo</div></th>
                        <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Globe className="w-3 h-3" /> Fonte</div></th>
                        <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Motivo</div></th>
                        <th className="p-2 text-left text-xs font-semibold"><div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Scartato il</div></th>
                        <th className="p-2 text-left text-xs font-semibold">Azione</th>
                      </tr>
                      <tr className="border-t border-border">
                        <th className="p-1">
                          <Input placeholder="Filtra titolo…" value={rejFilterTitolo} onChange={(e) => setRejFilterTitolo(e.target.value)} className="h-7 text-xs" />
                        </th>
                        <th className="p-1">
                          <Input placeholder="Filtra fonte…" value={rejFilterFonte} onChange={(e) => setRejFilterFonte(e.target.value)} className="h-7 text-xs" />
                        </th>
                        <th className="p-1">
                          <Input placeholder="Filtra motivo…" value={rejFilterMotivo} onChange={(e) => setRejFilterMotivo(e.target.value)} className="h-7 text-xs" />
                        </th>
                        <th className="p-1">
                          <div className="flex gap-1">
                            <Input type="date" value={rejFilterDataFrom} onChange={(e) => setRejFilterDataFrom(e.target.value)} className="h-7 text-xs px-1" />
                            <Input type="date" value={rejFilterDataTo} onChange={(e) => setRejFilterDataTo(e.target.value)} className="h-7 text-xs px-1" />
                          </div>
                        </th>
                        <th className="p-1">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={applyRejFilters}><Search className="w-3 h-3 mr-1" /> Applica</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" onClick={clearRejFilters}>Azzera</Button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRejectedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            {loadingRejected ? "Caricamento…" : "Nessun evento scartato trovato."}
                          </td>
                        </tr>
                      ) : (
                        filteredRejectedEvents.map((ev) => (
                          <tr key={ev.id} className="border-t border-border hover:bg-muted/40">
                            <td className="p-2 font-medium">{ev.titolo}</td>
                            <td className="p-2"><Badge variant="secondary">{ev.fonte}</Badge></td>
                            <td className="p-2 text-muted-foreground">{ev.motivo ?? "—"}</td>
                            <td className="p-2 text-muted-foreground whitespace-nowrap">
                              {new Date(ev.rifiutato_il).toLocaleDateString("it-IT")}
                            </td>
                            <td className="p-2">
                              <Button variant="ghost" size="sm" onClick={() => restoreRejected(ev.id)}>
                                <RotateCcw className="w-4 h-4 mr-1" /> Ripristina
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Global error */}
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>Chiudi</Button>
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
