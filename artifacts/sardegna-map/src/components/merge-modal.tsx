import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertTriangle, HelpCircle } from "lucide-react";

interface MergeModalProps {
  pair: {
    date: string;
    event1: any;
    event2: any;
  } | null;
  onClose: () => void;
  onConfirm: (mergedEvent: any, ev1Key: string, ev2Key: string) => void;
}

export function MergeModal({ pair, onClose, onConfirm }: MergeModalProps) {
  if (!pair) return null;

  const { event1: ev1, event2: ev2 } = pair;

  // State for merged values
  const [titolo, setTitolo] = useState("");
  const [titoloOriginale, setTitoloOriginale] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [testoEstratto, setTestoEstratto] = useState("");
  const [immagine, setImmagine] = useState("");
  const [luogo, setLuogo] = useState("");
  const [latitudine, setLatitudine] = useState("");
  const [longitudine, setLongitudine] = useState("");
  const [link, setLink] = useState("");
  const [linkOrganizzatore, setLinkOrganizzatore] = useState("");

  // Initialize with sensible defaults (e.g. longest descriptions, non-null values)
  useEffect(() => {
    setTitolo(ev1.titolo || ev2.titolo || "");
    setTitoloOriginale(ev1.titolo_originale || ev1.titolo || ev2.titolo_originale || ev2.titolo || "");
    setCategoria(ev1.categoria || ev2.categoria || "");
    
    // Default to the longer description
    const desc1 = ev1.descrizione || "";
    const desc2 = ev2.descrizione || "";
    setDescrizione(desc1.length >= desc2.length ? desc1 : desc2);

    // Default to longer AI summary
    const txt1 = ev1.testo_estratto || "";
    const txt2 = ev2.testo_estratto || "";
    setTestoEstratto(txt1.length >= txt2.length ? txt1 : txt2);

    setImmagine(ev1.immagine || ev2.immagine || "");
    setLuogo(ev1.luogo || ev2.luogo || "");
    setLatitudine(String(ev1.latitudine || ev2.latitudine || ""));
    setLongitudine(String(ev1.longitudine || ev2.longitudine || ""));
    setLink(ev1.link || ev2.link || "");
    setLinkOrganizzatore(ev1.link_organizzatore || ev2.link_organizzatore || "");
  }, [pair]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto merge details_extra and links
    const tags = Array.from(new Set([...(ev1.tags || []), ...(ev2.tags || [])]));
    const fonti = Array.from(new Set([ev1.fonte, ev2.fonte].filter(Boolean))).join(", ");
    
    const dettagliExtra = {
      ...(ev1.dettagli_extra || {}),
      ...(ev2.dettagli_extra || {}),
      fonti_originali: [
        { fonte: ev1.fonte, link: ev1.link },
        { fonte: ev2.fonte, link: ev2.link }
      ]
    };

    const merged = {
      titolo,
      titoloOriginale,
      categoria,
      dataInizio: pair.date,
      dataFine: pair.date,
      luogo,
      latitudine,
      longitudine,
      link,
      linkOrganizzatore,
      descrizione,
      testoEstratto,
      immagine,
      fonte: fonti,
      tags,
      dettagliExtra
    };

    onConfirm(merged, ev1.id_key, ev2.id_key);
  };

  const getImgUrl = (imgName: string | null) => {
    if (!imgName) return "";
    if (imgName.startsWith("http")) return imgName;
    return `/api/event-images/${imgName}`;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            Fusione Eventi Duplicati
          </DialogTitle>
          <DialogDescription>
            Risolvi le differenze tra i due eventi duplicati per crearne uno unico e definitivo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 my-4 text-sm leading-relaxed">
          {/* Confronto Titoli */}
          <div className="border p-4 rounded-lg bg-muted/20">
            <h3 className="font-semibold mb-3">1. Scegli il Titolo Elaborato (AI)</h3>
            <RadioGroup value={titolo} onValueChange={setTitolo} className="flex flex-col gap-2">
              <div className="flex items-center space-x-2 border p-2 rounded bg-background">
                <RadioGroupItem value={ev1.titolo || ""} id="t1" />
                <Label htmlFor="t1" className="flex-1 cursor-pointer">
                  {ev1.titolo || <span className="italic text-muted-foreground">Vuoto</span>} <Badge variant="outline" className="ml-2 scale-90">{ev1.fonte}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-2 rounded bg-background">
                <RadioGroupItem value={ev2.titolo || ""} id="t2" />
                <Label htmlFor="t2" className="flex-1 cursor-pointer">
                  {ev2.titolo || <span className="italic text-muted-foreground">Vuoto</span>} <Badge variant="outline" className="ml-2 scale-90">{ev2.fonte}</Badge>
                </Label>
              </div>
            </RadioGroup>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Titolo Personalizzato</Label>
              <Input value={titolo} onChange={e => setTitolo(e.target.value)} className="h-9 mt-1 text-xs" />
            </div>
          </div>

          {/* Categoria principale */}
          <div className="border p-4 rounded-lg bg-muted/20">
            <h3 className="font-semibold mb-2">2. Categoria dell'evento</h3>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="h-9 w-full text-xs border rounded bg-background px-2"
              required
            >
              <option value="">Seleziona Categoria...</option>
              {["Musica", "Teatro", "Cinema", "Arte", "Incontro", "Enogastronomia", "Folklore", "Sport", "Bambini", "Altro"].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Confronto Immagini */}
          <div className="border p-4 rounded-lg bg-muted/20">
            <h3 className="font-semibold mb-3">3. Scegli l'Immagine</h3>
            <RadioGroup value={immagine} onValueChange={setImmagine} className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 border p-3 rounded bg-background items-center">
                <div className="flex items-center space-x-2 w-full justify-start">
                  <RadioGroupItem value={ev1.immagine || ""} id="img1" />
                  <Label htmlFor="img1" className="cursor-pointer font-semibold text-xs">{ev1.fonte}</Label>
                </div>
                {ev1.immagine ? (
                  <img src={getImgUrl(ev1.immagine)} alt="Locandina 1" className="h-28 object-cover rounded border w-full mt-2" />
                ) : (
                  <div className="h-28 flex items-center justify-center border rounded bg-muted/10 text-xs text-muted-foreground w-full mt-2">Nessuna immagine</div>
                )}
              </div>
              <div className="flex flex-col gap-2 border p-3 rounded bg-background items-center">
                <div className="flex items-center space-x-2 w-full justify-start">
                  <RadioGroupItem value={ev2.immagine || ""} id="img2" />
                  <Label htmlFor="img2" className="cursor-pointer font-semibold text-xs">{ev2.fonte}</Label>
                </div>
                {ev2.immagine ? (
                  <img src={getImgUrl(ev2.immagine)} alt="Locandina 2" className="h-28 object-cover rounded border w-full mt-2" />
                ) : (
                  <div className="h-28 flex items-center justify-center border rounded bg-muted/10 text-xs text-muted-foreground w-full mt-2">Nessuna immagine</div>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Descrizioni e Testo Rielaborato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Descrizione Grezza */}
            <div className="border p-4 rounded-lg bg-muted/20">
              <h3 className="font-semibold mb-3">4. Descrizione Originale</h3>
              <RadioGroup value={descrizione} onValueChange={setDescrizione} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 border p-2 rounded bg-background">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={ev1.descrizione || ""} id="desc1" />
                    <Label htmlFor="desc1" className="cursor-pointer font-semibold text-xs">Versione {ev1.fonte} ({ev1.descrizione?.length || 0} car.)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic mt-1">{ev1.descrizione || "(vuoto)"}</p>
                </div>
                <div className="flex flex-col gap-1 border p-2 rounded bg-background">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={ev2.descrizione || ""} id="desc2" />
                    <Label htmlFor="desc2" className="cursor-pointer font-semibold text-xs">Versione {ev2.fonte} ({ev2.descrizione?.length || 0} car.)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic mt-1">{ev2.descrizione || "(vuoto)"}</p>
                </div>
              </RadioGroup>
              <textarea
                value={descrizione}
                onChange={e => setDescrizione(e.target.value)}
                className="w-full text-xs p-2 border rounded mt-3 h-24 bg-background resize-none focus:outline-none"
                placeholder="Modifica testo finale originale..."
              />
            </div>

            {/* Testo AI Riscritto */}
            <div className="border p-4 rounded-lg bg-muted/20">
              <h3 className="font-semibold mb-3">5. Testo Elaborato (AI Summary)</h3>
              <RadioGroup value={testoEstratto} onValueChange={setTestoEstratto} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 border p-2 rounded bg-background">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={ev1.testo_estratto || ""} id="txt1" />
                    <Label htmlFor="txt1" className="cursor-pointer font-semibold text-xs">Versione {ev1.fonte}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic mt-1">{ev1.testo_estratto || "(Non elaborato)"}</p>
                </div>
                <div className="flex flex-col gap-1 border p-2 rounded bg-background">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={ev2.testo_estratto || ""} id="txt2" />
                    <Label htmlFor="txt2" className="cursor-pointer font-semibold text-xs">Versione {ev2.fonte}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic mt-1">{ev2.testo_estratto || "(Non elaborato)"}</p>
                </div>
              </RadioGroup>
              <textarea
                value={testoEstratto}
                onChange={e => setTestoEstratto(e.target.value)}
                className="w-full text-xs p-2 border rounded mt-3 h-24 bg-background resize-none focus:outline-none"
                placeholder="Modifica riassunto AI finale..."
              />
            </div>
          </div>

          {/* Luogo ed Indirizzo */}
          <div className="border p-4 rounded-lg bg-muted/20 flex flex-col gap-3">
            <h3 className="font-semibold">6. Luogo e Coordinate</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Luogo/Indirizzo</Label>
                <Input value={luogo} onChange={e => setLuogo(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Latitudine</Label>
                  <Input value={latitudine} onChange={e => setLatitudine(e.target.value)} className="h-9 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Longitudine</Label>
                  <Input value={longitudine} onChange={e => setLongitudine(e.target.value)} className="h-9 text-xs font-mono" />
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Annulla</Button>
          <Button size="sm" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!categoria}>
            Conferma Unione (Merge)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Icon fallbacks if import fails
function Layers(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-10 5 10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}
