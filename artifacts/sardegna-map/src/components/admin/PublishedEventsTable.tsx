import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Trash2, AlertTriangle, Search, Eye } from "lucide-react";

export interface PublishedEventsTableProps {
  publishedEvents: any[];
  loadingPublished: boolean;
  selectedPubIds: Set<number>;
  setSelectedPubIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedPubAnalyzeIds: Set<number>;
  setSelectedPubAnalyzeIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleAnalyzeAllPublishedFiltered: () => void;
  handleDeleteAllPublishedFiltered: (scarta?: boolean) => void;
  aiProvider: "direct" | "replit";
  setAiProvider: (val: "direct" | "replit") => void;
  analysisTarget: "both" | "both_source" | "image" | "text" | "source_page";
  setAnalysisTarget: (val: any) => void;
  handleAnalyzePublished: () => void;
  analyzingStep: string;
  bulkDelete: (scarta?: boolean) => void;
  filterTitolo: string;
  setFilterTitolo: (val: string) => void;
  filterDataFrom: string;
  setFilterDataFrom: (val: string) => void;
  filterDataTo: string;
  setFilterDataTo: (val: string) => void;
  filterLuogo: string;
  setFilterLuogo: (val: string) => void;
  filterFonte: string;
  setFilterFonte: (val: string) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  imageUrl: (ev: any) => string | null;
  openEventDetails: (ev: any, isPending: boolean) => void;
  deleteEvent: (id: number, scarta?: boolean) => void;
}

export const PublishedEventsTable: React.FC<PublishedEventsTableProps> = ({
  publishedEvents,
  loadingPublished,
  selectedPubIds,
  setSelectedPubIds,
  selectedPubAnalyzeIds,
  setSelectedPubAnalyzeIds,
  handleAnalyzeAllPublishedFiltered,
  handleDeleteAllPublishedFiltered,
  aiProvider,
  setAiProvider,
  analysisTarget,
  setAnalysisTarget,
  handleAnalyzePublished,
  analyzingStep,
  bulkDelete,
  filterTitolo,
  setFilterTitolo,
  filterDataFrom,
  setFilterDataFrom,
  filterDataTo,
  setFilterDataTo,
  filterLuogo,
  setFilterLuogo,
  filterFonte,
  setFilterFonte,
  applyFilters,
  clearFilters,
  imageUrl,
  openEventDetails,
  deleteEvent,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const futurePublished = publishedEvents.filter((ev) => !ev.data_inizio || ev.data_inizio >= todayStr);
  const pastPublished = publishedEvents.filter((ev) => ev.data_inizio && ev.data_inizio < todayStr);

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
                      <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-medium max-w-xs">
                    {(() => {
                      const isFest = Boolean(
                        ev.is_festival ||
                        ev.dettagli_extra?.is_festival ||
                        (subCount > 0)
                      );

                      const titleEl = ev.link ? (
                        <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
                          {ev.titolo}
                        </a>
                      ) : (
                        <span className="font-bold text-foreground">{ev.titolo}</span>
                      );

                      return (
                        <div className="flex flex-col gap-1">
                          {titleEl}
                          {isFest && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black px-2 py-0.5 text-[11px] shadow-sm flex items-center gap-1 w-fit border border-amber-600">
                              ⭐ FESTIVAL
                            </Badge>
                          )}
                          {ev.testo_estratto && (
                            <Badge variant="outline" className="border-green-500 text-green-500 text-[10px] w-fit">
                              Analizzato
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEventDetails(ev, false)}
                        title="Vedi dettagli"
                        className="h-7 px-2 text-xs"
                      >
                        <Eye className="w-4 h-4 mr-1" /> Dettagli
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Elimina"
                        onClick={() => deleteEvent(ev.id, false)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Elimina e scarta"
                        onClick={() => deleteEvent(ev.id, true)}
                      >
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{publishedEvents.length} eventi pubblicati</CardTitle>
            <CardDescription>Gestisci gli eventi già sulla mappa. Filtra, seleziona ed elimina.</CardDescription>
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={handleAnalyzeAllPublishedFiltered}
            >
              <Brain className="w-3.5 h-3.5 mr-1" /> Analizza Tutti Filtrati ({publishedEvents.length})
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeleteAllPublishedFiltered(false)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({publishedEvents.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white border-none"
              onClick={() => handleDeleteAllPublishedFiltered(true)}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Elimina & Scarta Tutti ({publishedEvents.length})
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {(selectedPubIds.size > 0 || selectedPubAnalyzeIds.size > 0) && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            {selectedPubIds.size > 0 && <span className="text-sm font-medium">{selectedPubIds.size} da eliminare</span>}
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
            <Input
              type="date"
              value={filterDataFrom}
              onChange={(e) => setFilterDataFrom(e.target.value)}
              className="h-8 text-xs px-1 bg-background"
            />
            <Input
              type="date"
              value={filterDataTo}
              onChange={(e) => setFilterDataTo(e.target.value)}
              className="h-8 text-xs px-1 bg-background"
            />
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
      </CardContent>
    </Card>
  );
};
