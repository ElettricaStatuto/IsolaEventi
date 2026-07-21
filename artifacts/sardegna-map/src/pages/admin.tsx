import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Info, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Eye, Database,
  Trash2, RotateCcw, AlertTriangle, Calendar, MapPin, Globe, Search, RefreshCw, Clock, Terminal, Upload, BarChart3, Brain
} from "lucide-react";
import { AdminStats } from "@/components/admin-stats";

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
  link_organizzatore?: string | null;
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
  linkOrganizzatore?: string | null;
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

const AutoResizeTextarea = ({ value, onChange, className, ...props }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        resize();
      }}
      className={className}
      rows={1}
      style={{ overflow: "hidden", resize: "none" }}
      {...props}
    />
  );
};

function ButtonLegendGuide() {
  return (
    <div className="bg-muted/30 border border-border/80 rounded-lg p-3 text-xs text-muted-foreground flex flex-col gap-2">
      <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
        <Info className="w-3.5 h-3.5 text-blue-500" /> Legenda Guida Pulsanti e Azioni
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px]"><Eye className="w-3 h-3 mr-1" /> Dettagli</Badge>
          <span className="text-[11px]">Mostra la scheda completa dell'evento e i sotto-eventi.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="secondary" className="shrink-0 text-[10px]"><Brain className="w-3 h-3 mr-1" /> Analizza</Badge>
          <span className="text-[11px]">Esegue l'estrazione AI su locandina/testo.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge className="shrink-0 text-[10px] bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Pubblica</Badge>
          <span className="text-[11px]">Approva e rende visibile l'evento sulla mappa.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="destructive" className="shrink-0 text-[10px]"><Trash2 className="w-3 h-3 mr-1" /> Elimina</Badge>
          <span className="text-[11px]">Rimuove l'evento consentendo scansioni future.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="destructive" className="shrink-0 text-[10px] bg-orange-600 border-none"><AlertTriangle className="w-3 h-3 mr-1" /> Scarta</Badge>
          <span className="text-[11px]">Elimina e blocca l'evento in Blacklist.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px]"><RotateCcw className="w-3 h-3 mr-1" /> Ripristina</Badge>
          <span className="text-[11px]">Rimuove l'evento dalla Blacklist.</span>
        </div>
      </div>
    </div>
  );
}

