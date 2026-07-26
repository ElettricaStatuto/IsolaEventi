import React, { useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { XCircle, Globe, Trash2, Brain, Calendar, MapPin, CheckCircle2, Loader2, Eye, Clock, Sparkles, AlertTriangle } from "lucide-react";

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
      {...props}
    />
  );
};

export interface EventDetailsModalProps {
  inspectingEvent: any;
  setInspectingEvent: (ev: any | null) => void;
  isEditingEvent: boolean;
  setIsEditingEvent: (val: boolean) => void;
  imageUrl: (ev: any) => string | null;
  editingTags: string[];
  setEditingTags: React.Dispatch<React.SetStateAction<string[]>>;
  newTagValue: string;
  setNewTagValue: (val: string) => void;
  editingDettagli: Record<string, string>;
  setEditingDettagli: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  newDettaglioKey: string;
  setNewDettaglioKey: (val: string) => void;
  newDettaglioValue: string;
  setNewDettaglioValue: (val: string) => void;
  setPreviewEvents: React.Dispatch<React.SetStateAction<any[]>>;
  updatePreviewCache: (events: any[]) => void;
  previewEvents: any[];
  handlePublishAnalyzed: (payload: any[]) => Promise<void>;
  analysisTarget: "both" | "both_source" | "image" | "text" | "source_page";
  setAnalysisTarget: (target: any) => void;
  handleAnalyzeSingleFromModal: () => void;
  analyzingStep: string;
  handleAnalyzeGroupFromModal: () => void;
  handleSaveEventDetails: () => void;
  savingEvent: boolean;
  openEventDetails?: (ev: any, isPending: boolean) => void;
  adminKey?: string;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  inspectingEvent,
  setInspectingEvent,
  isEditingEvent,
  setIsEditingEvent,
  imageUrl,
  editingTags,
  setEditingTags,
  newTagValue,
  setNewTagValue,
  editingDettagli,
  setEditingDettagli,
  newDettaglioKey,
  setNewDettaglioKey,
  newDettaglioValue,
  setNewDettaglioValue,
  setPreviewEvents,
  updatePreviewCache,
  previewEvents,
  handlePublishAnalyzed,
  analysisTarget,
  setAnalysisTarget,
  handleAnalyzeSingleFromModal,
  analyzingStep,
  handleAnalyzeGroupFromModal,
  handleSaveEventDetails,
  savingEvent,
  publishedEvents = [],
  openEventDetails,
  adminKey,
}) => {
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [applyImageToChildren, setApplyImageToChildren] = React.useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!inspectingEvent) return null;

  const checkIsAiModified = (fieldName: string) => {
    if (fieldName === "testo_estratto" || fieldName === "tags") return true;
    const diario = inspectingEvent.dettagli_extra?.diario_di_bordo_ai || [];
    return diario.some((item: any) => item.campo_modificato === fieldName);
  };

  const aiHighlightedClass = "bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/40 p-4 rounded-lg border shadow-sm ring-1 ring-sky-300/10";

  // Trova eventuale evento Padre
  let parentEvent: { ev: any; isPending: boolean } | null = null;
  if (inspectingEvent.is_pending) {
    const pTempId = inspectingEvent.dettagli_extra?.parent_temp_id;
    if (pTempId) {
      const parentInPreview = previewEvents?.find((e) => e.dettagli_extra?.id_key === pTempId);
      if (parentInPreview) {
        parentEvent = { ev: parentInPreview, isPending: true };
      }
    }
    if (!parentEvent && inspectingEvent.dettagli_extra?.festival_padre) {
      const festName = inspectingEvent.dettagli_extra.festival_padre.toLowerCase();
      const mPrev = previewEvents?.find(
        (e) => e.titolo?.toLowerCase() === festName || e.dettagli_extra?.id_key?.toLowerCase() === festName
      );
      if (mPrev) {
        parentEvent = { ev: mPrev, isPending: true };
      } else {
        const mPub = publishedEvents?.find((e) => e.titolo?.toLowerCase() === festName);
        if (mPub) {
          parentEvent = { ev: mPub, isPending: false };
        }
      }
    }
  } else {
    if (inspectingEvent.parent_id) {
      const parentInPub = publishedEvents?.find((e) => e.id === inspectingEvent.parent_id);
      if (parentInPub) {
        parentEvent = { ev: parentInPub, isPending: false };
      }
    }
    if (!parentEvent && inspectingEvent.dettagli_extra?.festival_padre) {
      const festName = inspectingEvent.dettagli_extra.festival_padre.toLowerCase();
      const mPub = publishedEvents?.find((e) => e.titolo?.toLowerCase() === festName);
      if (mPub) {
        parentEvent = { ev: mPub, isPending: false };
      } else {
        const mPrev = previewEvents?.find((e) => e.titolo?.toLowerCase() === festName);
        if (mPrev) {
          parentEvent = { ev: mPrev, isPending: true };
        }
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="w-full mr-4">
              {(() => {
                const isFestival = Boolean(
                  inspectingEvent.is_festival ||
                  inspectingEvent.dettagli_extra?.is_festival ||
                  (inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0)
                );

                return (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={inspectingEvent.is_pending ? "secondary" : "default"}
                        className={inspectingEvent.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}
                      >
                        {inspectingEvent.is_pending ? "In Attesa" : "Pubblicato"}
                      </Badge>
                      <Badge variant="outline">{inspectingEvent.fonte}</Badge>
                    </div>
                    {isEditingEvent ? (
                      <Input
                        value={inspectingEvent.titolo}
                        onChange={(e) => setInspectingEvent({ ...inspectingEvent, titolo: e.target.value })}
                        className="text-lg font-bold mt-2 font-sans h-12 px-3"
                      />
                    ) : (
                      <div className="flex flex-col mt-1.5 gap-1">
                        <CardTitle className="text-lg font-bold">{inspectingEvent.titolo}</CardTitle>
                        {isFestival && (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs px-2.5 py-0.5 shadow border border-amber-600 w-fit">
                            ⭐ FESTIVAL / EVENTO PADRE
                          </Badge>
                        )}
                        {parentEvent && openEventDetails ? (
                          <button
                            type="button"
                            onClick={() => openEventDetails(parentEvent.ev, parentEvent.isPending)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-md mt-1 transition-colors cursor-pointer w-fit"
                            title="Clicca per aprire la scheda dell'evento Padre"
                          >
                            ★ Evento Padre: {parentEvent.ev.titolo} (Apri Scheda Padre →)
                          </button>
                        ) : inspectingEvent.dettagli_extra?.festival_padre ? (
                          <span className="text-xs font-medium text-amber-600 uppercase tracking-wide mt-1">
                            ★ {inspectingEvent.dettagli_extra.festival_padre}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </>
                );
              })()}
              <CardDescription className="mt-1">
                {inspectingEvent.data_inizio ? new Date(inspectingEvent.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                {inspectingEvent.data_fine && inspectingEvent.data_fine !== inspectingEvent.data_inizio
                  ? ` - ${new Date(inspectingEvent.data_fine).toLocaleDateString("it-IT")}`
                  : ""}
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={() => setInspectingEvent(null)} className="h-8 w-8 p-0 shrink-0">
              <XCircle className="w-6 h-6 text-muted-foreground" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Image & Description */}
          <div className="flex flex-col sm:flex-row gap-6">
            
            {/* Left Column: Image + Upload */}
            <div className="flex flex-col gap-3 shrink-0 w-full sm:w-64">
              {inspectingEvent.immagine ? (
                <div className="relative w-full h-48 sm:h-auto group">
                  <img
                    src={inspectingEvent.immagine}
                    alt={inspectingEvent.titolo}
                    className={`w-full aspect-[4/3] object-cover rounded-md border transition-all ${
                      inspectingEvent.dettagli_extra?.immagine_pulita_e_pubblicabile === false
                        ? "border-red-600 border-2 shadow-md shadow-red-100 dark:shadow-red-950/20"
                        : ""
                    }`}
                  />
                  {inspectingEvent.dettagli_extra?.immagine_pulita_e_pubblicabile === false && (
                    <div className="absolute top-2 left-2">
                      <div className="bg-red-600 text-white p-1.5 rounded-full shadow-md cursor-help flex items-center justify-center animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute left-0 top-8 hidden group-hover:block bg-red-600 text-white text-[11px] leading-relaxed p-2.5 rounded-md shadow-xl z-50 w-60 border border-red-500 font-sans">
                        <p className="font-bold flex items-center gap-1 mb-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Qualità Immagine Bassa
                        </p>
                        <p className="text-white/90">
                          {inspectingEvent.dettagli_extra?.motivo_immagine_non_pulita ||
                            "L'AI ha rilevato che questa immagine potrebbe essere una foto cartacea sgranata o poco chiara."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center rounded-md border text-muted-foreground text-xs shrink-0">
                  Nessuna Immagine
                </div>
              )}
              
              {isEditingEvent && (
                <div className="flex flex-col gap-2 w-full">
                  <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !adminKey) return;
                  
                  setIsUploadingImage(true);
                  const formData = new FormData();
                  formData.append("file", file);
                  
                  try {
                    const res = await fetch("/api/events/upload-image", {
                      method: "POST",
                      headers: { "x-admin-key": adminKey },
                      body: formData,
                    });
                    const data = await res.json();
                    if (data.success) {
                      setInspectingEvent({ ...inspectingEvent, immagine: data.fileName, _apply_image_to_children: applyImageToChildren });
                    } else {
                      alert("Errore caricamento immagine: " + (data.error || data.message));
                    }
                  } catch (err) {
                    alert("Errore rete caricamento immagine.");
                  } finally {
                    setIsUploadingImage(false);
                  }
                }}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage || !adminKey}
              >
                {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                Cambia Foto
              </Button>
              
              {(inspectingEvent.is_festival || (inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0) || inspectingEvent.sotto_eventi?.length > 0) && (
                <label className="flex items-start gap-1.5 text-[10px] text-muted-foreground cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={applyImageToChildren}
                    onChange={(e) => {
                      setApplyImageToChildren(e.target.checked);
                      setInspectingEvent({ ...inspectingEvent, _apply_image_to_children: e.target.checked });
                    }}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span>Applica anche a tutti i sotto-eventi associati</span>
                </label>
              )}
            </div>
            )}

            {/* Tags (Evidenziati AI) */}
            <div className={`${aiHighlightedClass} mt-2`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider">Tags</h4>
                <Badge variant="outline" className="text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700/60 font-semibold flex items-center gap-0.5">
                  <span>🤖</span>
                  <span>AI</span>
                </Badge>
              </div>
              {isEditingEvent ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {editingTags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-[10px]">
                        {tag}
                        <button
                          onClick={() => setEditingTags((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-1 hover:text-red-500"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Input
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      placeholder="Nuovo tag..."
                      className="h-8 text-xs bg-background"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs px-2"
                      onClick={() => {
                        if (newTagValue.trim()) {
                          setEditingTags((prev) => [...prev, newTagValue.trim()]);
                          setNewTagValue("");
                        }
                      }}
                    >
                      Aggiungi
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {inspectingEvent.tags && inspectingEvent.tags.length > 0 ? (
                    inspectingEvent.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-sky-100/80 text-sky-900 border border-sky-300/40 text-[10px] px-1.5 py-0.5">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-sky-900/60 italic">Nessun tag</span>
                  )}
                </div>
              )}
            </div>
          </div>
            
          <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Descrizione Originale
                </h4>
                {isEditingEvent ? (
                  <AutoResizeTextarea
                    value={inspectingEvent.descrizione || ""}
                    onChange={(e: any) => setInspectingEvent({ ...inspectingEvent, descrizione: e.target.value })}
                    className="w-full min-h-[144px] text-sm bg-background border border-input rounded-md p-3 leading-relaxed"
                  />
                ) : (
                  <p className="text-sm text-foreground line-clamp-6 leading-relaxed">
                    {inspectingEvent.descrizione || "Nessuna descrizione fornita."}
                  </p>
                )}
              </div>
              {inspectingEvent.link && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Sito Fonte (Riservato Admin)
                  </h4>
                  <a
                    href={inspectingEvent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                  >
                    <Globe className="w-3.5 h-3.5" /> Apri Sito Fonte
                  </a>
                </div>
              )}
              {(isEditingEvent || inspectingEvent.link_organizzatore) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Sito Organizzatore
                  </h4>
                  {isEditingEvent ? (
                    <Input
                      value={inspectingEvent.link_organizzatore || ""}
                      onChange={(e) => setInspectingEvent({ ...inspectingEvent, link_organizzatore: e.target.value })}
                      className="h-10 text-xs font-mono px-3"
                      placeholder="https://..."
                    />
                  ) : (
                    <a
                      href={inspectingEvent.link_organizzatore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-600 hover:underline flex items-center gap-1 w-fit font-medium"
                    >
                      <Globe className="w-3.5 h-3.5" /> Apri Sito Organizzatore
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date e Luogo (Evidenziati se modificati dall'AI) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Luogo */}
            <div className={checkIsAiModified("luogo") ? aiHighlightedClass : "p-4 rounded-lg border border-border bg-card"}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-semibold uppercase tracking-wider ${checkIsAiModified("luogo") ? "text-sky-950 dark:text-sky-200 font-bold" : "text-muted-foreground"}`}>
                  Luogo Evento
                </h4>
                {checkIsAiModified("luogo") && (
                  <Badge variant="outline" className="text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700/60 font-semibold flex items-center gap-0.5">
                    <span>🤖</span>
                    <span>Modificato da AI</span>
                  </Badge>
                )}
              </div>
              {isEditingEvent ? (
                <Input
                  value={inspectingEvent.luogo || ""}
                  onChange={(e) => setInspectingEvent({ ...inspectingEvent, luogo: e.target.value })}
                  className="h-10 text-sm bg-background"
                  placeholder="Comune, Luogo Specifico"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold">{inspectingEvent.luogo || "Non specificato"}</span>
                </div>
              )}
            </div>

            {/* Date */}
            <div className={(checkIsAiModified("data_inizio") || checkIsAiModified("data_fine")) ? aiHighlightedClass : "p-4 rounded-lg border border-border bg-card"}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-semibold uppercase tracking-wider ${(checkIsAiModified("data_inizio") || checkIsAiModified("data_fine")) ? "text-sky-950 dark:text-sky-200 font-bold" : "text-muted-foreground"}`}>
                  Date di Svolgimento
                </h4>
                {(checkIsAiModified("data_inizio") || checkIsAiModified("data_fine")) && (
                  <Badge variant="outline" className="text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700/60 font-semibold flex items-center gap-0.5">
                    <span>🤖</span>
                    <span>Modificato da AI</span>
                  </Badge>
                )}
              </div>
              {isEditingEvent ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Inizio</span>
                    <Input
                      type="date"
                      value={inspectingEvent.data_inizio || ""}
                      onChange={(e) => setInspectingEvent({ ...inspectingEvent, data_inizio: e.target.value })}
                      className="h-9 text-xs bg-background mt-0.5"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Fine</span>
                    <Input
                      type="date"
                      value={inspectingEvent.data_fine || ""}
                      onChange={(e) => setInspectingEvent({ ...inspectingEvent, data_fine: e.target.value })}
                      className="h-9 text-xs bg-background mt-0.5"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold">
                      {inspectingEvent.data_inizio ? new Date(inspectingEvent.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                      {inspectingEvent.data_fine && inspectingEvent.data_fine !== inspectingEvent.data_inizio
                        ? ` - ${new Date(inspectingEvent.data_fine).toLocaleDateString("it-IT")}`
                        : ""}
                    </span>
                  </div>
                  {inspectingEvent.dettagli_extra?.ora_inizio && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        Inizia alle ore <strong className="text-foreground">{inspectingEvent.dettagli_extra.ora_inizio}</strong>
                        {inspectingEvent.dettagli_extra.ora_fine && (
                          <> fino alle <strong className="text-foreground">{inspectingEvent.dettagli_extra.ora_fine}</strong></>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Extracted Text (Articolo Mappa) */}
          <div className={aiHighlightedClass}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider">
                Articolo di Mappa (Testo Estratto)
              </h4>
              <Badge variant="outline" className="text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700/60 font-semibold flex items-center gap-0.5">
                <span>🤖</span>
                <span>Scritto da AI</span>
              </Badge>
            </div>
            {isEditingEvent ? (
              <AutoResizeTextarea
                value={inspectingEvent.testo_estratto || ""}
                onChange={(e: any) => setInspectingEvent({ ...inspectingEvent, testo_estratto: e.target.value })}
                className="w-full bg-background p-3 rounded-md text-sm border min-h-48 focus:outline-none leading-relaxed"
              />
            ) : (
              <div className="bg-background/80 p-3 rounded-md text-sm max-h-64 overflow-y-auto border whitespace-pre-wrap leading-relaxed text-foreground/90">
                {inspectingEvent.testo_estratto || "Nessun articolo generato."}
              </div>
            )}
          </div>

          {/* Dettagli Extra (Evidenziati AI - Full Width) */}
          <div className="border-t border-border pt-4">
            <div className={aiHighlightedClass}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider">Dettagli Extra</h4>
                <Badge variant="outline" className="text-[10px] bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700/60 font-semibold flex items-center gap-0.5">
                  <span>🤖</span>
                  <span>Estratti da AI</span>
                </Badge>
              </div>
              {isEditingEvent ? (
                <div className="flex flex-col gap-3">
                  {Object.entries(editingDettagli)
                    .filter(([key]) => key !== "diario_di_bordo_ai" && key !== "metadati_operazioni" && key !== "_usage")
                    .map(([key, value]) => (
                      <div key={key} className="flex gap-2 items-start">
                        <Input value={key} disabled className="h-10 text-sm w-1/3 bg-muted font-semibold mt-0.5" />
                        {String(value).length > 60 || key.toLowerCase().includes("bio") ? (
                          <AutoResizeTextarea
                            value={value as string}
                            onChange={(e: any) => setEditingDettagli((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="text-sm bg-background border border-input rounded-md p-3 flex-1 min-h-[120px] leading-relaxed"
                          />
                        ) : (
                          <Input
                            value={value as string}
                            onChange={(e) => setEditingDettagli((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="h-10 text-sm flex-1 mt-0.5 px-3"
                          />
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 mt-0.5 text-destructive"
                          onClick={() => {
                            const next = { ...editingDettagli };
                            delete next[key];
                            setEditingDettagli(next);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  <div className="flex gap-2 items-center mt-3 border-t border-sky-300/30 pt-3">
                    <Input
                      value={newDettaglioKey}
                      onChange={(e) => setNewDettaglioKey(e.target.value)}
                      placeholder="Es. Artisti"
                      className="h-10 text-sm w-1/3 bg-background"
                    />
                    <Input
                      value={newDettaglioValue}
                      onChange={(e) => setNewDettaglioValue(e.target.value)}
                      placeholder="Valore"
                      className="h-10 text-sm flex-1 bg-background"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-10 px-4"
                      onClick={() => {
                        if (newDettaglioKey.trim() && newDettaglioValue.trim()) {
                          setEditingDettagli((prev) => ({ ...prev, [newDettaglioKey.trim()]: newDettaglioValue.trim() }));
                          setNewDettaglioKey("");
                          setNewDettaglioValue("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {inspectingEvent.dettagli_extra &&
                  Object.keys(inspectingEvent.dettagli_extra).filter(
                    (key) => key !== "diario_di_bordo_ai" && key !== "metadati_operazioni" && key !== "_usage"
                  ).length > 0 ? (
                    Object.entries(inspectingEvent.dettagli_extra)
                      .filter(
                        ([key]) => key !== "diario_di_bordo_ai" && key !== "metadati_operazioni" && key !== "_usage"
                      )
                      .map(([key, value]) => (
                        <div key={key} className="bg-background/70 p-2.5 rounded border border-sky-200/50 text-xs leading-relaxed">
                          <span className="font-semibold text-sky-950 dark:text-sky-200 capitalize mr-2">{key.replace(/_/g, " ")}:</span>
                          <span className="text-foreground/90">{String(value)}</span>
                        </div>
                      ))
                  ) : (
                    <span className="text-sm text-sky-900/60 italic">Nessun dettaglio extra</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sub-events (Sotto-eventi) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sotto-eventi Rilevati ({inspectingEvent.sub_events_list?.length || 0})
              </h4>
              {inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0 && inspectingEvent.is_pending && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    // Genera o recupera id_key del padre per associare i figli
                    const parentIdKey = inspectingEvent.dettagli_extra?.id_key || `temp_parent_${Math.random().toString(36).substring(2, 10)}`;
                    
                    // Se il padre non aveva dettagli_extra o id_key, aggiorniamo il padre
                    let updatedInspectingEvent = { ...inspectingEvent };
                    if (!inspectingEvent.dettagli_extra || !inspectingEvent.dettagli_extra.id_key) {
                      updatedInspectingEvent.dettagli_extra = {
                        ...(inspectingEvent.dettagli_extra || {}),
                        id_key: parentIdKey
                      };
                      
                      // Aggiorna il padre nella lista preview locale
                      const idxStr = inspectingEvent.tmp_id;
                      const idx = typeof inspectingEvent.idx === 'number' ? inspectingEvent.idx : parseInt(idxStr, 10);
                      if (!isNaN(idx) && previewEvents[idx]) {
                        const nextEvents = [...previewEvents];
                        nextEvents[idx] = updatedInspectingEvent;
                        setPreviewEvents(nextEvents);
                        updatePreviewCache(nextEvents);
                      }
                      setInspectingEvent(updatedInspectingEvent);
                    }

                    const newCards = inspectingEvent.sub_events_list.map((se: any) => ({
                      titolo: se.titolo,
                      data_inizio: se.data_inizio || updatedInspectingEvent.data_inizio,
                      data_fine: se.data_fine || updatedInspectingEvent.data_fine || se.data_inizio || updatedInspectingEvent.data_inizio,
                      luogo: se.luogo || updatedInspectingEvent.luogo,
                      latitudine: se.latitudine || updatedInspectingEvent.latitudine,
                      longitudine: se.longitudine || updatedInspectingEvent.longitudine,
                      link: se.link || updatedInspectingEvent.link,
                      descrizione: se.descrizione || updatedInspectingEvent.descrizione || "",
                      immagine: se.immagine || updatedInspectingEvent.immagine,
                      fonte: updatedInspectingEvent.fonte,
                      is_new: true,
                      testo_estratto: se.descrizione || updatedInspectingEvent.testo_estratto || "",
                      dettagli_extra: {
                        festival_padre: updatedInspectingEvent.titolo,
                        is_extracted: true,
                        id_key: `temp_${Math.random().toString(36).substring(2, 10)}`,
                        parent_temp_id: parentIdKey,
                        metodo_estrazione: "UI Extractor (Genera Card Figlie)"
                      }
                    }));
                    
                    // Aggiungiamo i figli alle preview events
                    setPreviewEvents((prev) => {
                      const next = [...prev, ...newCards];
                      updatePreviewCache(next);
                      return next;
                    });
                    
                    alert(`Generati ${newCards.length} nuovi eventi singoli in In Attesa!`);
                  }}
                >
                  <Brain className="w-3.5 h-3.5 mr-1" /> Genera Card Singole in "In Attesa"
                </Button>
              )}
            </div>
            {inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0 ? (
              <div className="flex flex-col gap-2">
                {inspectingEvent.sub_events_list.map((se: any, idx: number) => (
                  <div key={idx} className="p-3 bg-muted/40 rounded-lg border border-border/50 text-sm">
                    <div className="flex flex-col">
                      <div className="font-semibold text-foreground">{se.titolo}</div>
                      {se.dettagli_extra?.festival_padre && (
                        <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wide mt-0.5">
                          ★ {se.dettagli_extra.festival_padre}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 items-center justify-between">
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {se.data_inizio ? new Date(se.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                          {se.data_fine && se.data_fine !== se.data_inizio
                            ? ` - ${new Date(se.data_fine).toLocaleDateString("it-IT")}`
                            : ""}
                        </span>
                        {se.luogo && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {se.luogo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2"
                          onClick={async () => {
                            const singlePayload = {
                              titolo: se.titolo,
                              data_inizio: se.data_inizio || inspectingEvent.data_inizio,
                              data_fine: se.data_fine || inspectingEvent.data_fine,
                              luogo: se.luogo || inspectingEvent.luogo,
                              link: se.link || inspectingEvent.link,
                              descrizione: se.descrizione || inspectingEvent.descrizione,
                              immagine: se.immagine || inspectingEvent.immagine,
                              fonte: inspectingEvent.fonte,
                            };
                            await handlePublishAnalyzed([singlePayload]);
                            alert(`Sotto-evento '${se.titolo}' pubblicato con successo!`);
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" /> Pubblica Singolo
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nessun sotto-evento rilevato o inserito.</p>
            )}
          </div>

          {/* Diario delle Deduzioni AI */}
          {inspectingEvent.dettagli_extra?.diario_di_bordo_ai && inspectingEvent.dettagli_extra.diario_di_bordo_ai.length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-sky-500" />
                Diario delle Deduzioni AI
              </h4>
              <div className="flex flex-col gap-2.5">
                {inspectingEvent.dettagli_extra.diario_di_bordo_ai.map((item: any, idx: number) => (
                  <div key={idx} className="bg-sky-50/40 dark:bg-sky-950/10 border border-sky-100 dark:border-sky-900/30 rounded-lg p-3 text-xs leading-relaxed">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <span className="bg-sky-200/60 dark:bg-sky-900 text-sky-900 dark:text-sky-200 px-1.5 py-0.5 rounded uppercase text-[9px] tracking-wider border border-sky-300/40">
                        {item.campo_modificato?.replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-white dark:bg-card text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                        {item.tipo_intervento}
                      </Badge>
                    </div>
                    <p className="text-foreground/80 italic">"{item.motivazione}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <div className="p-4 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {inspectingEvent.dettagli_extra?.metadati_operazioni?.modello_utilizzato && (
              <span>Modello: <strong className="text-foreground">{inspectingEvent.dettagli_extra.metadati_operazioni.modello_utilizzato}</strong></span>
            )}
            {inspectingEvent.dettagli_extra?._usage && (
              <>
                {inspectingEvent.dettagli_extra?.metadati_operazioni?.modello_utilizzato && <span className="text-border">|</span>}
                <span>
                  Token: <strong className="text-foreground">{inspectingEvent.dettagli_extra._usage.total_tokens || inspectingEvent.dettagli_extra._usage.total || 0}</strong>
                  <span className="opacity-80">
                    {" "}(in: {inspectingEvent.dettagli_extra._usage.prompt_tokens || inspectingEvent.dettagli_extra._usage.input || 0} • 
                    out: {inspectingEvent.dettagli_extra._usage.candidates_tokens || inspectingEvent.dettagli_extra._usage.output || 0})
                  </span>
                </span>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
          {!isEditingEvent && (
            <>
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
              <Button variant="secondary" size="sm" onClick={handleAnalyzeSingleFromModal} disabled={analyzingStep !== "idle"}>
                {analyzingStep === "preview" || analyzingStep === "published" ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-1" />
                )}
                Analizza
              </Button>

              {inspectingEvent.is_pending && inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalyzeGroupFromModal}
                  disabled={analyzingStep !== "idle"}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                >
                  <Brain className="w-4 h-4 mr-1" /> Analizza Padre + {inspectingEvent.sub_events_list.length} Figli
                </Button>
              )}
            </>
          )}

          {isEditingEvent ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingEvent(false);
                  setEditingTags(inspectingEvent.tags || []);
                  setEditingDettagli(inspectingEvent.dettagli_extra || {});
                }}
              >
                Annulla
              </Button>
              <Button onClick={handleSaveEventDetails} disabled={savingEvent}>
                {savingEvent && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salva Modifiche
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingEvent(true)}>
                Modifica Dettagli
              </Button>
              <Button size="sm" onClick={() => setInspectingEvent(null)}>
                Chiudi
              </Button>
            </>
          )}
          </div>
        </div>
      </Card>
    </div>
  );
};
