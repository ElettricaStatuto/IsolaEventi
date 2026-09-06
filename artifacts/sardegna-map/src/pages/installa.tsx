import { Download, Share, CheckCircle2, Menu as MenuIcon } from "lucide-react";
import { useInstallPrompt } from "../hooks/use-install-prompt";

/**
 * Pagina pensata per essere condivisa come link diretto (WhatsApp, social,
 * QR code): a differenza del pulsante "Installa app" nel menu, chi la apre
 * non deve sapere che quel pulsante esiste ne' dove trovarlo - arriva gia'
 * sulla schermata giusta con l'unica azione possibile ben in vista.
 */
export function InstallaPage() {
  const { installata, puoiInstallareOra, mostraIstruzioniIos, installaOra } = useInstallPrompt();

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto py-10 gap-6">
      <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-serif italic text-4xl shadow-md">
        S
      </div>
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Installa Sardegna Eventi</h1>
        <p className="text-muted-foreground mt-2">
          Aggiungi l'icona alla schermata Home per aprire l'app in un click, come una qualsiasi
          altra app — niente da scaricare, pesa pochissimo.
        </p>
      </div>

      {installata ? (
        <div className="flex items-center gap-2 text-primary font-medium bg-primary/10 px-4 py-3 rounded-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          L'app è già installata su questo dispositivo — apri l'icona dalla schermata Home.
        </div>
      ) : puoiInstallareOra ? (
        <button
          onClick={installaOra}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-base cursor-pointer hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Download className="w-5 h-5" /> Installa ora
        </button>
      ) : mostraIstruzioniIos ? (
        <ol className="space-y-3 text-sm text-foreground text-left w-full bg-card border border-border rounded-lg p-4">
          <li className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
            Tocca l'icona <Share className="w-4 h-4 inline mx-1" /> <strong>Condividi</strong> nella barra di Safari
          </li>
          <li className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
            Scorri e scegli <strong>"Aggiungi a Home"</strong>
          </li>
        </ol>
      ) : (
        // Browser che non supporta l'installazione automatica (es. Firefox,
        // o Chrome/Android che non ha ancora offerto l'evento) - unica
        // opzione affidabile: indicare dove cercarla nel menu del browser.
        <div className="flex items-start gap-3 text-sm text-foreground text-left w-full bg-card border border-border rounded-lg p-4">
          <MenuIcon className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            Apri il menu del tuo browser (di solito l'icona <strong>⋮</strong> o <strong>≡</strong> in alto)
            e cerca la voce <strong>"Installa app"</strong> o <strong>"Aggiungi a schermata Home"</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
