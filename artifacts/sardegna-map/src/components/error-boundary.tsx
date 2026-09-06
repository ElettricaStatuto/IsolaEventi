import React from "react";
import { segnalaErrore } from "../lib/error-reporting";

/**
 * Rete di sicurezza contro gli errori JavaScript non gestiti: senza un
 * error boundary, QUALSIASI errore durante il render di un componente
 * (es. la mini-mappa Leaflet, un campo dati inatteso) fa sparire l'intera
 * app lasciando una pagina completamente bianca, senza nessun messaggio.
 * Con questo, l'errore resta contenuto alla sola parte che ha fallito e
 * l'utente vede un messaggio comprensibile invece di un vuoto.
 *
 * L'errore viene anche inviato al backend (tabella client_errors) e un
 * codice breve viene mostrato all'utente: prima non avevamo alcun modo di
 * sapere COSA fosse andato storto senza chiedere all'utente di aprire la
 * console del browser - ora basta il codice per cercarlo nei log admin.
 */
interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  codice: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, codice: null };

  static getDerivedStateFromError(): State {
    return { hasError: true, codice: null };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Errore non gestito catturato dall'ErrorBoundary:", error, info.componentStack);
    const codice = segnalaErrore({
      messaggio: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack ?? undefined,
    });
    this.setState({ codice });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-lg font-semibold text-foreground">
            {this.props.fallbackTitle || "Qualcosa è andato storto"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Si è verificato un errore imprevisto in questa parte della pagina. Prova a ricaricare.
          </p>
          {this.state.codice && (
            <p className="text-xs text-muted-foreground/70 font-mono">
              Codice errore: {this.state.codice}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
          >
            Ricarica la pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
