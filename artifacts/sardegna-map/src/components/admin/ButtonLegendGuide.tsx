import React from "react";
import { Info, Eye, Brain, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ButtonLegendGuide: React.FC = () => {
  return (
    <div className="bg-muted/30 border border-border/80 rounded-lg p-3 text-xs text-muted-foreground flex flex-col gap-2">
      <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
        <Info className="w-3.5 h-3.5 text-blue-500" /> Legenda Guida Pulsanti e Azioni
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px]">
            <Eye className="w-3 h-3 mr-1" /> Dettagli
          </Badge>
          <span className="text-[11px]">Mostra la scheda completa dell'evento e i sotto-eventi.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            <Brain className="w-3 h-3 mr-1" /> Analizza
          </Badge>
          <span className="text-[11px]">Lancia l'AI per arricchire descrizione, tag e dati extra.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px] bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approva
          </Badge>
          <span className="text-[11px]">Salva l'evento nel database e lo rende visibile al pubblico.</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px] bg-red-50 text-red-700 border-red-200">
            <Trash2 className="w-3 h-3 mr-1" /> Elimina
          </Badge>
          <span className="text-[11px]">Rimuove l'evento dalla lista (può ripresentarsi in futuri scansionamenti).</span>
        </div>
        <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/50">
          <Badge variant="outline" className="shrink-0 text-[10px] bg-orange-50 text-orange-700 border-orange-200">
            <AlertTriangle className="w-3 h-3 mr-1" /> Elimina e Scarta
          </Badge>
          <span className="text-[11px]">Rimuove l'evento e salva l'URL nella lista "Scartati", impedendo che venga mai più estratto.</span>
        </div>
      </div>
    </div>
  );
};
