import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Eye, Database,
  Trash2, RotateCcw, AlertTriangle, Calendar, MapPin, Globe, Search, RefreshCw, Clock
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
  parent_id?: number | null;
  testo_estratto?: string | null;
  is_festival?: boolean | null;
  sotto_eventi?: any[];
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
  testo_estratto?: string | null;
  parent_id?: number | null;
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
  const [selectedApproveIds, setSelectedApproveIds] = useState<Set<number>>(new Set());
  const [selectedAnalyzeIds, setSelectedAnalyzeIds] = useState<Set<number>>(new Set());
  const [analyzingPreview, setAnalyzingPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [approvalResult, setApprovalResult] = useState<RefreshResult | null>(null);
  const [scrapingStep, setScrapingStep] = useState<"input" | "list" | "result">("input");
  const [scrapingLogs, setScrapingLogs] = useState<string[]>([]);

  const loadPreviewCache = useCallback(async () => {
    if (!adminKey) return;
    try {
      const data: any = await fetchJson("/api/events/refresh/preview/cache", "GET", undefined, adminKey);
      if (data.success && data.events && data.events.length > 0) {
        setPreviewEvents(data.events);
        setSelectedApproveIds(new Set());
        setSelectedAnalyzeIds(new Set());
        setScrapingStep("list");
      }
    } catch (e) { /* ignore */ }
  }, [adminKey]);

  const updatePreviewCache = async (events: EventPreview[]) => {
    try {
      await fetchJson("/api/events/refresh/preview/cache", "PUT", { events }, adminKey);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if ((activeTab === "scraping" || activeTab === "pending") && keyVerified && previewEvents.length === 0 && !loadingPreview) {
      loadPreviewCache();
    }
  }, [activeTab, keyVerified, previewEvents.length, loadingPreview, loadPreviewCache]);

  // ── Published tab ──
  const [publishedEvents, setPublishedEvents] = useState<DbEvent[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);
  const [selectedPubIds, setSelectedPubIds] = useState<Set<number>>(new Set());
  const [selectedPubAnalyzeIds, setSelectedPubAnalyzeIds] = useState<Set<number>>(new Set());
  const [analyzingPublished, setAnalyzingPublished] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<any | null>(null);
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
    setSelectedApproveIds(new Set());
    setSelectedAnalyzeIds(new Set());
    setSelectedPubAnalyzeIds(new Set());
    setInspectingEvent(null);
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
      setSelectedPubAnalyzeIds(new Set());
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
      setSelectedApproveIds(new Set());
      setSelectedAnalyzeIds(new Set());
      updatePreviewCache(evs);
      setScrapingStep("list");
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApprove = async () => {
    if (selectedApproveIds.size === 0) {
      setError("Seleziona almeno un evento da approvare.");
      return;
    }
    const toApprove = Array.from(selectedApproveIds).map((i) => previewEvents[i]);
    setLoadingPreview(true);
    setError(null);
    try {
      const data: RefreshResult = await fetchJson("/api/events/approve", "POST", { events: toApprove }, adminKey);
      setApprovalResult(data);
      setScrapingStep("result");
      updatePreviewCache([]);
      loadPublished(appliedFilters);
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAnalyzePreview = async () => {
    if (selectedAnalyzeIds.size === 0) {
      setError("Seleziona almeno un evento per l'analisi locandina.");
      return;
    }
    const toAnalyze = Array.from(selectedAnalyzeIds).map(i => ({ ...previewEvents[i], idx: i }))
      .filter((ev) => !ev.testo_estratto);

    if (toAnalyze.length === 0) {
      setError("Seleziona almeno un evento non ancora analizzato.");
      return;
    }

    setAnalyzingPreview(true);
    setError(null);
    try {
      const payload = toAnalyze.map((ev) => ({
        tmp_id: ev.idx.toString(),
        titolo: ev.titolo,
        descrizione: ev.descrizione,
        immagine: ev.immagine,
      }));

      const data = await fetchJson<any>("/api/events/analyze", "POST", { events: payload }, adminKey);
      if (data.success) {
        setPreviewEvents((prev) => {
          const next = [...prev];
          for (const res of data.results) {
            if (!res.error && res.tmp_id != null) {
              const idx = parseInt(res.tmp_id, 10);
              next[idx] = {
                ...next[idx],
                testo_estratto: res.testo_estratto,
                is_festival: res.is_festival,
                sotto_eventi: res.sotto_eventi
              };
            }
          }
          updatePreviewCache(next);
          return next;
        });
        setSelectedAnalyzeIds(new Set());
        alert(`Analisi completata: ${data.messaggio}`);
      }
    } catch (e) {
      setError(`Errore analisi: ${String(e)}`);
    } finally {
      setAnalyzingPreview(false);
    }
  };

  const deletePreviewEvent = (idx: number) => {
    const next = previewEvents.filter((_, i) => i !== idx);
    setPreviewEvents(next);
    setSelectedApproveIds(new Set());
    setSelectedAnalyzeIds(new Set());
    updatePreviewCache(next);
  };

  const toggleApproveAll = (checked: boolean) => {
    if (checked) setSelectedApproveIds(new Set(previewEvents.map((_, i) => i)));
    else setSelectedApproveIds(new Set());
  };
  const toggleApproveOne = (idx: number, checked: boolean) => {
    const next = new Set(selectedApproveIds);
    if (checked) next.add(idx);
    else next.delete(idx);
    setSelectedApproveIds(next);
  };

  const toggleAnalyzeAll = (checked: boolean) => {
    if (checked) setSelectedAnalyzeIds(new Set(previewEvents.map((_, i) => i)));
    else setSelectedAnalyzeIds(new Set());
  };
  const toggleAnalyzeOne = (idx: number, checked: boolean) => {
    const next = new Set(selectedAnalyzeIds);
    if (checked) {
       next.add(idx);
       const nextApprove = new Set(selectedApproveIds);
       nextApprove.add(idx);
       setSelectedApproveIds(nextApprove);
    } else {
       next.delete(idx);
    }
    setSelectedAnalyzeIds(next);
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
    setSelectedPubAnalyzeIds(new Set());
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

  const togglePubAnalyzeAll = (checked: boolean) => {
    if (checked) setSelectedPubAnalyzeIds(new Set(publishedEvents.map((e) => e.id)));
    else setSelectedPubAnalyzeIds(new Set());
    setInspectingEvent(null);
  };
  const togglePubAnalyzeOne = (id: number, checked: boolean) => {
    const next = new Set(selectedPubAnalyzeIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedPubAnalyzeIds(next);
  };

  const handleAnalyzePublished = async () => {
    if (selectedPubAnalyzeIds.size === 0) {
      setError("Seleziona almeno un evento pubblicato per l'analisi locandina.");
      return;
    }
    const toAnalyze = publishedEvents.filter(ev => selectedPubAnalyzeIds.has(ev.id));
    setAnalyzingPublished(true);
    setError(null);
    try {
      const payload = toAnalyze.map((ev) => ({
        id: ev.id,
        titolo: ev.titolo,
        descrizione: ev.descrizione,
        immagine: ev.immagine,
      }));
      const data = await fetchJson<any>("/api/events/analyze", "POST", { events: payload }, adminKey);
      if (data.success) {
        setSelectedPubAnalyzeIds(new Set());
        alert(`Analisi completata: ${data.messaggio}`);
        loadPublished(appliedFilters);
      }
    } catch (e) {
      setError(`Errore analisi pubblicati: ${String(e)}`);
    } finally {
      setAnalyzingPublished(false);
    }
  };

  const openEventDetails = (ev: any, isPending: boolean) => {
    let subEvents: any[] = [];
    if (isPending) {
      subEvents = ev.sotto_eventi || [];
    } else {
      subEvents = publishedEvents
        .filter((child) => child.parent_id === ev.id)
        .map((child) => ({
          titolo: child.titolo.replace(`${ev.titolo} - `, ""),
          data_inizio: child.data_inizio,
          data_fine: child.data_fine,
          luogo: child.luogo,
        }));
    }
    setInspectingEvent({
      ...ev,
      is_pending: isPending,
      sub_events_list: subEvents,
    });
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
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="scraping">
              <Eye className="w-4 h-4 mr-1" /> Scraping
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="w-4 h-4 mr-1" /> In Attesa
            </TabsTrigger>
            <TabsTrigger value="published">
              <Database className="w-4 h-4 mr-1" /> Pubblicati
            </TabsTrigger>
            <TabsTrigger value="analyzed">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Analizzati
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
          </TabsContent>

          {/* ── PENDING TAB ── */}
          <TabsContent value="pending" className="mt-4">
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
                          checked={selectedApproveIds.size === previewEvents.length && previewEvents.length > 0}
                          onCheckedChange={(v) => toggleApproveAll(v === true)}
                          id="approve-all"
                        />
                        <Label htmlFor="approve-all" className="text-sm font-medium">Seleziona tutti (Pubblicazione)</Label>
                        <div className="mx-2 border-l h-4 border-border"></div>
                        <Checkbox
                          checked={selectedAnalyzeIds.size === previewEvents.length && previewEvents.length > 0}
                          onCheckedChange={(v) => toggleAnalyzeAll(v === true)}
                          id="analyze-all"
                        />
                        <Label htmlFor="analyze-all" className="text-sm font-medium">Seleziona tutti (Analisi)</Label>
                      </div>

                      <div className="border border-border rounded-md overflow-hidden relative z-0">
                        <ScrollArea className="h-[400px]">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted text-muted-foreground sticky top-0 z-20">
                              <tr>
                                <th className="px-4 py-3 w-10">Pubblica</th>
                                <th className="px-4 py-3 w-10">Analizza</th>
                                <th className="px-4 py-3">Titolo</th>
                                <th className="px-4 py-3">Data</th>
                                <th className="px-4 py-3">Fonte</th>
                                <th className="px-4 py-3 text-right">Azioni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewEvents.map((ev, i) => (
                                <tr key={i} className="border-b border-border hover:bg-muted/50">
                                  <td className="px-4 py-3">
                                    <Checkbox
                                      checked={selectedApproveIds.has(i)}
                                      onCheckedChange={(v) => toggleApproveOne(i, v === true)}
                                      aria-label={`Approva ${ev.titolo}`}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Checkbox
                                      checked={selectedAnalyzeIds.has(i)}
                                      onCheckedChange={(v) => toggleAnalyzeOne(i, v === true)}
                                      aria-label={`Analizza ${ev.titolo}`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-medium">
                                    {ev.titolo}
                                    {ev.is_new && <Badge variant="default" className="ml-2 bg-blue-600 text-white">Nuovo</Badge>}
                                    {ev.testo_estratto && <Badge variant="outline" className="ml-2 border-green-500 text-green-500">Analizzato</Badge>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {ev.data_inizio ? new Date(ev.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant="outline" className="bg-background">{ev.fonte}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button variant="ghost" size="icon" onClick={() => deletePreviewEvent(i)} title="Cestina evento">
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </ScrollArea>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setScrapingStep("input")}>Annulla</Button>
                        <Button
                          variant="secondary"
                          onClick={handleAnalyzePreview}
                          disabled={analyzingPreview || selectedAnalyzeIds.size === 0}
                        >
                          {analyzingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Analizza Locandine ({selectedAnalyzeIds.size})
                        </Button>
                        <Button
                          onClick={handleApprove}
                          disabled={loadingPreview || selectedApproveIds.size === 0}
                        >
                          {loadingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Approva Eventi ({selectedApproveIds.size})
                        </Button>
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
                  <Button variant="outline" className="mt-2 text-foreground" onClick={() => setScrapingStep("input")}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Nuovo preview
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ANALYZED TAB ── */}
          <TabsContent value="analyzed" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Eventi Analizzati</CardTitle>
                <CardDescription>
                  Visualizza tutti gli eventi che hanno una locandina analizzata e le relative informazioni estratte.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-xs font-semibold">Stato</th>
                        <th className="p-2 text-left text-xs font-semibold">Immagine</th>
                        <th className="p-2 text-left text-xs font-semibold">Titolo</th>
                        <th className="p-2 text-left text-xs font-semibold">Data</th>
                        <th className="p-2 text-left text-xs font-semibold">Fonte</th>
                        <th className="p-2 text-left text-xs font-semibold">Sotto-eventi</th>
                        <th className="p-2 text-left text-xs font-semibold">Azione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const analyzedPreview = previewEvents
                          .filter((ev) => (ev as any).testo_estratto)
                          .map((ev) => ({ ...ev, is_pending: true, id_key: `prev-${ev.titolo}` }));
                        const analyzedPublished = publishedEvents
                          .filter((ev) => (ev as any).testo_estratto)
                          .map((ev) => ({ ...ev, is_pending: false, id_key: `pub-${ev.id}` }));
                        const allAnalyzed = [...analyzedPreview, ...analyzedPublished];

                        if (allAnalyzed.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                Nessun evento analizzato trovato.
                              </td>
                            </tr>
                          );
                        }

                        return allAnalyzed.map((ev: any) => {
                          const img = imageUrl(ev);
                          const subCount = ev.is_pending
                            ? (ev.sotto_eventi?.length || 0)
                            : publishedEvents.filter((child) => child.parent_id === ev.id).length;

                          return (
                            <tr key={ev.id_key} className="border-t border-border hover:bg-muted/40">
                              <td className="p-2">
                                <Badge variant={ev.is_pending ? "secondary" : "default"} className={ev.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}>
                                  {ev.is_pending ? "In Attesa" : "Pubblicato"}
                                </Badge>
                              </td>
                              <td className="p-2">
                                {img ? (
                                  <img src={img} alt={ev.titolo} className="w-16 h-12 object-cover rounded border" loading="lazy" />
                                ) : (
                                  <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                                )}
                              </td>
                              <td className="p-2 font-medium max-w-xs truncate">
                                {ev.titolo}
                              </td>
                              <td className="p-2 text-muted-foreground whitespace-nowrap">
                                {ev.data_inizio ? new Date(ev.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                              </td>
                              <td className="p-2">
                                <Badge variant="outline">{ev.fonte}</Badge>
                              </td>
                              <td className="p-2">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                                  {subCount} sotto-eventi
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Button variant="outline" size="sm" onClick={() => openEventDetails(ev, ev.is_pending)}>
                                  <Eye className="w-4 h-4 mr-1" /> Dettagli
                                </Button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
                {(selectedPubIds.size > 0 || selectedPubAnalyzeIds.size > 0) && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    {selectedPubIds.size > 0 && (
                      <span className="text-sm font-medium">{selectedPubIds.size} da eliminare</span>
                    )}
                    {selectedPubAnalyzeIds.size > 0 && (
                      <span className="text-sm font-medium ml-4">{selectedPubAnalyzeIds.size} da analizzare</span>
                    )}
                    <div className="flex-1"></div>
                    {selectedPubAnalyzeIds.size > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAnalyzePublished}
                        disabled={analyzingPublished}
                      >
                        {analyzingPublished && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Analizza Locandine ({selectedPubAnalyzeIds.size})
                      </Button>
                    )}
                    {selectedPubIds.size > 0 && (
                      <>
                        <Button variant="destructive" size="sm" onClick={() => bulkDelete(false)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Elimina
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => bulkDelete(true)}>
                          <AlertTriangle className="w-4 h-4 mr-1" /> Elimina e scarta
                        </Button>
                      </>
                    )}
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
                        <th className="w-10 p-2">
                          <Checkbox
                            checked={publishedEvents.length > 0 && selectedPubAnalyzeIds.size === publishedEvents.length}
                            onCheckedChange={(v) => togglePubAnalyzeAll(v === true)}
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
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
                                <Checkbox
                                  checked={selectedPubAnalyzeIds.has(ev.id)}
                                  onCheckedChange={(v) => togglePubAnalyzeOne(ev.id, v === true)}
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
                                {ev.testo_estratto && <Badge variant="outline" className="ml-2 border-green-500 text-green-500">Analizzato</Badge>}
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

        {/* Detail Modal */}
        {inspectingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inspectingEvent.is_pending ? "secondary" : "default"} className={inspectingEvent.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}>
                        {inspectingEvent.is_pending ? "In Attesa" : "Pubblicato"}
                      </Badge>
                      <Badge variant="outline">{inspectingEvent.fonte}</Badge>
                    </div>
                    <CardTitle className="text-lg font-bold mt-1">{inspectingEvent.titolo}</CardTitle>
                    <CardDescription>
                      {inspectingEvent.data_inizio ? new Date(inspectingEvent.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                      {inspectingEvent.data_fine && inspectingEvent.data_fine !== inspectingEvent.data_inizio ? ` - ${new Date(inspectingEvent.data_fine).toLocaleDateString("it-IT")}` : ""}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => setInspectingEvent(null)} className="h-8 w-8 p-0">
                    <XCircle className="w-6 h-6 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Image & Description */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {imageUrl(inspectingEvent) && (
                    <img
                      src={imageUrl(inspectingEvent)!}
                      alt={inspectingEvent.titolo}
                      className="w-full sm:w-48 h-36 object-cover rounded-md border"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrizione Originale</h4>
                    <p className="text-sm text-foreground line-clamp-6">{inspectingEvent.descrizione || "Nessuna descrizione fornita."}</p>
                  </div>
                </div>

                {/* Extracted Text */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Testo Estratto dalla Locandina</h4>
                  <div className="bg-muted p-4 rounded-md font-mono text-xs max-h-48 overflow-y-auto border whitespace-pre-wrap">
                    {inspectingEvent.testo_estratto || "Nessun testo estratto."}
                  </div>
                </div>

                {/* Sub-events (Sotto-eventi) */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Sotto-eventi Rilevati ({inspectingEvent.sub_events_list?.length || 0})
                  </h4>
                  {inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {inspectingEvent.sub_events_list.map((se: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/40 rounded-lg border border-border/50 text-sm">
                          <div className="font-semibold text-foreground">{se.titolo}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {se.data_inizio ? new Date(se.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                              {se.data_fine && se.data_fine !== se.data_inizio ? ` - ${new Date(se.data_fine).toLocaleDateString("it-IT")}` : ""}
                            </span>
                            {se.luogo && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {se.luogo}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nessun sotto-evento rilevato o inserito.</p>
                  )}
                </div>
              </CardContent>
              
              <div className="p-4 border-t border-border flex justify-end">
                <Button onClick={() => setInspectingEvent(null)}>Chiudi</Button>
              </div>
            </Card>
          </div>
        )}

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