export function Admin() {
  const [adminKey, setAdminKey] = useState("bypass");
  const [keyVerified, setKeyVerified] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scraping");
  const [analysisTarget, setAnalysisTarget] = useState<"both" | "both_source" | "image" | "text" | "source_page">("both");
  const [aiProvider, setAiProvider] = useState<"direct" | "replit">("direct");
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "paradisola",
    "sardegnaturismo",
    "timeinjazz",
    "eventiinsardegna_calendar",
    "eventiinsardegna_alghero",
    "eventiinsardegna_cagliari",
    "eventiinsardegna_centro",
    "eventiinsardegna_agosto"
  ]);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [analyzingStep, setAnalyzingStep] = useState<"idle" | "preview" | "published">("idle");
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef<boolean>(false);

  // ── Scraping tab ──
  const [previewEvents, setPreviewEvents] = useState<EventPreview[]>([]);
  const [selectedApproveIds, setSelectedApproveIds] = useState<Set<number>>(new Set());
  const [selectedAnalyzeIds, setSelectedAnalyzeIds] = useState<Set<number>>(new Set());
  const [analyzingPreview, setAnalyzingPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [approvalResult, setApprovalResult] = useState<RefreshResult | null>(null);
  const [scrapingStep, setScrapingStep] = useState<"input" | "list" | "result">("input");
  const [scrapingLogs, setScrapingLogs] = useState<string[]>([]);
  const [genericUrl, setGenericUrl] = useState("");
  const [scrapingGeneric, setScrapingGeneric] = useState(false);
  const [urlScrapedEvents, setUrlScrapedEvents] = useState<any[]>([]);
  const [maxLinksUrl, setMaxLinksUrl] = useState<number | "">("");
  const [forceFestival, setForceFestival] = useState<boolean>(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [anFilterTitolo, setAnFilterTitolo] = useState("");
  const [anFilterFonte, setAnFilterFonte] = useState("");
  const [anFilterDataFrom, setAnFilterDataFrom] = useState("");
  const [anFilterDataTo, setAnFilterDataTo] = useState("");
  const [appliedAnFilters, setAppliedAnFilters] = useState({ titolo: "", fonte: "", dataFrom: "", dataTo: "" });
  const [selectedAnIds, setSelectedAnIds] = useState<Set<string>>(new Set());

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
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingDettagli, setEditingDettagli] = useState<Record<string, string>>({});
  const [newDettaglioKey, setNewDettaglioKey] = useState("");
  const [newDettaglioValue, setNewDettaglioValue] = useState("");
  const [newTagValue, setNewTagValue] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
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
        },
        body: JSON.stringify({ sources: selectedSources })
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
      setActiveTab("pending");
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleScrapeUrl = async () => {
    if (!keyVerified && !(await verifyKey())) return;
    if (!genericUrl.trim()) return;
    setError(null);
    setScrapingGeneric(true);
    setScrapingLogs([]);
    setUrlScrapedEvents([]);
    try {
      const resp: any = await fetchJson("/api/events/scrape-url", "POST", { 
        url: genericUrl.trim(),
        maxLinks: maxLinksUrl === "" ? 70 : maxLinksUrl,
        forceFestival
      }, adminKey);
      if (resp.success && resp.events) {
        const firstEv = resp.events[0];
        if (firstEv && firstEv.dettagli_extra && firstEv.dettagli_extra._usage) {
          const u = firstEv.dettagli_extra._usage;
          setScrapingLogs([`✅ Completato! ⚡ Token AI: ${u.total_tokens} (Prompt: ${u.prompt_tokens}, Risp: ${u.candidates_tokens})`]);
        } else {
          setScrapingLogs(["✅ Completato con successo!"]);
        }
        setUrlScrapedEvents(resp.events);
        setPreviewEvents(prev => {
          const next = [...prev, ...resp.events];
          updatePreviewCache(next);
          return next;
        });
      } else {
        setError(resp.message || "Errore durante lo scraping dell'URL");
      }
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setScrapingGeneric(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!keyVerified && !(await verifyKey())) return;
    if (!pdfFile) return;
    setError(null);
    setUploadingPdf(true);
    setScrapingLogs(["Caricamento PDF in corso..."]);
    
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);

      const resp = await fetch("/api/events/upload-pdf", {
        method: "POST",
        headers: {
          "x-admin-key": adminKey.trim()
        },
        body: formData
      });
      
      const data = await resp.json();

      if (data.success && data.events) {
        setPreviewEvents(prev => {
          const next = [...prev, ...data.events];
          updatePreviewCache(next);
          return next;
        });
        setPdfFile(null);
        setScrapingStep("list");
        setActiveTab("pending");
      } else {
        setError(data.message || "Errore durante l'elaborazione del PDF");
      }
    } catch (e) {
      setError(`Errore di rete: ${String(e)}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  const applyAnFilters = () => {
    setAppliedAnFilters({
      titolo: anFilterTitolo,
      fonte: anFilterFonte,
      dataFrom: anFilterDataFrom,
      dataTo: anFilterDataTo,
    });
  };

  const clearAnFilters = () => {
    setAnFilterTitolo("");
    setAnFilterFonte("");
    setAnFilterDataFrom("");
    setAnFilterDataTo("");
    setAppliedAnFilters({ titolo: "", fonte: "", dataFrom: "", dataTo: "" });
  };

  const handlePublishAnalyzed = async (toPublish: any[]) => {
    if (toPublish.length === 0) return;
    setError(null);
    try {
      await fetchJson("/api/events/approve", "POST", { events: toPublish }, adminKey);
      const toPublishTitles = new Set(toPublish.map(e => e.titolo));
      const nextPreviews = previewEvents.filter(ev => !toPublishTitles.has(ev.titolo));
      setPreviewEvents(nextPreviews);
      updatePreviewCache(nextPreviews);
      setSelectedAnIds(new Set());
      loadPublished(appliedFilters);
    } catch (e) {
      setError(`Errore pubblicazione: ${String(e)}`);
    }
  };

  const handleAnBulkPubblica = async () => {
    if (selectedAnIds.size === 0) return;
    const prevIndices: number[] = [];
    for (const idKey of selectedAnIds) {
      if (idKey.startsWith("prev-")) {
        prevIndices.push(parseInt(idKey.replace("prev-", ""), 10));
      }
    }
    const toPublish = prevIndices.map(i => previewEvents[i]).filter(Boolean);
    if (toPublish.length === 0) return;
    if (!window.confirm(`Pubblicare ${toPublish.length} eventi selezionati?`)) return;
    await handlePublishAnalyzed(toPublish);
  };

  const handleAnPublishAllFiltered = async () => {
    const analyzedPreview = previewEvents
      .map((ev, i) => ({ ...ev, original_idx: i }))
      .filter((ev) => (ev as any).testo_estratto)
      .map((ev) => ({ ...ev, is_pending: true, id_key: `prev-${ev.original_idx}` }));
      
    const filteredPending = analyzedPreview.filter(ev => {
      if (appliedAnFilters.titolo && !ev.titolo?.toLowerCase().includes(appliedAnFilters.titolo.toLowerCase())) return false;
      if (appliedAnFilters.fonte && !ev.fonte?.toLowerCase().includes(appliedAnFilters.fonte.toLowerCase())) return false;
      if (appliedAnFilters.dataFrom && ev.data_inizio && ev.data_inizio < appliedAnFilters.dataFrom) return false;
      if (appliedAnFilters.dataTo && ev.data_inizio && ev.data_inizio > appliedAnFilters.dataTo) return false;
      return true;
    });

    if (filteredPending.length === 0) {
      setError("Nessun evento analizzato corrisponde ai filtri impostati.");
      return;
    }

    if (!window.confirm(`Pubblicare TUTTI i ${filteredPending.length} eventi analizzati filtrati?`)) return;
    await handlePublishAnalyzed(filteredPending);
  };

  const handleAnBulkAnalyze = async () => {
    if (selectedAnIds.size === 0) return;
    const toAnalyze: any[] = [];
    for (const idKey of selectedAnIds) {
      if (idKey.startsWith("prev-")) {
        const idx = parseInt(idKey.replace("prev-", ""), 10);
        if (previewEvents[idx]) toAnalyze.push({ ...previewEvents[idx], original_idx: idx, is_pending: true });
      } else if (idKey.startsWith("pub-")) {
        const id = parseInt(idKey.replace("pub-", ""), 10);
        const ev = publishedEvents.find(e => e.id === id);
        if (ev) toAnalyze.push({ ...ev, is_pending: false });
      }
    }
    if (toAnalyze.length === 0) return;
    if (!window.confirm(`Analizzare i ${toAnalyze.length} eventi selezionati?`)) return;
    await handleAnalyzeEventsMixed(toAnalyze);
    setSelectedAnIds(new Set());
  };

  const handleAnBulkElimina = async (recordRejected: boolean = false) => {
    if (selectedAnIds.size === 0) return;
    const msg = recordRejected
      ? `Eliminare e mettere in BLACKLIST i ${selectedAnIds.size} eventi selezionati?`
      : `Eliminare i ${selectedAnIds.size} eventi selezionati?`;
    if (!window.confirm(msg)) return;

    setError(null);
    let success = 0;
    let failed = 0;

    for (const idKey of selectedAnIds) {
      try {
        if (idKey.startsWith("prev-")) {
          // Delete from preview
          const title = idKey.replace("prev-", "");
          const next = previewEvents.filter(e => e.titolo !== title);
          setPreviewEvents(next);
          updatePreviewCache(next);
        } else if (idKey.startsWith("pub-")) {
          // Delete from DB
          const id = parseInt(idKey.replace("pub-", ""), 10);
          await fetchJson(`/api/events/${id}`, "DELETE", { record_rejected: recordRejected }, adminKey);
        }
        success++;
      } catch {
        failed++;
      }
    }

    loadPublished(appliedFilters);
    if (recordRejected) refreshRejected();
    setSelectedAnIds(new Set());
    if (failed > 0) setError(`${failed} eliminazioni fallite su ${selectedAnIds.size}`);
  };

  const handleAnDeleteAllFiltered = async (recordRejected: boolean = false) => {
    const analyzedPreview = previewEvents
      .map((ev, i) => ({ ...ev, original_idx: i, is_pending: true, id_key: `prev-${ev.titolo}` }))
      .filter((ev) => (ev as any).testo_estratto);
    const analyzedPublished = publishedEvents
      .map((ev) => ({ ...ev, is_pending: false, id_key: `pub-${ev.id}` }))
      .filter((ev) => (ev as any).testo_estratto);
      
    const filteredAnalyzed = [...analyzedPreview, ...analyzedPublished].filter(ev => {
      if (appliedAnFilters.titolo && !ev.titolo?.toLowerCase().includes(appliedAnFilters.titolo.toLowerCase())) return false;
      if (appliedAnFilters.fonte && !ev.fonte?.toLowerCase().includes(appliedAnFilters.fonte.toLowerCase())) return false;
      if (appliedAnFilters.dataFrom && ev.data_inizio && ev.data_inizio < appliedAnFilters.dataFrom) return false;
      if (appliedAnFilters.dataTo && ev.data_inizio && ev.data_inizio > appliedAnFilters.dataTo) return false;
      return true;
    });

    if (filteredAnalyzed.length === 0) {
      setError("Nessun evento analizzato corrisponde ai filtri impostati.");
      return;
    }

    const msg = recordRejected
      ? `Sei sicuro di voler eliminare E METTERE IN BLACKLIST i ${filteredAnalyzed.length} eventi analizzati visibili?`
      : `Sei sicuro di voler eliminare i ${filteredAnalyzed.length} eventi analizzati visibili?`;
    if (!window.confirm(msg)) return;

    setError(null);
    for (const ev of filteredAnalyzed) {
      try {
        if (ev.is_pending) {
          const next = previewEvents.filter(e => e.titolo !== ev.titolo);
          setPreviewEvents(next);
          updatePreviewCache(next);
        } else {
          await fetchJson(`/api/events/${ev.id}`, "DELETE", { record_rejected: recordRejected }, adminKey);
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadPublished(appliedFilters);
    if (recordRejected) refreshRejected();
    setSelectedAnIds(new Set());
  };

  const handleAnAnalyzeAllFiltered = async () => {
    const analyzedPreview = previewEvents
      .map((ev, i) => ({ ...ev, original_idx: i, is_pending: true }))
      .filter((ev) => (ev as any).testo_estratto);
    const analyzedPublished = publishedEvents
      .map((ev) => ({ ...ev, is_pending: false }))
      .filter((ev) => (ev as any).testo_estratto);
      
    const allAnalyzed = [...analyzedPreview, ...analyzedPublished].filter(ev => {
      if (appliedAnFilters.titolo && !ev.titolo?.toLowerCase().includes(appliedAnFilters.titolo.toLowerCase())) return false;
      if (appliedAnFilters.fonte && !ev.fonte?.toLowerCase().includes(appliedAnFilters.fonte.toLowerCase())) return false;
      if (appliedAnFilters.dataFrom && ev.data_inizio && ev.data_inizio < appliedAnFilters.dataFrom) return false;
      if (appliedAnFilters.dataTo && ev.data_inizio && ev.data_inizio > appliedAnFilters.dataTo) return false;
      return true;
    });

    if (allAnalyzed.length === 0) {
      setError("Nessun evento analizzato corrisponde ai filtri impostati.");
      return;
    }

    if (!window.confirm(`Rianalizzare TUTTI i ${allAnalyzed.length} eventi analizzati filtrati?`)) return;
    await handleAnalyzeEventsMixed(allAnalyzed);
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

    setAnalyzingStep("preview");
    setAnalysisLogs([]);
    setError(null);
    isAbortedRef.current = false;

    const total = toAnalyze.length;
    let nextEvents = [...previewEvents];
    let successi = 0;
    let erroriCount = 0;

    try {
      for (let i = 0; i < total; i++) {
        if (isAbortedRef.current) {
          setAnalysisLogs(prev => [...prev, "🚫 Analisi interrotta dall'utente."]);
          break;
        }

        const ev = toAnalyze[i];
        setAnalysisLogs(prev => [...prev, `[${i + 1}/${total}] Sto analizzando l'evento: '${ev.titolo}' (Target: ${analysisTarget})...`]);

        const payload = [{
          tmp_id: ev.idx.toString(),
          titolo: ev.titolo,
          descrizione: ev.descrizione,
          immagine: ev.immagine,
          link: ev.link,
        }];

        abortControllerRef.current = new AbortController();
        const response = await fetch("/api/events/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ events: payload, target: analysisTarget, use_proxy: aiProvider === "replit" }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error) errMsg = errData.error;
          } catch {}
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (data.success && data.results && data.results.length > 0) {
          const res = data.results[0];
          if (res.error) {
            erroriCount++;
            setAnalysisLogs(prev => [...prev, `❌ Errore: ${res.error}`]);
          } else {
            successi++;
            const idx = parseInt(res.tmp_id, 10);
            nextEvents[idx] = {
              ...nextEvents[idx],
              testo_estratto: res.testo_estratto,
              is_festival: res.is_festival,
              sotto_eventi: res.sotto_eventi,
              link_organizzatore: res.link_organizzatore,
            };
            setPreviewEvents([...nextEvents]);
            updatePreviewCache(nextEvents);
            setAnalysisLogs(prev => [...prev, `✅ Completato con successo!`]);
          }
        } else {
          erroriCount++;
          setAnalysisLogs(prev => [...prev, `❌ Errore durante l'analisi.`]);
        }
      }
      
      if (!isAbortedRef.current) {
        setSelectedAnalyzeIds(new Set());
        alert(`Analisi completata. ${successi} successi, ${erroriCount} errori.`);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Errore analisi: ${String(e.message || e)}`);
      }
    } finally {
      setAnalyzingStep("idle");
      abortControllerRef.current = null;
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

  const handleDeleteAllFiltered = () => {
    if (!window.confirm(`Sei sicuro di voler eliminare i ${filteredPreviewEvents.length} eventi visibili?`)) return;
    const indicesToDelete = new Set(filteredPreviewEvents.map(({ i }) => i));
    const next = previewEvents.filter((_, i) => !indicesToDelete.has(i));
    setPreviewEvents(next);
    updatePreviewCache(next);
    setSelectedApproveIds(new Set());
    setSelectedAnalyzeIds(new Set());
  };

  const handleApproveAllFiltered = () => {
    if (!window.confirm(`Sei sicuro di voler pubblicare i ${filteredPreviewEvents.length} eventi visibili?`)) return;
    const toApprove = filteredPreviewEvents.map(({ ev }) => ev);
    setLoadingPreview(true);
    setError(null);
    fetchJson("/api/events/approve", "POST", { events: toApprove }, adminKey)
      .then((data: RefreshResult) => {
        setApprovalResult(data);
        setScrapingStep("result");
        updatePreviewCache([]);
        loadPublished(appliedFilters);
      })
      .catch((e) => setError(`Errore di rete: ${String(e)}`))
      .finally(() => setLoadingPreview(false));
  };

  const handleAnalyzeAllFiltered = () => {
    if (!window.confirm(`Sei sicuro di voler analizzare i ${filteredPreviewEvents.length} eventi visibili?`)) return;
    const explicitIndices = filteredPreviewEvents.map(({ i }) => i);
    const toAnalyze = explicitIndices.map(i => ({ ...previewEvents[i], idx: i })).filter(ev => !ev.testo_estratto);
    if (toAnalyze.length === 0) {
      setError("Tutti gli eventi filtrati visibili sono già stati analizzati.");
      return;
    }
    const nextAnalyze = new Set(selectedAnalyzeIds);
    toAnalyze.forEach(ev => nextAnalyze.add(ev.idx));
    setSelectedAnalyzeIds(nextAnalyze);
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

  const handleAnalyzeAllPublishedFiltered = async () => {
    if (publishedEvents.length === 0) return;
    if (!window.confirm(`Analizzare TUTTI i ${publishedEvents.length} eventi pubblicati visibili?`)) return;
    await handleAnalyzeEventsMixed(publishedEvents.map(ev => ({ ...ev, is_pending: false })));
  };

  const handleDeleteAllPublishedFiltered = async (recordRejected: boolean) => {
    if (publishedEvents.length === 0) return;
    const msg = recordRejected 
      ? `Sei sicuro di voler eliminare E METTERE IN BLACKLIST TUTTI i ${publishedEvents.length} eventi pubblicati visibili?`
      : `Sei sicuro di voler eliminare TUTTI i ${publishedEvents.length} eventi pubblicati visibili?`;
    if (!window.confirm(msg)) return;
    setError(null);
    let success = 0;
    let failed = 0;
    for (const ev of publishedEvents) {
      try {
        await fetchJson(`/api/events/${ev.id}`, "DELETE", { record_rejected: recordRejected }, adminKey);
        success++;
      } catch {
        failed++;
      }
    }
    loadPublished(appliedFilters);
    if (recordRejected) refreshRejected();
    setSelectedPubIds(new Set());
    setSelectedPubAnalyzeIds(new Set());
    if (failed > 0) setError(`${failed} eliminazioni fallite su ${publishedEvents.length}`);
  };

  const handleAnalyzePublished = async () => {
    if (selectedPubAnalyzeIds.size === 0) {
      setError("Seleziona almeno un evento pubblicato per l'analisi.");
      return;
    }
    const toAnalyze = publishedEvents.filter(ev => selectedPubAnalyzeIds.has(ev.id));
    setAnalyzingStep("published");
    setAnalysisLogs([]);
    setError(null);
    isAbortedRef.current = false;

    const total = toAnalyze.length;
    let successi = 0;
    let erroriCount = 0;

    try {
      for (let i = 0; i < total; i++) {
        if (isAbortedRef.current) {
          setAnalysisLogs(prev => [...prev, "🚫 Analisi interrotta dall'utente."]);
          break;
        }

        const ev = toAnalyze[i];
        setAnalysisLogs(prev => [...prev, `[${i + 1}/${total}] Sto analizzando l'evento: '${ev.titolo}' (Target: ${analysisTarget})...`]);

        const payload = [{
          id: ev.id,
          titolo: ev.titolo,
          descrizione: ev.descrizione,
          immagine: ev.immagine,
          link: ev.link,
        }];

        abortControllerRef.current = new AbortController();
        const response = await fetch("/api/events/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ events: payload, target: analysisTarget, use_proxy: aiProvider === "replit" }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error) errMsg = errData.error;
          } catch {}
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (data.success && data.results && data.results.length > 0) {
          const res = data.results[0];
          if (res.error) {
            erroriCount++;
            setAnalysisLogs(prev => [...prev, `❌ Errore: ${res.error}`]);
          } else {
            successi++;
            setAnalysisLogs(prev => [...prev, `✅ Completato con successo!`]);
          }
        } else {
          erroriCount++;
          setAnalysisLogs(prev => [...prev, `❌ Errore durante l'analisi.`]);
        }
      }

      if (!isAbortedRef.current) {
        setSelectedPubAnalyzeIds(new Set());
        alert(`Analisi completata. ${successi} successi, ${erroriCount} errori.`);
        loadPublished(appliedFilters);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Errore analisi pubblicati: ${String(e.message || e)}`);
      }
    } finally {
      setAnalyzingStep("idle");
      abortControllerRef.current = null;
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
    setIsEditingEvent(false);
    setEditingTags(ev.tags || []);
    setEditingDettagli(ev.dettagli_extra || {});
    setNewDettaglioKey("");
    setNewDettaglioValue("");
    setNewTagValue("");
  };

  const handleSaveEventDetails = async () => {
    if (!inspectingEvent) return;
    setSavingEvent(true);
    setError(null);
    try {
      if (inspectingEvent.is_pending) {
        // Se è in attesa (preview), aggiorniamo solo la cache locale
        const nextEvents = [...previewEvents];
        const idxStr = inspectingEvent.tmp_id;
        const idx = typeof inspectingEvent.idx === 'number' ? inspectingEvent.idx : parseInt(idxStr, 10);
        if (!isNaN(idx) && nextEvents[idx]) {
          nextEvents[idx] = {
            ...nextEvents[idx],
            tags: editingTags,
            dettagli_extra: editingDettagli,
          };
          setPreviewEvents(nextEvents);
          updatePreviewCache(nextEvents);
          setInspectingEvent({ ...inspectingEvent, tags: editingTags, dettagli_extra: editingDettagli });
          setIsEditingEvent(false);
        } else {
          throw new Error("Evento non trovato in preview");
        }
      } else {
        // Se è pubblicato, inviamo PUT
        const payload = { ...inspectingEvent, tags: editingTags, dettagli_extra: editingDettagli };
        await fetchJson(`/api/events/${inspectingEvent.id}`, "PUT", payload, adminKey);
        loadPublished(appliedFilters);
        setInspectingEvent({ ...inspectingEvent, tags: editingTags, dettagli_extra: editingDettagli });
        setIsEditingEvent(false);
      }
    } catch (e) {
      setError(`Errore salvataggio: ${String(e)}`);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleAnalyzeSingleFromModal = async () => {
    if (!inspectingEvent) return;
    setAnalyzingStep(inspectingEvent.is_pending ? "preview" : "published");
    setAnalysisLogs([]);
    setError(null);
    isAbortedRef.current = false;

    try {
      setAnalysisLogs([`Sto analizzando l'evento: '${inspectingEvent.titolo}' (Target: ${analysisTarget})...`]);

      const tmpId = inspectingEvent.is_pending 
        ? (inspectingEvent.tmp_id || (typeof inspectingEvent.idx === 'number' ? inspectingEvent.idx.toString() : "0"))
        : undefined;

      const payload = [{
        tmp_id: tmpId,
        id: inspectingEvent.is_pending ? undefined : inspectingEvent.id,
        titolo: inspectingEvent.titolo,
        descrizione: inspectingEvent.descrizione,
        immagine: inspectingEvent.immagine,
        link: inspectingEvent.link,
      }];

      abortControllerRef.current = new AbortController();
      const response = await fetch("/api/events/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ events: payload, target: analysisTarget, use_proxy: aiProvider === "replit" }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const errData = await response.json(); if (errData?.error) errMsg = errData.error; } catch {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.success && data.results && data.results.length > 0) {
        const res = data.results[0];
        if (res.error) {
          setAnalysisLogs(prev => [...prev, `❌ Errore: ${res.error}`]);
        } else {
          setAnalysisLogs(prev => [...prev, `✅ Completato con successo!`]);
          
          const updatedEvent = {
            ...inspectingEvent,
            testo_estratto: res.testo_estratto,
            is_festival: res.is_festival,
            sub_events_list: res.sotto_eventi || inspectingEvent.sub_events_list,
            link_organizzatore: res.link_organizzatore,
            tags: res.tags,
            dettagli_extra: res.dettagli_extra,
          };
          setInspectingEvent(updatedEvent);
          setEditingTags(res.tags || []);
          setEditingDettagli(res.dettagli_extra || {});
          
          if (inspectingEvent.is_pending) {
            const nextEvents = [...previewEvents];
            const idx = parseInt(tmpId!, 10);
            if (!isNaN(idx) && nextEvents[idx]) {
               nextEvents[idx] = { ...nextEvents[idx], ...updatedEvent };
               setPreviewEvents(nextEvents);
               updatePreviewCache(nextEvents);
            }
          } else {
            loadPublished(appliedFilters);
          }
        }
      } else {
         setAnalysisLogs(prev => [...prev, `❌ Errore durante l'analisi.`]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Errore analisi: ${String(e.message || e)}`);
      }
    } finally {
      setAnalyzingStep("idle");
      abortControllerRef.current = null;
    }
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
          <TabsList className="grid w-full grid-cols-6 max-w-4xl">
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
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-1" /> Statistiche
            </TabsTrigger>
          </TabsList>

          {/* ── SCRAPING TAB ── */}
          <TabsContent value="scraping" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preview eventi</CardTitle>
                <CardDescription>
                  Avvia lo scraper per recuperare eventi dai siti fonte. Potrai vedere l'anteprima, selezionare quelli da pubblicare e approvarli.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                 <div className="flex flex-col gap-3 border border-border rounded-md p-4 bg-muted/40 max-w-3xl">
                   <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fonti da scansionare</span>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">

                     {/* ── COLONNA SINISTRA: EVENTI GENERALI ── */}
                     <div className="flex flex-col gap-3">
                       <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">📅 Eventi Generali</span>

                       <div className="flex items-center gap-2">
                         <Checkbox id="src-paradisola" checked={selectedSources.includes("paradisola")}
                           onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "paradisola"] : prev.filter(x => x !== "paradisola"))} />
                         <Label htmlFor="src-paradisola" className="text-sm font-medium cursor-pointer">Paradisola (paradisola.it)</Label>
                       </div>

                       <div className="flex items-center gap-2">
                         <Checkbox id="src-sardegnaturismo" checked={selectedSources.includes("sardegnaturismo")}
                           onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "sardegnaturismo"] : prev.filter(x => x !== "sardegnaturismo"))} />
                         <Label htmlFor="src-sardegnaturismo" className="text-sm font-medium cursor-pointer">Sardegna Turismo (sardegnaturismo.it)</Label>
                       </div>

                       <div className="flex flex-col gap-2 mt-1">
                         <span className="text-xs font-bold text-foreground">EventiInSardegna.it</span>
                         <div className="flex flex-col gap-2 pl-3">
                           <div className="flex items-center gap-2">
                             <Checkbox id="src-eis-calendar" checked={selectedSources.includes("eventiinsardegna_calendar")}
                               onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "eventiinsardegna_calendar"] : prev.filter(x => x !== "eventiinsardegna_calendar"))} />
                             <Label htmlFor="src-eis-calendar" className="text-sm font-normal cursor-pointer text-muted-foreground">Calendario Generale</Label>
                           </div>
                           <div className="flex items-center gap-2">
                             <Checkbox id="src-eis-alghero" checked={selectedSources.includes("eventiinsardegna_alghero")}
                               onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "eventiinsardegna_alghero"] : prev.filter(x => x !== "eventiinsardegna_alghero"))} />
                             <Label htmlFor="src-eis-alghero" className="text-sm font-normal cursor-pointer text-muted-foreground">Tag: Alghero</Label>
                           </div>
                           <div className="flex items-center gap-2">
                             <Checkbox id="src-eis-cagliari" checked={selectedSources.includes("eventiinsardegna_cagliari")}
                               onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "eventiinsardegna_cagliari"] : prev.filter(x => x !== "eventiinsardegna_cagliari"))} />
                             <Label htmlFor="src-eis-cagliari" className="text-sm font-normal cursor-pointer text-muted-foreground">Tag: Cagliari</Label>
                           </div>
                           <div className="flex items-center gap-2">
                             <Checkbox id="src-eis-centro" checked={selectedSources.includes("eventiinsardegna_centro")}
                               onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "eventiinsardegna_centro"] : prev.filter(x => x !== "eventiinsardegna_centro"))} />
                             <Label htmlFor="src-eis-centro" className="text-sm font-normal cursor-pointer text-muted-foreground">Tag: Centro Sardegna</Label>
                           </div>
                           <div className="flex items-center gap-2">
                             <Checkbox id="src-eis-agosto" checked={selectedSources.includes("eventiinsardegna_agosto")}
                               onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "eventiinsardegna_agosto"] : prev.filter(x => x !== "eventiinsardegna_agosto"))} />
                             <Label htmlFor="src-eis-agosto" className="text-sm font-normal cursor-pointer text-muted-foreground">Categoria: Agosto</Label>
                           </div>
                         </div>
                       </div>
                     </div>

                     {/* ── COLONNA DESTRA: FESTIVAL ── */}
                     <div className="flex flex-col gap-3">
                       <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">🎪 Festival</span>
                       <p className="text-xs text-muted-foreground -mt-1">Gli eventi estratti da questi siti vengono raggruppati automaticamente come concerti figli del festival.</p>

                       <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md p-3">
                         <Checkbox id="src-timeinjazz" checked={selectedSources.includes("timeinjazz")}
                           onCheckedChange={(checked) => setSelectedSources(prev => checked ? [...prev, "timeinjazz"] : prev.filter(x => x !== "timeinjazz"))}
                           className="mt-0.5"
                         />
                         <div>
                           <Label htmlFor="src-timeinjazz" className="text-sm font-semibold cursor-pointer text-orange-700 dark:text-orange-400">Time in Jazz 2026</Label>
                           <p className="text-xs text-muted-foreground mt-0.5">timeinjazz.it — 86 concerti a Berchidda e dintorni</p>
                         </div>
                       </div>
                     </div>

                   </div>
                 </div>

                <Button 
                  onClick={handlePreview} 
                  disabled={loadingPreview || !keyVerified || selectedSources.length === 0} 
                  className="w-full max-w-sm mt-2"
                >
                  {loadingPreview ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping in corso…</>
                  ) : (
                    <><Eye className="w-4 h-4 mr-2" /> Avvia Scraper ({selectedSources.length})</>
                  )}
                </Button>
                {!keyVerified && (
                  <p className="text-sm text-muted-foreground">Inserisci e verifica la chiave admin prima di procedere.</p>
                )}

                  {/* ── Scraping URL Libero ── */}
                  <div className="mt-6 pt-4 border-t border-border flex flex-col gap-3 max-w-2xl">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scraping URL Libero</span>
                    <p className="text-sm text-muted-foreground">Inserisci l'URL di un sito evento o festival per estrarre direttamente le informazioni con l'AI.</p>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="https://www.esempio.it/evento..." 
                          value={genericUrl}
                          onChange={(e) => setGenericUrl(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleScrapeUrl} 
                          disabled={scrapingGeneric || !keyVerified || !genericUrl.trim()}
                          className="shrink-0"
                        >
                          {scrapingGeneric ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                          Analizza URL
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground border border-border p-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2" title="Numero massimo di link di approfondimento da navigare.">
                          <label htmlFor="max-links" className="font-medium">Max Link Deep-Scrape:</label>
                          <Input 
                            id="max-links"
                            type="number"
                            placeholder="es. 70"
                            value={maxLinksUrl}
                            onChange={(e) => setMaxLinksUrl(e.target.value === "" ? "" : parseInt(e.target.value))}
                            className="w-20 h-8"
                            min="0"
                          />
                        </div>
                        <div className="h-4 w-px bg-border"></div>
                        <label className="flex items-center gap-2 cursor-pointer font-medium" title="Forza il sistema a unire tutti i link trovati sotto un unico grande Festival.">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            checked={forceFestival}
                            onChange={(e) => setForceFestival(e.target.checked)}
                          />
                          Raggruppa come Festival
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* ── Preview inline dopo Analizza URL ── */}
                  {urlScrapedEvents.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3 max-w-3xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {urlScrapedEvents.length === 1 ? "1 evento estratto" : `${urlScrapedEvents.length} eventi estratti`}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground"
                            onClick={() => { setUrlScrapedEvents([]); setGenericUrl(""); }}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Chiudi
                          </Button>
                        </div>
                      </div>

                      {urlScrapedEvents.map((ev, i) => (
                        <div key={i} className={`border rounded-xl overflow-hidden shadow-sm ${ev.is_festival ? "border-orange-300 bg-orange-50/40" : "border-border bg-card"}`}>
                          <div className="flex gap-3 p-4">
                            {ev.immagine && (
                              <img src={ev.immagine} alt={ev.titolo} className="w-24 h-24 object-cover rounded-lg flex-shrink-0 border border-border" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {ev.is_festival && <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Festival</Badge>}
                                {ev.categoria && <Badge variant="outline">{ev.categoria}</Badge>}
                              </div>
                              <h3 className="font-bold text-base text-foreground leading-snug">{ev.titolo}</h3>
                              <p className="text-xs text-muted-foreground mt-1">📍 {ev.luogo || "Sardegna"} | 📅 {ev.data_inizio} {ev.data_fine ? `- ${ev.data_fine}` : ""}</p>
                              {ev.descrizione && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ev.descrizione}</p>}
                            </div>
                          </div>
                          {ev.sotto_eventi && ev.sotto_eventi.length > 0 && (
                            <div className="bg-orange-50/70 border-t border-orange-200/60 p-3 flex flex-col gap-2">
                              <span className="text-xs font-semibold text-orange-900 uppercase tracking-wider">Sotto-eventi ({ev.sotto_eventi.length})</span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {ev.sotto_eventi.map((sub: any, si: number) => (
                                  <div key={si} className="flex flex-col gap-2 text-xs text-foreground bg-white/60 rounded-md px-2 py-1.5 border border-orange-100">
                                    <div className="flex items-start gap-2">
                                      <span className="font-semibold text-orange-700 flex-shrink-0 min-w-[90px]">{sub.data_inizio || "-"}</span>
                                      <span className="flex-1 leading-snug">{sub.titolo}</span>
                                      {sub.luogo && <span className="text-muted-foreground flex-shrink-0 truncate max-w-[120px]">{sub.luogo}</span>}
                                    </div>
                                    {(sub.descrizione || sub.url) && (
                                      <details className="group cursor-pointer">
                                        <summary className="text-[10px] text-orange-600 font-semibold uppercase hover:underline">Dettagli</summary>
                                        <div className="pt-2 pb-1 text-muted-foreground text-xs leading-relaxed border-t border-orange-100 mt-2">
                                          {sub.url && <p className="mb-1 truncate"><a href={sub.url} target="_blank" className="text-blue-500 hover:underline">Link: {sub.url}</a></p>}
                                          {sub.descrizione && <p className="whitespace-pre-wrap">{sub.descrizione}</p>}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Caricamento PDF ── */}
                  <div className="mt-6 pt-4 border-t border-border flex flex-col gap-3 max-w-xl">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caricamento PDF</span>
                    <p className="text-sm text-muted-foreground">Carica un PDF (es. locandina testuale o programma) per estrarne automaticamente gli eventi e le date.</p>
                    <div className="flex gap-2 items-center">
                      <Input 
                        type="file" 
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setPdfFile(file || null);
                        }}
                        className="flex-1 cursor-pointer"
                      />
                      <Button 
                        onClick={handleUploadPdf} 
                        disabled={uploadingPdf || !keyVerified || !pdfFile}
                      >
                        {uploadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Carica PDF
                      </Button>
                    </div>
                  </div>
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
                  <ButtonLegendGuide />
                  {previewEvents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Nessun nuovo evento trovato.</div>
                  ) : (
                    <>
                      {/* Banner Legenda & Azioni Massive sui Filtrati */}
                      <div className="bg-muted/40 p-3 rounded-lg border border-border flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Totale: {previewEvents.length}</span>
                          <span>|</span>
                          <span className="font-semibold text-blue-600">Filtrati: {filteredPreviewEvents.length}</span>
                          <span>|</span>
                          <span>Selezionati Pubblicazione: {selectedApproveIds.size}</span>
                          <span>|</span>
                          <span>Selezionati Analisi: {selectedAnalyzeIds.size}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500 text-blue-600 hover:bg-blue-50" onClick={handleAnalyzeAllFiltered}>
                            <Brain className="w-3.5 h-3.5 mr-1" /> Analizza Tutti Filtrati ({filteredPreviewEvents.length})
                          </Button>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleApproveAllFiltered}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approva Tutti Filtrati ({filteredPreviewEvents.length})
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDeleteAllFiltered}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({filteredPreviewEvents.length})
                          </Button>
                        </div>
                      </div>

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
                                <th className="px-4 py-3">Immagine</th>
                                <th className="px-4 py-3">Titolo</th>
                                <th className="px-4 py-3">Data</th>
                                <th className="px-4 py-3">Fonte</th>
                                <th className="px-4 py-3 text-right">Azioni</th>
                              </tr>
                              <tr className="border-t border-border bg-muted/40">
                                <th colSpan={3} className="p-1"></th>
                                <th className="p-1">
                                  <Input 
                                    placeholder="Filtra titolo…" 
                                    value={prevFilterTitolo} 
                                    onChange={(e) => setPrevFilterTitolo(e.target.value)} 
                                    className="h-7 text-xs bg-background" 
                                  />
                                </th>
                                <th className="p-1">
                                  <div className="flex gap-1 items-center">
                                    <Input 
                                      type="date" 
                                      value={prevFilterDataFrom} 
                                      onChange={(e) => setPrevFilterDataFrom(e.target.value)} 
                                      className="h-7 text-xs px-1 bg-background" 
                                    />
                                    <span className="text-muted-foreground text-xs">-</span>
                                    <Input 
                                      type="date" 
                                      value={prevFilterDataTo} 
                                      onChange={(e) => setPrevFilterDataTo(e.target.value)} 
                                      className="h-7 text-xs px-1 bg-background" 
                                    />
                                  </div>
                                </th>
                                <th className="p-1">
                                  <Input 
                                    placeholder="Filtra fonte…" 
                                    value={prevFilterFonte} 
                                    onChange={(e) => setPrevFilterFonte(e.target.value)} 
                                    className="h-7 text-xs bg-background" 
                                  />
                                </th>
                                <th className="p-1">
                                  <div className="flex gap-1 justify-end">
                                    <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={applyPrevFilters}>
                                      <Search className="w-3 h-3 mr-1" /> Filtra
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" onClick={clearPrevFilters}>
                                      Azzera
                                    </Button>
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPreviewEvents.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                    Nessun evento in attesa corrisponde ai filtri impostati.
                                  </td>
                                </tr>
                              ) : (
                                filteredPreviewEvents.map(({ ev, i }) => (
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
                                    <td className="px-4 py-3">
                                      {ev.immagine ? (
                                        <img
                                          src={ev.immagine}
                                          alt={ev.titolo}
                                          className="w-16 h-16 object-cover rounded-md border border-border"
                                          loading="lazy"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                                          N/D
                                        </div>
                                      )}
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
                                      <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEventDetails(ev, true)} title="Vedi dettagli" className="h-8 px-2 text-xs">
                                          <Eye className="w-4 h-4 mr-1" /> Dettagli
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deletePreviewEvent(i)} title="Cestina evento">
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </ScrollArea>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setScrapingStep("input")}>Annulla</Button>
                        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background text-xs">
                          <span className="text-muted-foreground text-xs">Provider:</span>
                          <select 
                            value={aiProvider} 
                            onChange={(e) => setAiProvider(e.target.value as any)}
                            className="bg-transparent border-none outline-none font-semibold text-foreground cursor-pointer text-xs"
                          >
                            <option value="direct">Chiave Diretta</option>
                            <option value="replit">Proxy Replit</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background text-xs">
                          <span className="text-muted-foreground text-xs">Analizza:</span>
                          <select 
                            value={analysisTarget} 
                            onChange={(e) => setAnalysisTarget(e.target.value as any)}
                            className="bg-transparent border-none outline-none font-semibold text-foreground cursor-pointer text-xs"
                          >
                            <option value="both">Locandina + Testo Breve</option>
                            <option value="both_source">Locandina + Pagina Fonte (Link)</option>
                            <option value="image">Solo Locandina</option>
                            <option value="text">Solo Testo Breve</option>
                            <option value="source_page">Solo Pagina Fonte (Link)</option>
                          </select>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={handleAnalyzePreview}
                          disabled={analyzingStep !== "idle" || selectedAnalyzeIds.size === 0}
                        >
                          {analyzingStep === "preview" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Analizza ({selectedAnalyzeIds.size})
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
              <CardContent className="flex flex-col gap-6">
                <ButtonLegendGuide />
                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const analyzedPreview = previewEvents
                    .filter((ev) => (ev as any).testo_estratto)
                    .map((ev) => ({ ...ev, is_pending: true, id_key: `prev-${ev.titolo}` }));
                  const analyzedPublished = publishedEvents
                    .filter((ev) => (ev as any).testo_estratto)
                    .map((ev) => ({ ...ev, is_pending: false, id_key: `pub-${ev.id}` }));
                  const allAnalyzed = [...analyzedPreview, ...analyzedPublished];

                  const filteredAnalyzed = allAnalyzed.filter(ev => {
                    if (appliedAnFilters.titolo && !ev.titolo?.toLowerCase().includes(appliedAnFilters.titolo.toLowerCase())) return false;
                    if (appliedAnFilters.fonte && !ev.fonte?.toLowerCase().includes(appliedAnFilters.fonte.toLowerCase())) return false;
                    if (appliedAnFilters.dataFrom && ev.data_inizio && ev.data_inizio < appliedAnFilters.dataFrom) return false;
                    if (appliedAnFilters.dataTo && ev.data_inizio && ev.data_inizio > appliedAnFilters.dataTo) return false;
                    return true;
                  });

                  const futureAnalyzed = filteredAnalyzed.filter(ev => !ev.data_inizio || ev.data_inizio >= todayStr);
                  const pastAnalyzed = filteredAnalyzed.filter(ev => ev.data_inizio && ev.data_inizio < todayStr);

                  const renderTable = (list: typeof allAnalyzed, emptyMessage: string) => {
                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-muted-foreground border rounded-md text-sm bg-background">
                          {emptyMessage}
                        </div>
                      );
                    }
                    return (
                      <div className="overflow-auto border rounded-md bg-background">
                        <table className="w-full text-sm">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="p-2 w-10 text-center">
                                <Checkbox 
                                  checked={list.length > 0 && list.every((ev: any) => selectedAnIds.has(ev.id_key))}
                                  onCheckedChange={(checked) => {
                                    const next = new Set(selectedAnIds);
                                    list.forEach((ev: any) => {
                                      if (checked === true) next.add(ev.id_key);
                                      else next.delete(ev.id_key);
                                    });
                                    setSelectedAnIds(next);
                                  }}
                                />
                              </th>
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
                            {list.map((ev: any) => {
                              const img = imageUrl(ev);
                              const subCount = ev.is_pending
                                ? (ev.sotto_eventi?.length || 0)
                                : publishedEvents.filter((child) => child.parent_id === ev.id).length;

                              return (
                                <tr key={ev.id_key} className="border-t border-border hover:bg-muted/40">
                                  <td className="p-2 text-center">
                                    <Checkbox 
                                      checked={selectedAnIds.has(ev.id_key)}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(selectedAnIds);
                                        if (checked === true) next.add(ev.id_key);
                                        else next.delete(ev.id_key);
                                        setSelectedAnIds(next);
                                      }}
                                    />
                                  </td>
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
                                    <div className="flex items-center gap-1">
                                      <Button variant="outline" size="sm" onClick={() => openEventDetails(ev, ev.is_pending)} className="h-7 text-xs px-2">
                                        <Eye className="w-3.5 h-3.5 mr-1" /> Dettagli
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Elimina" onClick={() => {
                                        if (ev.is_pending) {
                                          const next = previewEvents.filter(e => e.titolo !== ev.titolo);
                                          setPreviewEvents(next);
                                          updatePreviewCache(next);
                                        } else {
                                          deleteEvent(ev.id, false);
                                        }
                                      }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 hover:bg-orange-50" title="Elimina e scarta" onClick={() => {
                                        if (ev.is_pending) {
                                          const next = previewEvents.filter(e => e.titolo !== ev.titolo);
                                          setPreviewEvents(next);
                                          updatePreviewCache(next);
                                        } else {
                                          deleteEvent(ev.id, true);
                                        }
                                      }}>
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-6">
                      {/* Banner Legenda & Azioni Massive sui Filtrati per Analizzati */}
                      <div className="bg-muted/40 p-3 rounded-lg border border-border flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Totale Analizzati: {allAnalyzed.length}</span>
                          <span>|</span>
                          <span className="font-semibold text-blue-600">Filtrati: {filteredAnalyzed.length}</span>
                          <span>|</span>
                          <span>Selezionati: {selectedAnIds.size}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="secondary" className="h-7 text-xs px-3" onClick={handleAnAnalyzeAllFiltered}>
                            <Brain className="w-3.5 h-3.5 mr-1" /> Rianalizza Tutti Filtrati ({filteredAnalyzed.length})
                          </Button>
                          <Button size="sm" className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white" onClick={handleAnPublishAllFiltered}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Pubblica Tutti Filtrati ({filteredAnalyzed.length})
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={() => handleAnDeleteAllFiltered(false)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({filteredAnalyzed.length})
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs px-3 bg-orange-600 hover:bg-orange-700 text-white border-none" onClick={() => handleAnDeleteAllFiltered(true)}>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Elimina & Scarta Tutti ({filteredAnalyzed.length})
                          </Button>
                        </div>
                      </div>

                      {/* Toolbar Selezionati per Analizzati */}
                      {selectedAnIds.size > 0 && (
                        <div className="bg-muted p-2 rounded-md flex items-center justify-between border">
                          <span className="text-xs font-semibold ml-2">{selectedAnIds.size} eventi selezionati</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleAnBulkAnalyze}>
                              <Brain className="w-3.5 h-3.5 mr-1" /> Rianalizza Selezionati
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleAnBulkPubblica}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pubblica Selezionati
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleAnBulkElimina(false)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Selezionati
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white border-none" onClick={() => handleAnBulkElimina(true)}>
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Elimina & Scarta Selezionati
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Filter Box per Analizzati */}
                      <div className="flex flex-wrap gap-2 items-center bg-muted/50 p-2 rounded border border-border">
                        <Input placeholder="Filtra titolo…" value={anFilterTitolo} onChange={(e) => setAnFilterTitolo(e.target.value)} className="h-8 text-xs w-40 bg-background" />
                        <Input placeholder="Filtra fonte…" value={anFilterFonte} onChange={(e) => setAnFilterFonte(e.target.value)} className="h-8 text-xs w-32 bg-background" />
                        <Input type="date" value={anFilterDataFrom} onChange={(e) => setAnFilterDataFrom(e.target.value)} className="h-8 text-xs w-32 bg-background" />
                        <Input type="date" value={anFilterDataTo} onChange={(e) => setAnFilterDataTo(e.target.value)} className="h-8 text-xs w-32 bg-background" />
                        <Button size="sm" className="h-8 text-xs px-3" onClick={applyAnFilters}><Search className="w-3 h-3 mr-1" /> Applica</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={clearAnFilters}>Azzera</Button>
                      </div>

                      <div>
                        <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                          Eventi Futuri ({futureAnalyzed.length})
                        </h3>
                        {renderTable(futureAnalyzed, "Nessun evento futuro analizzato trovato.")}
                      </div>

                      <div className="pt-4 border-t border-border">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></span>
                          Eventi Passati ({pastAnalyzed.length})
                        </h3>
                        {renderTable(pastAnalyzed, "Nessun evento passato analizzato trovato.")}
                      </div>
                    </div>
                  );
                })()}
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
                {/* Banner Legenda & Azioni Massive sui Filtrati per Pubblicati */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Totale Pubblicati: {publishedEvents.length}</span>
                    <span>|</span>
                    <span>Selezionati Eliminazione: {selectedPubIds.size}</span>
                    <span>|</span>
                    <span>Selezionati Analisi: {selectedPubAnalyzeIds.size}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500 text-blue-600 hover:bg-blue-50" onClick={handleAnalyzeAllPublishedFiltered}>
                      <Brain className="w-3.5 h-3.5 mr-1" /> Analizza Tutti Filtrati ({publishedEvents.length})
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeleteAllPublishedFiltered(false)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({publishedEvents.length})
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white border-none" onClick={() => handleDeleteAllPublishedFiltered(true)}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Elimina & Scarta Tutti ({publishedEvents.length})
                    </Button>
                  </div>
                </div>

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
                      <>
                        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background text-xs">
                          <span className="text-muted-foreground text-xs">Provider:</span>
                          <select 
                            value={aiProvider} 
                            onChange={(e) => setAiProvider(e.target.value as any)}
                            className="bg-transparent border-none outline-none font-semibold text-foreground cursor-pointer text-xs"
                          >
                            <option value="direct">Chiave Diretta</option>
                            <option value="replit">Proxy Replit</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background text-xs">
                          <span className="text-muted-foreground text-xs">Analizza:</span>
                          <select 
                            value={analysisTarget} 
                            onChange={(e) => setAnalysisTarget(e.target.value as any)}
                            className="bg-transparent border-none outline-none font-semibold text-foreground cursor-pointer text-xs"
                          >
                            <option value="both">Locandina + Testo Breve</option>
                            <option value="both_source">Locandina + Pagina Fonte (Link)</option>
                            <option value="image">Solo Locandina</option>
                            <option value="text">Solo Testo Breve</option>
                            <option value="source_page">Solo Pagina Fonte (Link)</option>
                          </select>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleAnalyzePublished}
                          disabled={analyzingStep !== "idle"}
                        >
                          {analyzingStep === "published" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Analizza ({selectedPubAnalyzeIds.size})
                        </Button>
                      </>
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

                {/* Unified Filters Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 bg-muted/40 p-3 rounded-lg border border-border">
                  <Input
                    placeholder="Filtra titolo…"
                    value={filterTitolo}
                    onChange={(e) => setFilterTitolo(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <div className="flex gap-1">
                    <Input type="date" value={filterDataFrom} onChange={(e) => setFilterDataFrom(e.target.value)} className="h-8 text-xs px-1 bg-background" />
                    <Input type="date" value={filterDataTo} onChange={(e) => setFilterDataTo(e.target.value)} className="h-8 text-xs px-1 bg-background" />
                  </div>
                  <Input
                    placeholder="Filtra luogo…"
                    value={filterLuogo}
                    onChange={(e) => setFilterLuogo(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    placeholder="Filtra fonte…"
                    value={filterFonte}
                    onChange={(e) => setFilterFonte(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-8 text-xs px-2 flex-1" onClick={applyFilters}>
                      <Search className="w-3 h-3 mr-1" /> Applica
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={clearFilters}>
                      Azzera
                    </Button>
                  </div>
                </div>

                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const futurePublished = publishedEvents.filter(ev => !ev.data_inizio || ev.data_inizio >= todayStr);
                  const pastPublished = publishedEvents.filter(ev => ev.data_inizio && ev.data_inizio < todayStr);

                  const renderPublishedTable = (list: typeof publishedEvents, emptyMessage: string) => {
                    if (list.length === 0) {
                      return (
                        <div className="p-8 text-center text-muted-foreground border rounded-md text-sm bg-background">
                          {emptyMessage}
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-auto border rounded-md bg-background">
                        <table className="w-full text-sm">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="w-10 p-2">
                                <Checkbox
                                  checked={list.length > 0 && list.every((e) => selectedPubIds.has(e.id))}
                                  onCheckedChange={(v) => {
                                    const next = new Set(selectedPubIds);
                                    list.forEach((e) => {
                                      if (v === true) next.add(e.id);
                                      else next.delete(e.id);
                                    });
                                    setSelectedPubIds(next);
                                  }}
                                />
                              </th>
                              <th className="w-10 p-2">
                                <Checkbox
                                  checked={list.length > 0 && list.every((e) => selectedPubAnalyzeIds.has(e.id))}
                                  onCheckedChange={(v) => {
                                    const next = new Set(selectedPubAnalyzeIds);
                                    list.forEach((e) => {
                                      if (v === true) next.add(e.id);
                                      else next.delete(e.id);
                                    });
                                    setSelectedPubAnalyzeIds(next);
                                  }}
                                />
                              </th>
                              <th className="p-2 text-left text-xs font-semibold">Immagine</th>
                              <th className="p-2 text-left text-xs font-semibold">Titolo</th>
                              <th className="p-2 text-left text-xs font-semibold">Data</th>
                              <th className="p-2 text-left text-xs font-semibold">Luogo</th>
                              <th className="p-2 text-left text-xs font-semibold">Fonte</th>
                              <th className="p-2 text-left text-xs font-semibold">Sotto-eventi</th>
                              <th className="p-2 text-left text-xs font-semibold">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((ev) => {
                              const img = imageUrl(ev);
                              const subCount = publishedEvents.filter((child) => child.parent_id === ev.id).length;
                              return (
                                <tr key={ev.id} className="border-t border-border hover:bg-muted/40">
                                  <td className="p-2">
                                    <Checkbox
                                      checked={selectedPubIds.has(ev.id)}
                                      onCheckedChange={(v) => {
                                        const next = new Set(selectedPubIds);
                                        if (v === true) next.add(ev.id);
                                        else next.delete(ev.id);
                                        setSelectedPubIds(next);
                                      }}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Checkbox
                                      checked={selectedPubAnalyzeIds.has(ev.id)}
                                      onCheckedChange={(v) => {
                                        const next = new Set(selectedPubAnalyzeIds);
                                        if (v === true) next.add(ev.id);
                                        else next.delete(ev.id);
                                        setSelectedPubAnalyzeIds(next);
                                      }}
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
                                    {subCount > 0 ? (
                                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                                        {subCount} sotto-eventi
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="p-2">
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => openEventDetails(ev, false)} title="Vedi dettagli" className="h-7 px-2 text-xs">
                                        <Eye className="w-4 h-4 mr-1" /> Dettagli
                                      </Button>
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-6">
                      <div>
                        <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                          Eventi Futuri ({futurePublished.length})
                        </h3>
                        {renderPublishedTable(futurePublished, "Nessun evento futuro trovato con i filtri attuali.")}
                      </div>

                      <div className="pt-4 border-t border-border">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></span>
                          Eventi Passati ({pastPublished.length})
                        </h3>
                        {renderPublishedTable(pastPublished, "Nessun evento passato trovato con i filtri attuali.")}
                      </div>
                    </div>
                  );
                })()}
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

          {/* ── ANALYZED TAB ── */}
          <TabsContent value="analyzed" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Eventi Analizzati</CardTitle>
                <CardDescription>
                  Eventi che sono già stati elaborati dall'AI. Puoi pubblicarli o rianalizzarli in blocco.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2 items-center bg-muted/50 p-2 rounded border border-border">
                  <Input placeholder="Filtra titolo…" value={anFilterTitolo} onChange={(e) => setAnFilterTitolo(e.target.value)} className="h-8 text-xs w-40" />
                  <Input placeholder="Filtra fonte…" value={anFilterFonte} onChange={(e) => setAnFilterFonte(e.target.value)} className="h-8 text-xs w-32" />
                  <Input type="date" value={anFilterDataFrom} onChange={(e) => setAnFilterDataFrom(e.target.value)} className="h-8 text-xs w-32" />
                  <Input type="date" value={anFilterDataTo} onChange={(e) => setAnFilterDataTo(e.target.value)} className="h-8 text-xs w-32" />
                  <Button size="sm" className="h-8 text-xs px-3" onClick={applyAnFilters}><Search className="w-3 h-3 mr-1" /> Applica</Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={clearAnFilters}>Azzera</Button>
                  <div className="flex-1"></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="h-8 text-xs px-3" onClick={handleAnAnalyzeAllFiltered}>
                      <Brain className="w-3.5 h-3.5 mr-1" /> Rianalizza Filtrati
                    </Button>
                    <Button size="sm" className="h-8 text-xs px-3 bg-green-600 hover:bg-green-700 text-white" onClick={handleAnPublishAllFiltered}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Pubblica Filtrati
                    </Button>
                  </div>
                </div>

                {selectedAnIds.size > 0 && (
                  <div className="bg-muted p-2 rounded-md flex items-center justify-between border">
                    <span className="text-sm font-semibold ml-2">{selectedAnIds.size} eventi selezionati</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={handleAnBulkAnalyze}>
                        <Brain className="w-4 h-4 mr-1" /> Rianalizza Selezionati
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAnBulkPubblica}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Pubblica Selezionati
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── STATS TAB ── */}
          <TabsContent value="stats" className="mt-4">
            <AdminStats adminKey={adminKey} />
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        {inspectingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="w-full mr-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={inspectingEvent.is_pending ? "secondary" : "default"} className={inspectingEvent.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}>
                        {inspectingEvent.is_pending ? "In Attesa" : "Pubblicato"}
                      </Badge>
                      <Badge variant="outline">{inspectingEvent.fonte}</Badge>
                    </div>
                    {isEditingEvent ? (
                      <Input 
                        value={inspectingEvent.titolo} 
                        onChange={e => setInspectingEvent({...inspectingEvent, titolo: e.target.value})}
                        className="text-lg font-bold mt-2 font-sans h-12 px-3"
                      />
                    ) : (
                      <CardTitle className="text-lg font-bold mt-1">{inspectingEvent.titolo}</CardTitle>
                    )}
                    <CardDescription className="mt-1">
                      {inspectingEvent.data_inizio ? new Date(inspectingEvent.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                      {inspectingEvent.data_fine && inspectingEvent.data_fine !== inspectingEvent.data_inizio ? ` - ${new Date(inspectingEvent.data_fine).toLocaleDateString("it-IT")}` : ""}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => setInspectingEvent(null)} className="h-8 w-8 p-0 shrink-0">
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
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="flex-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrizione Originale</h4>
                      {isEditingEvent ? (
                        <AutoResizeTextarea 
                          value={inspectingEvent.descrizione || ""} 
                          onChange={(e: any) => setInspectingEvent({...inspectingEvent, descrizione: e.target.value})}
                          className="w-full min-h-[144px] text-sm bg-background border border-input rounded-md p-3 leading-relaxed"
                        />
                      ) : (
                        <p className="text-sm text-foreground line-clamp-6 leading-relaxed">{inspectingEvent.descrizione || "Nessuna descrizione fornita."}</p>
                      )}
                    </div>
                    {inspectingEvent.link && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sito Fonte (Riservato Admin)</h4>
                        <a href={inspectingEvent.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 w-fit">
                          <Globe className="w-3.5 h-3.5" /> Apri Sito Fonte
                        </a>
                      </div>
                    )}
                    {(isEditingEvent || inspectingEvent.link_organizzatore) && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sito Organizzatore</h4>
                        {isEditingEvent ? (
                          <Input 
                            value={inspectingEvent.link_organizzatore || ""} 
                            onChange={e => setInspectingEvent({...inspectingEvent, link_organizzatore: e.target.value})}
                            className="h-10 text-xs font-mono px-3"
                            placeholder="https://..."
                          />
                        ) : (
                          <a href={inspectingEvent.link_organizzatore} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:underline flex items-center gap-1 w-fit font-medium">
                            <Globe className="w-3.5 h-3.5" /> Apri Sito Organizzatore
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Text */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Testo Estratto dalla Locandina</h4>
                  {isEditingEvent ? (
                    <AutoResizeTextarea 
                      value={inspectingEvent.testo_estratto || ""} 
                      onChange={(e: any) => setInspectingEvent({...inspectingEvent, testo_estratto: e.target.value})}
                      className="w-full bg-muted p-4 rounded-md font-mono text-xs border min-h-48 focus:outline-none leading-relaxed"
                    />
                  ) : (
                    <div className="bg-muted p-4 rounded-md font-mono text-xs max-h-64 overflow-y-auto border whitespace-pre-wrap leading-relaxed">
                      {inspectingEvent.testo_estratto || "Nessun testo estratto."}
                    </div>
                  )}
                </div>

                {/* Tags & Dettagli Extra */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h4>
                    </div>
                    {isEditingEvent ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {editingTags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                              {tag}
                              <button onClick={() => setEditingTags(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-500">
                                <XCircle className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Input value={newTagValue} onChange={e => setNewTagValue(e.target.value)} placeholder="Nuovo tag..." className="h-10 text-sm" />
                          <Button size="sm" variant="secondary" className="h-10 px-4" onClick={() => {
                            if (newTagValue.trim()) {
                              setEditingTags(prev => [...prev, newTagValue.trim()]);
                              setNewTagValue("");
                            }
                          }}>Aggiungi</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {inspectingEvent.tags && inspectingEvent.tags.length > 0 ? inspectingEvent.tags.map((tag: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700">{tag}</Badge>
                        )) : <span className="text-sm text-muted-foreground italic">Nessun tag</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dettagli Extra</h4>
                    {isEditingEvent ? (
                      <div className="flex flex-col gap-3">
                        {Object.entries(editingDettagli).map(([key, value]) => (
                          <div key={key} className="flex gap-2 items-start">
                            <Input value={key} disabled className="h-10 text-sm w-1/3 bg-muted font-semibold mt-0.5" />
                            {String(value).length > 60 || key.toLowerCase().includes('bio') ? (
                              <AutoResizeTextarea 
                                value={value as string} 
                                onChange={(e: any) => setEditingDettagli(prev => ({ ...prev, [key]: e.target.value }))} 
                                className="text-sm bg-background border border-input rounded-md p-3 flex-1 min-h-[120px] leading-relaxed" 
                              />
                            ) : (
                              <Input 
                                value={value as string} 
                                onChange={e => setEditingDettagli(prev => ({ ...prev, [key]: e.target.value }))} 
                                className="h-10 text-sm flex-1 mt-0.5 px-3" 
                              />
                            )}
                            <Button size="icon" variant="ghost" className="h-10 w-10 mt-0.5 text-destructive" onClick={() => {
                              const next = { ...editingDettagli };
                              delete next[key];
                              setEditingDettagli(next);
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2 items-center mt-3 border-t border-border pt-3">
                          <Input value={newDettaglioKey} onChange={e => setNewDettaglioKey(e.target.value)} placeholder="Es. Artisti" className="h-10 text-sm w-1/3" />
                          <Input value={newDettaglioValue} onChange={e => setNewDettaglioValue(e.target.value)} placeholder="Valore" className="h-10 text-sm flex-1" />
                          <Button size="sm" variant="secondary" className="h-10 px-4" onClick={() => {
                            if (newDettaglioKey.trim() && newDettaglioValue.trim()) {
                              setEditingDettagli(prev => ({ ...prev, [newDettaglioKey.trim()]: newDettaglioValue.trim() }));
                              setNewDettaglioKey("");
                              setNewDettaglioValue("");
                            }
                          }}>Add</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {inspectingEvent.dettagli_extra && Object.keys(inspectingEvent.dettagli_extra).length > 0 ? (
                          Object.entries(inspectingEvent.dettagli_extra).map(([key, value]) => (
                            <div key={key} className="bg-muted/50 p-2 rounded border border-border/50 text-sm">
                              <span className="font-semibold text-foreground capitalize mr-2">{key.replace(/_/g, ' ')}:</span>
                              <span className="text-muted-foreground">{String(value)}</span>
                            </div>
                          ))
                        ) : <span className="text-sm text-muted-foreground italic">Nessun dettaglio extra</span>}
                      </div>
                    )}
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
              
              <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-muted/20">
                {!isEditingEvent ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background text-xs">
                      <span className="text-muted-foreground">Analizza:</span>
                      <select 
                        value={analysisTarget} 
                        onChange={(e) => setAnalysisTarget(e.target.value as any)}
                        className="bg-transparent border-none outline-none font-semibold text-foreground cursor-pointer text-xs"
                      >
                        <option value="both">Locandina + Testo</option>
                        <option value="both_source">Locandina + Fonte</option>
                        <option value="image">Solo Locandina</option>
                        <option value="text">Solo Testo</option>
                        <option value="source_page">Solo Fonte</option>
                      </select>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAnalyzeSingleFromModal}
                      disabled={analyzingStep !== "idle"}
                    >
                      {(analyzingStep === "preview" || analyzingStep === "published") ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                      Analizza
                    </Button>
                  </div>
                ) : (
                  <div></div>
                )}
                
                <div className="flex justify-end gap-3">
                  {isEditingEvent ? (
                    <>
                      <Button variant="outline" onClick={() => {
                        setIsEditingEvent(false);
                        setEditingTags(inspectingEvent.tags || []);
                        setEditingDettagli(inspectingEvent.dettagli_extra || {});
                      }}>Annulla</Button>
                      <Button onClick={handleSaveEventDetails} disabled={savingEvent}>
                        {savingEvent && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salva Modifiche
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => setIsEditingEvent(true)}>Modifica Dettagli</Button>
                      <Button onClick={() => setInspectingEvent(null)}>Chiudi</Button>
                    </>
                  )}
                </div>
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

        {/* Streaming analysis terminal logs dialog */}
        {analyzingStep !== "idle" && (
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-2xl bg-slate-950 text-slate-100 border-slate-800 font-mono">
              <DialogHeader>
                <DialogTitle className="text-slate-200 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400 animate-pulse" />
                  Console di Analisi AI in Corso
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Sto processando gli eventi selezionati tramite modelli generativi Gemini.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-slate-900/90 border border-slate-800 rounded p-4 h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent flex flex-col gap-1 text-xs">
                {analysisLogs.map((log, i) => (
                  <div key={i} className="text-emerald-400 flex items-start gap-1">
                    <span className="text-emerald-600 select-none">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
                {analysisLogs.length === 0 && (
                  <div className="text-slate-500 italic">Inizializzazione sessione di analisi...</div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                <span className="flex items-center gap-1.5 font-sans">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  Elaborazione in background...
                </span>
                <div className="flex items-center gap-3 font-sans">
                  <span>Target: {analysisTarget}</span>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="h-7 text-xs bg-red-650 hover:bg-red-750"
                    onClick={() => {
                      isAbortedRef.current = true;
                      abortControllerRef.current?.abort();
                      setAnalyzingStep("idle");
                    }}
                  >
                    Termina
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <p className="text-center text-xs text-muted-foreground mt-2">
          Questa pagina non è linkata pubblicamente.
        </p>
      </div>
    </div>
  );
}
