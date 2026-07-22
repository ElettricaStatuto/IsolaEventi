import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, Trash2, AlertTriangle, Eye, Search } from "lucide-react";
import { ButtonLegendGuide } from "./ButtonLegendGuide";

export interface AnalyzedEventsTableProps {
  previewEvents: any[];
  publishedEvents: any[];
  appliedAnFilters: { titolo: string; fonte: string; dataFrom: string; dataTo: string };
  selectedAnIds: Set<string>;
  setSelectedAnIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  imageUrl: (ev: any) => string | null;
  openEventDetails: (ev: any, isPending: boolean) => void;
  setPreviewEvents: React.Dispatch<React.SetStateAction<any[]>>;
  updatePreviewCache: (events: any[]) => void;
  deleteEvent: (id: number, scarta?: boolean) => void;
  handleAnAnalyzeAllFiltered: () => void;
  handleAnPublishAllFiltered: () => void;
  handleAnDeleteAllFiltered: (scarta?: boolean) => void;
  handleAnBulkAnalyze: () => void;
  handleAnBulkPubblica: () => void;
  handleAnBulkElimina: (scarta?: boolean) => void;
  anFilterTitolo: string;
  setAnFilterTitolo: (val: string) => void;
  anFilterFonte: string;
  setAnFilterFonte: (val: string) => void;
  anFilterDataFrom: string;
  setAnFilterDataFrom: (val: string) => void;
  anFilterDataTo: string;
  setAnFilterDataTo: (val: string) => void;
  applyAnFilters: () => void;
  clearAnFilters: () => void;
}

