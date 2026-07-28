import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Download, Copy, RefreshCw, Folder } from "lucide-react";

interface CrawlerFolder {
  name: string;
  updatedAt: string;
  files: string[];
}

interface CrawlerLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminKey: string;
}

export const CrawlerLogsModal: React.FC<CrawlerLogsModalProps> = ({ isOpen, onClose, adminKey }) => {
  const [folders, setFolders] = useState<CrawlerFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/events/crawler-logs", {
        headers: { "x-admin-key": adminKey }
      });
      const data = await res.json();
      if (data.success && data.folders) {
        setFolders(data.folders);
        if (data.folders.length > 0) {
          const firstFolder = data.folders[0];
          setSelectedFolder(firstFolder.name);
          if (firstFolder.files.length > 0) {
            setSelectedFile(firstFolder.files[0]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchFileContent = async (folderName: string, fileName: string) => {
    if (!folderName || !fileName) return;
    setLoadingContent(true);
    setFileContent("");
    try {
      const res = await fetch(`/api/events/crawler-logs/content?folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}`, {
        headers: { "x-admin-key": adminKey }
      });
      const data = await res.json();
      if (data.success && data.content) {
        setFileContent(data.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedFolder && selectedFile) {
      fetchFileContent(selectedFolder, selectedFile);
    }
  }, [selectedFolder, selectedFile]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFolder}_${selectedFile}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeFolderObj = folders.find(f => f.name === selectedFolder);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader className="p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <DialogTitle className="text-slate-100 text-base">Registri & Log Crawler AI</DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Ispeziona i file di log, link estratti e report JSON prodotti dallo scraper online.
                </DialogDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs border-slate-700 text-slate-300" onClick={fetchFolders}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingFolders ? "animate-spin" : ""}`} /> Aggiorna
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Cartelle e File */}
          <div className="w-72 border-r border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-3 overflow-y-auto">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Sessioni di Scansione</span>
            
            {loadingFolders ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Caricamento sessioni...
              </div>
            ) : folders.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-2 text-center">Nessun log salvato trovato. Avvia una scansione URL.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {folders.map(f => (
                  <div key={f.name} className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setSelectedFolder(f.name);
                        if (f.files.length > 0) setSelectedFile(f.files[0]);
                      }}
                      className={`flex items-center gap-2 text-xs text-left p-2 rounded transition-colors ${
                        selectedFolder === f.name ? "bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 font-semibold" : "hover:bg-slate-800/60 text-slate-300"
                      }`}
                    >
                      <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                    </button>

                    {selectedFolder === f.name && (
                      <div className="pl-6 flex flex-col gap-1 my-1">
                        {f.files.map(file => (
                          <button
                            key={file}
                            onClick={() => setSelectedFile(file)}
                            className={`text-[11px] text-left px-2 py-1 rounded truncate transition-colors ${
                              selectedFile === file ? "bg-emerald-600/20 text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {file}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visualizzatore Contenuto Log */}
          <div className="flex-1 flex flex-col bg-slate-950">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
              <span className="text-xs font-mono text-emerald-400 truncate">
                {selectedFolder ? `${selectedFolder} / ${selectedFile}` : "Seleziona un file di log"}
              </span>

              {fileContent && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300" onClick={handleCopy}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> {copied ? "Copiato!" : "Copia"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-300" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Scarica
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-hidden relative">
              {loadingContent ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2 font-mono text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Lettura file in corso...
                </div>
              ) : fileContent ? (
                <ScrollArea className="h-full w-full border border-slate-800/80 rounded bg-slate-900/80 p-3">
                  <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-words leading-relaxed select-text">
                    {fileContent}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-xs italic font-mono">
                  Seleziona una sessione ed un file dalla colonna di sinistra per aprirlo.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
