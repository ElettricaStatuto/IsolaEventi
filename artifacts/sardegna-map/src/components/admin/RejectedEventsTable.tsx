import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Globe, AlertTriangle, Calendar, RotateCcw } from "lucide-react";

export interface RejectedEventsTableProps {
  rejectedEvents: any[];
  loadingRejected: boolean;
  rejFilterTitolo: string;
  setRejFilterTitolo: (val: string) => void;
  rejFilterFonte: string;
  setRejFilterFonte: (val: string) => void;
  rejFilterMotivo: string;
  setRejFilterMotivo: (val: string) => void;
  rejFilterDataFrom: string;
  setRejFilterDataFrom: (val: string) => void;
  rejFilterDataTo: string;
  setRejFilterDataTo: (val: string) => void;
  applyRejFilters: () => void;
  clearRejFilters: () => void;
  filteredRejectedEvents: any[];
  restoreRejected: (id: number) => void;
}

export const RejectedEventsTable: React.FC<RejectedEventsTableProps> = ({
  rejectedEvents,
  loadingRejected,
  rejFilterTitolo,
  setRejFilterTitolo,
  rejFilterFonte,
  setRejFilterFonte,
  rejFilterMotivo,
  setRejFilterMotivo,
  rejFilterDataFrom,
  setRejFilterDataFrom,
  rejFilterDataTo,
  setRejFilterDataTo,
  applyRejFilters,
  clearRejFilters,
  filteredRejectedEvents,
  restoreRejected,
}) => {
  return (
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
                <th className="p-2 text-left text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    <Search className="w-3 h-3" /> Titolo
                  </div>
                </th>
                <th className="p-2 text-left text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Fonte
                  </div>
                </th>
                <th className="p-2 text-left text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Motivo
                  </div>
                </th>
                <th className="p-2 text-left text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Scartato il
                  </div>
                </th>
                <th className="p-2 text-left text-xs font-semibold">Azione</th>
              </tr>
              <tr className="border-t border-border">
                <th className="p-1">
                  <Input
                    placeholder="Filtra titolo…"
                    value={rejFilterTitolo}
                    onChange={(e) => setRejFilterTitolo(e.target.value)}
                    className="h-7 text-xs"
                  />
                </th>
                <th className="p-1">
                  <Input
                    placeholder="Filtra fonte…"
                    value={rejFilterFonte}
                    onChange={(e) => setRejFilterFonte(e.target.value)}
                    className="h-7 text-xs"
                  />
                </th>
                <th className="p-1">
                  <Input
                    placeholder="Filtra motivo…"
                    value={rejFilterMotivo}
                    onChange={(e) => setRejFilterMotivo(e.target.value)}
                    className="h-7 text-xs"
                  />
                </th>
                <th className="p-1">
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={rejFilterDataFrom}
                      onChange={(e) => setRejFilterDataFrom(e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                    <Input
                      type="date"
                      value={rejFilterDataTo}
                      onChange={(e) => setRejFilterDataTo(e.target.value)}
                      className="h-7 text-xs px-1"
                    />
                  </div>
                </th>
                <th className="p-1">
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={applyRejFilters}>
                      <Search className="w-3 h-3 mr-1" /> Applica
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0" onClick={clearRejFilters}>
                      Azzera
                    </Button>
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
                    <td className="p-2">
                      <Badge variant="secondary">{ev.fonte}</Badge>
                    </td>
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
  );
};