export const AnalyzedEventsTable: React.FC<AnalyzedEventsTableProps> = ({
  previewEvents,
  publishedEvents,
  appliedAnFilters,
  selectedAnIds,
  setSelectedAnIds,
  imageUrl,
  openEventDetails,
  setPreviewEvents,
  updatePreviewCache,
  deleteEvent,
  handleAnAnalyzeAllFiltered,
  handleAnPublishAllFiltered,
  handleAnDeleteAllFiltered,
  handleAnBulkAnalyze,
  handleAnBulkPubblica,
  handleAnBulkElimina,
  anFilterTitolo,
  setAnFilterTitolo,
  anFilterFonte,
  setAnFilterFonte,
  anFilterDataFrom,
  setAnFilterDataFrom,
  anFilterDataTo,
  setAnFilterDataTo,
  applyAnFilters,
  clearAnFilters,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const analyzedPreview = previewEvents
    .filter((ev) => (ev as any).testo_estratto)
    .map((ev) => ({ ...ev, is_pending: true, id_key: `prev-${ev.titolo}` }));
  const analyzedPublished = publishedEvents
    .filter((ev) => (ev as any).testo_estratto)
    .map((ev) => ({ ...ev, is_pending: false, id_key: `pub-${ev.id}` }));
  const allAnalyzed = [...analyzedPreview, ...analyzedPublished];

  const filteredAnalyzed = allAnalyzed.filter((ev) => {
    if (appliedAnFilters.titolo && !ev.titolo?.toLowerCase().includes(appliedAnFilters.titolo.toLowerCase())) return false;
    if (appliedAnFilters.fonte && !ev.fonte?.toLowerCase().includes(appliedAnFilters.fonte.toLowerCase())) return false;
    if (appliedAnFilters.dataFrom && ev.data_inizio && ev.data_inizio < appliedAnFilters.dataFrom) return false;
    if (appliedAnFilters.dataTo && ev.data_inizio && ev.data_inizio > appliedAnFilters.dataTo) return false;
    return true;
  });

  const futureAnalyzed = filteredAnalyzed.filter((ev) => !ev.data_inizio || ev.data_inizio >= todayStr);
  const pastAnalyzed = filteredAnalyzed.filter((ev) => ev.data_inizio && ev.data_inizio < todayStr);

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
                ? ev.sotto_eventi?.length || 0
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
                    <Badge
                      variant={ev.is_pending ? "secondary" : "default"}
                      className={ev.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}
                    >
                      {ev.is_pending ? "In Attesa" : "Pubblicato"}
                    </Badge>
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
                  <td className="p-2 font-medium">
                    <div className="flex flex-col gap-1 max-w-md">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm">{ev.titolo}</span>
                          {ev.dettagli_extra?.festival_padre && (
                            <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">
                              ★ {ev.dettagli_extra.festival_padre}
                            </span>
                          )}
                        </div>
                        {ev.categoria && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">
                            {ev.categoria}
                          </Badge>
                        )}
                        {ev.tags &&
                          Array.isArray(ev.tags) &&
                          ev.tags.map((t: string, ti: number) => (
                            <Badge key={ti} variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                              {t}
                            </Badge>
                          ))}
                      </div>
                      {(ev.testo_estratto || ev.dettagli_extra?.bio_artista_o_opera || ev.descrizione) && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-normal">
                          {ev.dettagli_extra?.bio_artista_o_opera || ev.testo_estratto || ev.descrizione}
                        </p>
                      )}
                      {ev.dettagli_extra?.orario_e_prezzi && (
                        <span className="text-[11px] text-amber-700 font-mono font-medium">
                          🎟️ {ev.dettagli_extra.orario_e_prezzi}
                        </span>
                      )}
                    </div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEventDetails(ev, ev.is_pending)}
                        className="h-7 text-xs px-2"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Dettagli
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Elimina"
                        onClick={() => {
                          if (ev.is_pending) {
                            const next = previewEvents.filter((e) => e.titolo !== ev.titolo);
                            setPreviewEvents(next);
                            updatePreviewCache(next);
                          } else {
                            deleteEvent(ev.id, false);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-orange-600 hover:bg-orange-50"
                        title="Elimina e scarta"
                        onClick={() => {
                          if (ev.is_pending) {
                            const next = previewEvents.filter((e) => e.titolo !== ev.titolo);
                            setPreviewEvents(next);
                            updatePreviewCache(next);
                          } else {
                            deleteEvent(ev.id, true);
                          }
                        }}
                      >
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Eventi Analizzati</CardTitle>
        <CardDescription>
          Visualizza tutti gli eventi che hanno una locandina analizzata e le relative informazioni estratte.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ButtonLegendGuide />

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
              <Button
                size="sm"
                className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleAnPublishAllFiltered}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Pubblica Tutti Filtrati ({filteredAnalyzed.length})
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={() => handleAnDeleteAllFiltered(false)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Tutti Filtrati ({filteredAnalyzed.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs px-3 bg-orange-600 hover:bg-orange-700 text-white border-none"
                onClick={() => handleAnDeleteAllFiltered(true)}
              >
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
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleAnBulkPubblica}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pubblica Selezionati
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleAnBulkElimina(false)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina Selezionati
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white border-none"
                  onClick={() => handleAnBulkElimina(true)}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Elimina & Scarta Selezionati
                </Button>
              </div>
            </div>
          )}

          {/* Filter Box per Analizzati */}
          <div className="flex flex-wrap gap-2 items-center bg-muted/50 p-2 rounded border border-border">
            <Input
              placeholder="Filtra titolo…"
              value={anFilterTitolo}
              onChange={(e) => setAnFilterTitolo(e.target.value)}
              className="h-8 text-xs w-40 bg-background"
            />
            <Input
              placeholder="Filtra fonte…"
              value={anFilterFonte}
              onChange={(e) => setAnFilterFonte(e.target.value)}
              className="h-8 text-xs w-32 bg-background"
            />
            <Input
              type="date"
              value={anFilterDataFrom}
              onChange={(e) => setAnFilterDataFrom(e.target.value)}
              className="h-8 text-xs w-32 bg-background"
            />
            <Input
              type="date"
              value={anFilterDataTo}
              onChange={(e) => setAnFilterDataTo(e.target.value)}
              className="h-8 text-xs w-32 bg-background"
            />
            <Button size="sm" className="h-8 text-xs px-3" onClick={applyAnFilters}>
              <Search className="w-3 h-3 mr-1" /> Applica
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={clearAnFilters}>
              Azzera
            </Button>
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
      </CardContent>
    </Card>
  );
};
