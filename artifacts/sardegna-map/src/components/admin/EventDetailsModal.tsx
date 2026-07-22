import React, { useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { XCircle, Globe, Trash2, Brain, Calendar, MapPin, CheckCircle2, Loader2, Eye } from "lucide-react";

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
  publishedEvents?: any[];
  openEventDetails?: (ev: any, isPending: boolean) => void;
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
}) => {
  if (!inspectingEvent) return null;

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
              <div className="flex items-center gap-2">
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
                <div className="flex flex-col mt-1">
                  <CardTitle className="text-lg font-bold">{inspectingEvent.titolo}</CardTitle>
                  {parentEvent && openEventDetails ? (
                    <button
                      type="button"
                      onClick={() => openEventDetails(parentEvent.ev, parentEvent.isPending)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-md mt-1.5 transition-colors cursor-pointer w-fit"
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

          {/* Extracted Text */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Testo Estratto dalla Locandina
            </h4>
            {isEditingEvent ? (
              <AutoResizeTextarea
                value={inspectingEvent.testo_estratto || ""}
                onChange={(e: any) => setInspectingEvent({ ...inspectingEvent, testo_estratto: e.target.value })}
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
                        <button
                          onClick={() => setEditingTags((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-1 hover:text-red-500"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      placeholder="Nuovo tag..."
                      className="h-10 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-10 px-4"
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
                <div className="flex flex-wrap gap-2">
                  {inspectingEvent.tags && inspectingEvent.tags.length > 0 ? (
                    inspectingEvent.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Nessun tag</span>
                  )}
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
                  <div className="flex gap-2 items-center mt-3 border-t border-border pt-3">
                    <Input
                      value={newDettaglioKey}
                      onChange={(e) => setNewDettaglioKey(e.target.value)}
                      placeholder="Es. Artisti"
                      className="h-10 text-sm w-1/3"
                    />
                    <Input
                      value={newDettaglioValue}
                      onChange={(e) => setNewDettaglioValue(e.target.value)}
                      placeholder="Valore"
                      className="h-10 text-sm flex-1"
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
                <div className="flex flex-col gap-2">
                  {inspectingEvent.dettagli_extra && Object.keys(inspectingEvent.dettagli_extra).length > 0 ? (
                    Object.entries(inspectingEvent.dettagli_extra).map(([key, value]) => (
                      <div key={key} className="bg-muted/50 p-2 rounded border border-border/50 text-sm">
                        <span className="font-semibold text-foreground capitalize mr-2">{key.replace(/_/g, " ")}:</span>
                        <span className="text-muted-foreground">
                          {key === "_usage" && typeof value === "object" && value !== null
                            ? `Input: ${(value as any).input_tokens || 0} | Output: ${(value as any).output_tokens || 0} | Totale: ${(value as any).total_tokens || 0}`
                            : String(value)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Nessun dettaglio extra</span>
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
                    const newCards = inspectingEvent.sub_events_list.map((se: any) => ({
                      titolo: se.titolo,
                      data_inizio: se.data_inizio || inspectingEvent.data_inizio,
                      data_fine: se.data_fine || inspectingEvent.data_fine,
                      luogo: se.luogo || inspectingEvent.luogo,
                      latitudine: se.latitudine || inspectingEvent.latitudine,
                      longitudine: se.longitudine || inspectingEvent.longitudine,
                      link: se.link || inspectingEvent.link,
                      descrizione: se.descrizione || inspectingEvent.descrizione,
                      immagine: se.immagine || inspectingEvent.immagine,
                      fonte: inspectingEvent.fonte,
                      is_new: true,
                      testo_estratto: se.descrizione || inspectingEvent.testo_estratto,
                    }));
                    setPreviewEvents((prev) => [...prev, ...newCards]);
                    updatePreviewCache([...previewEvents, ...newCards]);
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
        </CardContent>

        <div className="p-4 border-t border-border flex flex-wrap items-center justify-end gap-3 bg-muted/20">
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
      </Card>
    </div>
  );
};
