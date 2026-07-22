import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Search, CheckCircle2, Brain, XCircle, Upload } from "lucide-react";

export interface ScraperPanelProps {
  selectedSources: string[];
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  loadingPreview: boolean;
  keyVerified: boolean;
  handlePreview: () => void;
  genericUrl: string;
  setGenericUrl: (url: string) => void;
  handleScrapeUrl: () => void;
  scrapingGeneric: boolean;
  maxLinksUrl: number | "";
  setMaxLinksUrl: (val: number | "") => void;
  forceFestival: boolean;
  setForceFestival: (val: boolean) => void;
  urlScrapedEvents: any[];
  setUrlScrapedEvents: (events: any[]) => void;
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  uploadingPdf: boolean;
  handleUploadPdf: () => void;
  scrapingLogs: string[];
}

export const ScraperPanel: React.FC<ScraperPanelProps> = ({
  selectedSources,
  setSelectedSources,
  loadingPreview,
  keyVerified,
  handlePreview,
  genericUrl,
  setGenericUrl,
  handleScrapeUrl,
  scrapingGeneric,
  maxLinksUrl,
  setMaxLinksUrl,
  forceFestival,
  setForceFestival,
  urlScrapedEvents,
  setUrlScrapedEvents,
  pdfFile,
  setPdfFile,
  uploadingPdf,
  handleUploadPdf,
  scrapingLogs,
}) => {
  return (
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
                <Checkbox
                  id="src-paradisola"
                  checked={selectedSources.includes("paradisola")}
                  onCheckedChange={(checked) =>
                    setSelectedSources((prev) =>
                      checked ? [...prev, "paradisola"] : prev.filter((x) => x !== "paradisola")
                    )
                  }
                />
                <Label htmlFor="src-paradisola" className="text-sm font-medium cursor-pointer">
                  Paradisola (paradisola.it)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="src-sardegnaturismo"
                  checked={selectedSources.includes("sardegnaturismo")}
                  onCheckedChange={(checked) =>
                    setSelectedSources((prev) =>
                      checked ? [...prev, "sardegnaturismo"] : prev.filter((x) => x !== "sardegnaturismo")
                    )
                  }
                />
                <Label htmlFor="src-sardegnaturismo" className="text-sm font-medium cursor-pointer">
                  Sardegna Turismo (sardegnaturismo.it)
                </Label>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <span className="text-xs font-bold text-foreground">EventiInSardegna.it</span>
                <div className="flex flex-col gap-2 pl-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="src-eis-calendar"
                      checked={selectedSources.includes("eventiinsardegna_calendar")}
                      onCheckedChange={(checked) =>
                        setSelectedSources((prev) =>
                          checked ? [...prev, "eventiinsardegna_calendar"] : prev.filter((x) => x !== "eventiinsardegna_calendar")
                        )
                      }
                    />
                    <Label htmlFor="src-eis-calendar" className="text-sm font-normal cursor-pointer text-muted-foreground">
                      Calendario Generale
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="src-eis-alghero"
                      checked={selectedSources.includes("eventiinsardegna_alghero")}
                      onCheckedChange={(checked) =>
                        setSelectedSources((prev) =>
                          checked ? [...prev, "eventiinsardegna_alghero"] : prev.filter((x) => x !== "eventiinsardegna_alghero")
                        )
                      }
                    />
                    <Label htmlFor="src-eis-alghero" className="text-sm font-normal cursor-pointer text-muted-foreground">
                      Tag: Alghero
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="src-eis-cagliari"
                      checked={selectedSources.includes("eventiinsardegna_cagliari")}
                      onCheckedChange={(checked) =>
                        setSelectedSources((prev) =>
                          checked ? [...prev, "eventiinsardegna_cagliari"] : prev.filter((x) => x !== "eventiinsardegna_cagliari")
                        )
                      }
                    />
                    <Label htmlFor="src-eis-cagliari" className="text-sm font-normal cursor-pointer text-muted-foreground">
                      Tag: Cagliari
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="src-eis-centro"
                      checked={selectedSources.includes("eventiinsardegna_centro")}
                      onCheckedChange={(checked) =>
                        setSelectedSources((prev) =>
                          checked ? [...prev, "eventiinsardegna_centro"] : prev.filter((x) => x !== "eventiinsardegna_centro")
                        )
                      }
                    />
                    <Label htmlFor="src-eis-centro" className="text-sm font-normal cursor-pointer text-muted-foreground">
                      Tag: Centro Sardegna
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="src-eis-agosto"
                      checked={selectedSources.includes("eventiinsardegna_agosto")}
                      onCheckedChange={(checked) =>
                        setSelectedSources((prev) =>
                          checked ? [...prev, "eventiinsardegna_agosto"] : prev.filter((x) => x !== "eventiinsardegna_agosto")
                        )
                      }
                    />
                    <Label htmlFor="src-eis-agosto" className="text-sm font-normal cursor-pointer text-muted-foreground">
                      Categoria: Agosto
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COLONNA DESTRA: FESTIVAL ── */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">🎪 Festival</span>
              <p className="text-xs text-muted-foreground -mt-1">
                Gli eventi estratti da questi siti vengono raggruppati automaticamente come concerti figli del festival.
              </p>

              <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md p-3">
                <Checkbox
                  id="src-timeinjazz"
                  checked={selectedSources.includes("timeinjazz")}
                  onCheckedChange={(checked) =>
                    setSelectedSources((prev) =>
                      checked ? [...prev, "timeinjazz"] : prev.filter((x) => x !== "timeinjazz")
                    )
                  }
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="src-timeinjazz" className="text-sm font-semibold cursor-pointer text-orange-700 dark:text-orange-400">
                    Time in Jazz 2026
                  </Label>
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
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping in corso…
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" /> Avvia Scraper ({selectedSources.length})
            </>
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
                <label htmlFor="max-links" className="font-medium">
                  Max Link Deep-Scrape:
                </label>
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
            <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {urlScrapedEvents.length === 1 ? "1 evento estratto con successo!" : `${urlScrapedEvents.length} eventi estratti con successo!`}
              </span>
              {urlScrapedEvents[0]?.dettagli_extra?._usage && (
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-md border border-amber-300 flex items-center gap-1.5 shadow-sm">
                  <Brain className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    Consumo AI: Input {urlScrapedEvents[0].dettagli_extra._usage.prompt_tokens || urlScrapedEvents[0].dettagli_extra._usage.input_tokens || 0} | Output {urlScrapedEvents[0].dettagli_extra._usage.candidates_tokens || urlScrapedEvents[0].dettagli_extra._usage.output_tokens || 0} | Totale {urlScrapedEvents[0].dettagli_extra._usage.total_tokens || 0} Token
                  </span>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground h-7"
                onClick={() => {
                  setUrlScrapedEvents([]);
                  setGenericUrl("");
                }}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Chiudi
              </Button>
            </div>

            {urlScrapedEvents.map((ev, i) => (
              <div
                key={i}
                className={`border rounded-xl overflow-hidden shadow-sm ${
                  ev.is_festival ? "border-orange-300 bg-orange-50/40" : "border-border bg-card"
                }`}
              >
                <div className="flex gap-3 p-4">
                  {ev.immagine && (
                    <img
                      src={ev.immagine}
                      alt={ev.titolo}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0 border border-border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {ev.is_festival && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                          Festival
                        </Badge>
                      )}
                      {ev.categoria && <Badge variant="outline">{ev.categoria}</Badge>}
                      {ev.dettagli_extra?._usage && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1 text-[11px] font-mono"
                        >
                          <Brain className="w-3 h-3 text-amber-600" />
                          ⚡ Token AI: {ev.dettagli_extra._usage.total_tokens || 0} (In:{" "}
                          {ev.dettagli_extra._usage.prompt_tokens || ev.dettagli_extra._usage.input_tokens || 0}, Out:{" "}
                          {ev.dettagli_extra._usage.candidates_tokens || ev.dettagli_extra._usage.output_tokens || 0})
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-foreground leading-snug">{ev.titolo}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {ev.luogo || "Sardegna"} | 📅 {ev.data_inizio} {ev.data_fine ? `- ${ev.data_fine}` : ""}
                    </p>
                    {ev.descrizione && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ev.descrizione}</p>}
                  </div>
                </div>
                {ev.sotto_eventi && ev.sotto_eventi.length > 0 && (
                  <div className="bg-orange-50/70 border-t border-orange-200/60 p-3 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-orange-900 uppercase tracking-wider">
                      Sotto-eventi ({ev.sotto_eventi.length})
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {ev.sotto_eventi.map((sub: any, si: number) => (
                        <div
                          key={si}
                          className="flex flex-col gap-2 text-xs text-foreground bg-white/60 rounded-md px-2 py-1.5 border border-orange-100"
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-orange-700 flex-shrink-0 min-w-[90px]">
                              {sub.data_inizio || "-"}
                            </span>
                            <span className="flex-1 leading-snug">{sub.titolo}</span>
                            {sub.luogo && (
                              <span className="text-muted-foreground flex-shrink-0 truncate max-w-[120px]">
                                {sub.luogo}
                              </span>
                            )}
                          </div>
                          {(sub.descrizione || sub.url) && (
                            <details className="group cursor-pointer">
                              <summary className="text-[10px] text-orange-600 font-semibold uppercase hover:underline">
                                Dettagli
                              </summary>
                              <div className="pt-2 pb-1 text-muted-foreground text-xs leading-relaxed border-t border-orange-100 mt-2">
                                {sub.url && (
                                  <p className="mb-1 truncate">
                                    <a href={sub.url} target="_blank" className="text-blue-500 hover:underline">
                                      Link: {sub.url}
                                    </a>
                                  </p>
                                )}
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
          <p className="text-sm text-muted-foreground">
            Carica un PDF (es. locandina testuale o programma) per estrarne automaticamente gli eventi e le date.
          </p>
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
            <Button onClick={handleUploadPdf} disabled={uploadingPdf || !keyVerified || !pdfFile}>
              {uploadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Carica PDF
            </Button>
          </div>
        </div>
        {scrapingLogs.length > 0 && (
          <div className="mt-4 bg-[#1e1e1e] text-green-400 p-4 rounded-md font-mono text-xs max-h-64 overflow-y-auto shadow-inner border border-border/50">
            {scrapingLogs.map((log, i) => (
              <div key={i} className="mb-1">
                <span className="text-muted-foreground mr-2">{">"}</span> {log}
              </div>
            ))}
            {loadingPreview && (
              <div className="animate-pulse">
                <span className="text-muted-foreground mr-2">{">"}</span> _
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
