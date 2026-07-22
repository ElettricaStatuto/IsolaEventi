import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Brain, CheckCircle2, Trash2, Search, Eye, Loader2 } from "lucide-react";
import { ButtonLegendGuide } from "./ButtonLegendGuide";

export interface PendingEventsTableProps {
  scrapingStep: "input" | "list" | "result";
  setScrapingStep: (step: "input" | "list" | "result") => void;
  previewEvents: any[];
  filteredPreviewEvents: { ev: any; i: number }[];
  selectedApproveIds: Set<number>;
  selectedAnalyzeIds: Set<number>;
  handleAnalyzeAllFiltered: () => void;
  handleApproveAllFiltered: () => void;
  handleDeleteAllFiltered: () => void;
  toggleApproveAll: (checked: boolean) => void;
  toggleAnalyzeAll: (checked: boolean) => void;
  prevFilterTitolo: string;
  setPrevFilterTitolo: (val: string) => void;
  prevFilterDataFrom: string;
  setPrevFilterDataFrom: (val: string) => void;
  prevFilterDataTo: string;
  setPrevFilterDataTo: (val: string) => void;
  prevFilterFonte: string;
  setPrevFilterFonte: (val: string) => void;
  applyPrevFilters: () => void;
  clearPrevFilters: () => void;
  toggleApproveOne: (i: number, checked: boolean) => void;
  toggleAnalyzeOne: (i: number, checked: boolean) => void;
  openEventDetails: (ev: any, isPending: boolean) => void;
  deletePreviewEvent: (i: number) => void;
  aiProvider: "direct" | "replit";
  setAiProvider: (provider: "direct" | "replit") => void;
  analysisTarget: "both" | "both_source" | "image" | "text" | "source_page";
  setAnalysisTarget: (target: any) => void;
  handleAnalyzePreview: () => void;
  analyzingStep: string;
  handleApprove: () => void;
  loadingPreview: boolean;
  approvalResult: any;
}

