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
import { ScraperPanel } from "@/components/admin/ScraperPanel";
import { PendingEventsTable } from "@/components/admin/PendingEventsTable";
import { AnalyzedEventsTable } from "@/components/admin/AnalyzedEventsTable";
import { PublishedEventsTable } from "@/components/admin/PublishedEventsTable";
import { RejectedEventsTable } from "@/components/admin/RejectedEventsTable";
import { EventDetailsModal } from "@/components/admin/EventDetailsModal";

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
        if (resp.events.length === 0) {
          setError("Impossibile leggere la pagina. Il sito sorgente (es. Comune di Oristano) potrebbe avere firewall o blocchi anti-bot attivi.");
          setScrapingGeneric(false);
          return;
        }
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
          link: ev.link, dettagli_extra: ev.dettagli_extra, data_inizio: ev.data_inizio, data_fine: ev.data_fine, luogo: ev.luogo, fonte: ev.fonte,
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
              titolo: res.titolo || nextEvents[idx].titolo,
              categoria: res.categoria || (nextEvents[idx] as any).categoria,
              tags: res.tags || (nextEvents[idx] as any).tags,
              dettagli_extra: res.dettagli_extra || (nextEvents[idx] as any).dettagli_extra,
              testo_estratto: res.testo_estratto,
              descrizione: res.testo_grezzo_url || nextEvents[idx].descrizione,
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

  const handleAnalyzeEventsMixed = async (toAnalyze: any[]) => {
    if (toAnalyze.length === 0) return;

    setAnalyzingStep("preview");
    setAnalysisLogs([]);
    setError(null);
    isAbortedRef.current = false;

    const total = toAnalyze.length;
    let nextEvents = [...previewEvents];
    let successi = 0;
    let erroriCount = 0;
    let reloadPublished = false;

    try {
      for (let i = 0; i < total; i++) {
        if (isAbortedRef.current) {
          setAnalysisLogs(prev => [...prev, "🚫 Analisi interrotta dall'utente."]);
          break;
        }

        const ev = toAnalyze[i];
        setAnalysisLogs(prev => [...prev, `[${i + 1}/${total}] Sto analizzando l'evento: '${ev.titolo}' (Target: ${analysisTarget})...`]);

        const payload = [{
          tmp_id: ev.is_pending ? ev.original_idx.toString() : "",
          id: ev.is_pending ? undefined : ev.id,
          titolo: ev.titolo,
          descrizione: ev.descrizione,
          immagine: ev.immagine,
          link: ev.link, dettagli_extra: ev.dettagli_extra, data_inizio: ev.data_inizio, data_fine: ev.data_fine, luogo: ev.luogo, fonte: ev.fonte,
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
            if (ev.is_pending) {
              const idx = ev.original_idx;
              nextEvents[idx] = {
                ...nextEvents[idx],
                titolo: res.titolo || nextEvents[idx].titolo,
                categoria: res.categoria || (nextEvents[idx] as any).categoria,
                tags: res.tags || (nextEvents[idx] as any).tags,
                dettagli_extra: res.dettagli_extra || (nextEvents[idx] as any).dettagli_extra,
                testo_estratto: res.testo_estratto,
                is_festival: res.is_festival,
                sotto_eventi: res.sotto_eventi,
                link_organizzatore: res.link_organizzatore,
              };
              setPreviewEvents([...nextEvents]);
              updatePreviewCache(nextEvents);
            } else {
              reloadPublished = true;
            }
            setAnalysisLogs(prev => [...prev, `✅ Completato con successo!`]);
          }
        } else {
          erroriCount++;
          setAnalysisLogs(prev => [...prev, `❌ Errore durante l'analisi.`]);
        }
      }
      
      if (!isAbortedRef.current) {
        setSelectedAnalyzeIds(new Set());
        if (reloadPublished) {
          loadPublished(appliedFilters);
        }
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
    if (filteredPreviewEvents.length === 0) {
      setError("Nessun evento visibile per l'analisi.");
      return;
    }
    if (!window.confirm(`Sei sicuro di voler (ri)analizzare i ${filteredPreviewEvents.length} eventi visibili?`)) return;
    const explicitIndices = filteredPreviewEvents.map(({ i }) => i);
    const nextAnalyze = new Set(selectedAnalyzeIds);
    explicitIndices.forEach(i => nextAnalyze.add(i));
    setSelectedAnalyzeIds(nextAnalyze);
    handleAnalyzeEventsMixed(explicitIndices.map(i => ({ ...previewEvents[i], original_idx: i, idx: i, is_pending: true })));
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
          link: ev.link, dettagli_extra: ev.dettagli_extra, data_inizio: ev.data_inizio, data_fine: ev.data_fine, luogo: ev.luogo, fonte: ev.fonte,
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
      subEvents = previewEvents.filter(e => e.dettagli_extra?.parent_temp_id === ev.dettagli_extra?.id_key);
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

  const handleAnalyzeGroupFromModal = () => {
    if (!inspectingEvent || !inspectingEvent.is_pending) return;
    const parentIdx = previewEvents.findIndex(ev => ev.dettagli_extra?.id_key === inspectingEvent.dettagli_extra?.id_key);
    if (parentIdx === -1) return;
    const parentEv = { ...previewEvents[parentIdx], original_idx: parentIdx, is_pending: true };
    const childrenToAnalyze = previewEvents
      .map((ev, i) => ({ ...ev, original_idx: i, is_pending: true }))
      .filter(ev => ev.dettagli_extra?.parent_temp_id === inspectingEvent.dettagli_extra?.id_key);
    handleAnalyzeEventsMixed([parentEv, ...childrenToAnalyze]);
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
        dettagli_extra: inspectingEvent.dettagli_extra,
        data_inizio: inspectingEvent.data_inizio,
        data_fine: inspectingEvent.data_fine,
        luogo: inspectingEvent.luogo,
        fonte: inspectingEvent.fonte,
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
            descrizione: res.testo_grezzo_url || inspectingEvent.descrizione,
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
            <ScraperPanel
              selectedSources={selectedSources}
              setSelectedSources={setSelectedSources}
              loadingPreview={loadingPreview}
              keyVerified={keyVerified}
              handlePreview={handlePreview}
              genericUrl={genericUrl}
              setGenericUrl={setGenericUrl}
              handleScrapeUrl={handleScrapeUrl}
              scrapingGeneric={scrapingGeneric}
              maxLinksUrl={maxLinksUrl}
              setMaxLinksUrl={setMaxLinksUrl}
              forceFestival={forceFestival}
              setForceFestival={setForceFestival}
              urlScrapedEvents={urlScrapedEvents}
              setUrlScrapedEvents={setUrlScrapedEvents}
              pdfFile={pdfFile}
              setPdfFile={setPdfFile}
              uploadingPdf={uploadingPdf}
              handleUploadPdf={handleUploadPdf}
              scrapingLogs={scrapingLogs}
            />
          </TabsContent>

          {/* ── PENDING TAB ── */}
          <TabsContent value="pending" className="mt-4">
            <PendingEventsTable
              scrapingStep={scrapingStep}
              setScrapingStep={setScrapingStep}
              previewEvents={previewEvents}
              filteredPreviewEvents={filteredPreviewEvents}
              selectedApproveIds={selectedApproveIds}
              selectedAnalyzeIds={selectedAnalyzeIds}
              handleAnalyzeAllFiltered={handleAnalyzeAllFiltered}
              handleApproveAllFiltered={handleApproveAllFiltered}
              handleDeleteAllFiltered={handleDeleteAllFiltered}
              toggleApproveAll={toggleApproveAll}
              toggleAnalyzeAll={toggleAnalyzeAll}
              prevFilterTitolo={prevFilterTitolo}
              setPrevFilterTitolo={setPrevFilterTitolo}
              prevFilterDataFrom={prevFilterDataFrom}
              setPrevFilterDataFrom={setPrevFilterDataFrom}
              prevFilterDataTo={prevFilterDataTo}
              setPrevFilterDataTo={setPrevFilterDataTo}
              prevFilterFonte={prevFilterFonte}
              setPrevFilterFonte={setPrevFilterFonte}
              applyPrevFilters={applyPrevFilters}
              clearPrevFilters={clearPrevFilters}
              toggleApproveOne={toggleApproveOne}
              toggleAnalyzeOne={toggleAnalyzeOne}
              openEventDetails={openEventDetails}
              deletePreviewEvent={deletePreviewEvent}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
              analysisTarget={analysisTarget}
              setAnalysisTarget={setAnalysisTarget}
              handleAnalyzePreview={handleAnalyzePreview}
              analyzingStep={analyzingStep}
              handleApprove={handleApprove}
              loadingPreview={loadingPreview}
              approvalResult={approvalResult}
            />
          </TabsContent>

          {/* ── ANALYZED TAB ── */}
          <TabsContent value="analyzed" className="mt-4">
            <AnalyzedEventsTable
              previewEvents={previewEvents}
              publishedEvents={publishedEvents}
              appliedAnFilters={appliedAnFilters}
              selectedAnIds={selectedAnIds}
              setSelectedAnIds={setSelectedAnIds}
              imageUrl={imageUrl}
              openEventDetails={openEventDetails}
              setPreviewEvents={setPreviewEvents}
              updatePreviewCache={updatePreviewCache}
              deleteEvent={deleteEvent}
              handleAnAnalyzeAllFiltered={handleAnAnalyzeAllFiltered}
              handleAnPublishAllFiltered={handleAnPublishAllFiltered}
              handleAnDeleteAllFiltered={handleAnDeleteAllFiltered}
              handleAnBulkAnalyze={handleAnBulkAnalyze}
              handleAnBulkPubblica={handleAnBulkPubblica}
              handleAnBulkElimina={handleAnBulkElimina}
              anFilterTitolo={anFilterTitolo}
              setAnFilterTitolo={setAnFilterTitolo}
              anFilterFonte={anFilterFonte}
              setAnFilterFonte={setAnFilterFonte}
              anFilterDataFrom={anFilterDataFrom}
              setAnFilterDataFrom={setAnFilterDataFrom}
              anFilterDataTo={anFilterDataTo}
              setAnFilterDataTo={setAnFilterDataTo}
              applyAnFilters={applyAnFilters}
              clearAnFilters={clearAnFilters}
            />
          </TabsContent>

          {/* ── PUBLISHED TAB ── */}
          <TabsContent value="published" className="mt-4">
            <PublishedEventsTable
              publishedEvents={publishedEvents}
              loadingPublished={loadingPublished}
              selectedPubIds={selectedPubIds}
              setSelectedPubIds={setSelectedPubIds}
              selectedPubAnalyzeIds={selectedPubAnalyzeIds}
              setSelectedPubAnalyzeIds={setSelectedPubAnalyzeIds}
              handleAnalyzeAllPublishedFiltered={handleAnalyzeAllPublishedFiltered}
              handleDeleteAllPublishedFiltered={handleDeleteAllPublishedFiltered}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
              analysisTarget={analysisTarget}
              setAnalysisTarget={setAnalysisTarget}
              handleAnalyzePublished={handleAnalyzePublished}
              analyzingStep={analyzingStep}
              bulkDelete={bulkDelete}
              filterTitolo={filterTitolo}
              setFilterTitolo={setFilterTitolo}
              filterDataFrom={filterDataFrom}
              setFilterDataFrom={setFilterDataFrom}
              filterDataTo={filterDataTo}
              setFilterDataTo={setFilterDataTo}
              filterLuogo={filterLuogo}
              setFilterLuogo={setFilterLuogo}
              filterFonte={filterFonte}
              setFilterFonte={setFilterFonte}
              applyFilters={applyFilters}
              clearFilters={clearFilters}
              imageUrl={imageUrl}
              openEventDetails={openEventDetails}
              deleteEvent={deleteEvent}
            />
          </TabsContent>

          {/* ── REJECTED TAB ── */}
          <TabsContent value="rejected" className="mt-4">
            <RejectedEventsTable
              rejectedEvents={rejectedEvents}
              loadingRejected={loadingRejected}
              rejFilterTitolo={rejFilterTitolo}
              setRejFilterTitolo={setRejFilterTitolo}
              rejFilterFonte={rejFilterFonte}
              setRejFilterFonte={setRejFilterFonte}
              rejFilterMotivo={rejFilterMotivo}
              setRejFilterMotivo={setRejFilterMotivo}
              rejFilterDataFrom={rejFilterDataFrom}
              setRejFilterDataFrom={setRejFilterDataFrom}
              rejFilterDataTo={rejFilterDataTo}
              setRejFilterDataTo={setRejFilterDataTo}
              applyRejFilters={applyRejFilters}
              clearRejFilters={clearRejFilters}
              filteredRejectedEvents={filteredRejectedEvents}
              restoreRejected={restoreRejected}
            />
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
        <EventDetailsModal
          inspectingEvent={inspectingEvent}
          setInspectingEvent={setInspectingEvent}
          isEditingEvent={isEditingEvent}
          setIsEditingEvent={setIsEditingEvent}
          imageUrl={imageUrl}
          editingTags={editingTags}
          setEditingTags={setEditingTags}
          newTagValue={newTagValue}
          setNewTagValue={setNewTagValue}
          editingDettagli={editingDettagli}
          setEditingDettagli={setEditingDettagli}
          newDettaglioKey={newDettaglioKey}
          setNewDettaglioKey={setNewDettaglioKey}
          newDettaglioValue={newDettaglioValue}
          setNewDettaglioValue={setNewDettaglioValue}
          setPreviewEvents={setPreviewEvents}
          updatePreviewCache={updatePreviewCache}
          previewEvents={previewEvents}
          handlePublishAnalyzed={handlePublishAnalyzed}
          analysisTarget={analysisTarget}
          setAnalysisTarget={setAnalysisTarget}
          handleAnalyzeSingleFromModal={handleAnalyzeSingleFromModal}
          analyzingStep={analyzingStep}
          handleAnalyzeGroupFromModal={handleAnalyzeGroupFromModal}
          handleSaveEventDetails={handleSaveEventDetails}
          savingEvent={savingEvent}
        />

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