export const PendingEventsTable: React.FC<PendingEventsTableProps> = ({
  scrapingStep,
  setScrapingStep,
  previewEvents,
  filteredPreviewEvents,
  selectedApproveIds,
  selectedAnalyzeIds,
  handleAnalyzeAllFiltered,
  handleApproveAllFiltered,
  handleDeleteAllFiltered,
  toggleApproveAll,
  toggleAnalyzeAll,
  prevFilterTitolo,
  setPrevFilterTitolo,
  prevFilterDataFrom,
  setPrevFilterDataFrom,
  prevFilterDataTo,
  setPrevFilterDataTo,
  prevFilterFonte,
  setPrevFilterFonte,
  applyPrevFilters,
  clearPrevFilters,
  toggleApproveOne,
  toggleAnalyzeOne,
  openEventDetails,
  deletePreviewEvent,
  aiProvider,
  setAiProvider,
  analysisTarget,
  setAnalysisTarget,
  handleAnalyzePreview,
  analyzingStep,
  handleApprove,
  loadingPreview,
  approvalResult,
}) => {
  const [soloFestival, setSoloFestival] = React.useState(false);

  const displayedList = filteredPreviewEvents.filter(({ ev }) => {
    if (!soloFestival) return true;
    return Boolean(
      ev.is_festival ||
      ev.dettagli_extra?.is_festival ||
      (ev.sotto_eventi && ev.sotto_eventi.length > 0) ||
      previewEvents.some((child: any) => child.dettagli_extra?.parent_temp_id && child.dettagli_extra.parent_temp_id === ev.dettagli_extra?.id_key)
    );
  });

  return (
    <>
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
                    <span className="font-semibold text-blue-600">Filtrati: {displayedList.length}</span>
                    <span>|</span>
                    <span>Selezionati Pubblicazione: {selectedApproveIds.size}</span>
                    <span>|</span>
                    <span>Selezionati Analisi: {selectedAnalyzeIds.size}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={handleAnalyzeAllFiltered}
                    >
                      <Brain className="w-3.5 h-3.5 mr-1" /> Analizza Tutti Filtrati ({displayedList.length})
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleApproveAllFiltered}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approva Tutti Filtrati ({displayedList.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={handleDeleteAllFiltered}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({displayedList.length})
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Checkbox
                    checked={selectedApproveIds.size === previewEvents.length && previewEvents.length > 0}
                    onCheckedChange={(v) => toggleApproveAll(v === true)}
                    id="approve-all"
                  />
                  <Label htmlFor="approve-all" className="text-sm font-medium">
                    Seleziona tutti (Pubblicazione)
                  </Label>
                  <div className="mx-2 border-l h-4 border-border"></div>
                  <Checkbox
                    checked={selectedAnalyzeIds.size === previewEvents.length && previewEvents.length > 0}
                    onCheckedChange={(v) => toggleAnalyzeAll(v === true)}
                    id="analyze-all"
                  />
                  <Label htmlFor="analyze-all" className="text-sm font-medium">
                    Seleziona tutti (Analisi AI)
                  </Label>
                </div>

                <div className="overflow-hidden border rounded-md border-border">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0 z-10">
                        <tr className="border-b border-border">
                          <th className="w-10 px-4 py-3">Pubb.</th>
                          <th className="w-10 px-4 py-3">Anal.</th>
                          <th className="w-16 px-4 py-3">Img</th>
                          <th className="px-4 py-3 text-left">Titolo</th>
                          <th className="px-4 py-3 text-left">Data</th>
                          <th className="px-4 py-3 text-left">Fonte</th>
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
                            <div className="flex gap-1 justify-end items-center">
                              <Button
                                variant={soloFestival ? "default" : "outline"}
                                size="sm"
                                className={soloFestival ? "h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-600 shrink-0" : "h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 shrink-0"}
                                onClick={() => setSoloFestival(!soloFestival)}
                              >
                                ⭐ Solo Festival
                              </Button>
                              <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={applyPrevFilters}>
                                <Search className="w-3 h-3 mr-1" /> Filtra
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 shrink-0"
                                onClick={() => {
                                  clearPrevFilters();
                                  setSoloFestival(false);
                                }}
                              >
                                Azzera
                              </Button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              Nessun evento in attesa corrisponde ai filtri impostati.
                            </td>
                          </tr>
                        ) : (
                          displayedList.map(({ ev, i }) => (
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
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                                    N/D
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                <div className="flex flex-col gap-1">
                                  {(() => {
                                    const isFest = Boolean(
                                      ev.is_festival ||
                                      ev.dettagli_extra?.is_festival ||
                                      (ev.sotto_eventi && ev.sotto_eventi.length > 0) ||
                                      previewEvents.some((child: any) => child.dettagli_extra?.parent_temp_id && child.dettagli_extra.parent_temp_id === ev.dettagli_extra?.id_key)
                                    );

                                    return (
                                      <div className="flex flex-col gap-1">
                                        <span className="font-bold text-foreground text-sm">{ev.titolo}</span>
                                        {isFest && (
                                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black px-2 py-0.5 text-[11px] shadow-sm flex items-center gap-1 w-fit border border-amber-600">
                                            ⭐ FESTIVAL
                                          </Badge>
                                        )}
                                        {ev.dettagli_extra?.festival_padre && (
                                          <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">
                                            ★ {ev.dettagli_extra.festival_padre}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {ev.is_new && (
                                      <Badge variant="default" className="bg-blue-600 text-white">
                                        Nuovo
                                      </Badge>
                                    )}
                                    {ev.testo_estratto && (
                                      <Badge variant="outline" className="border-green-500 text-green-500">
                                        Analizzato
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {ev.data_inizio ? new Date(ev.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="bg-background">
                                  {ev.fonte}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEventDetails(ev, true)}
                                    title="Vedi dettagli"
                                    className="h-8 px-2 text-xs"
                                  >
                                    <Eye className="w-4 h-4 mr-1" /> Dettagli
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deletePreviewEvent(i)}
                                    title="Cestina evento"
                                  >
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
                  <Button variant="outline" onClick={() => setScrapingStep("input")}>
                    Annulla
                  </Button>
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
                  <Button onClick={handleApprove} disabled={loadingPreview || selectedApproveIds.size === 0}>
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
    </>
  );
};
