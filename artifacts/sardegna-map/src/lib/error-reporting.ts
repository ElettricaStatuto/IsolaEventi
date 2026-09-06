/**
 * Genera un breve codice identificativo per un errore a partire dal suo
 * messaggio (non dallo stack, che spesso cambia leggermente da un browser
 * all'altro per via delle sourcemap/minificazione): stesso messaggio =
 * stesso codice, cosi' quando un utente ci segnala "codice ABC123" possiamo
 * cercarlo direttamente invece di provare a indovinare a quale errore si
 * riferisce tra centinaia di righe di log.
 */
function generaCodiceErrore(messaggio: string): string {
  let hash = 0;
  for (let i = 0; i < messaggio.length; i++) {
    hash = (hash << 5) - hash + messaggio.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

interface DettagliErrore {
  messaggio: string;
  stack?: string;
  componentStack?: string;
}

/**
 * Invia una segnalazione di errore al backend, in modo che resti visibile
 * a noi (tabella client_errors) invece di sparire nella console del
 * dispositivo dell'utente. Non deve MAI far fallire o rallentare l'app: se
 * la rete non c'e' o il backend risponde male, l'errore viene ignorato in
 * silenzio - segnalare un errore non deve produrne un altro.
 *
 * Ritorna il codice breve da mostrare all'utente.
 */
export function segnalaErrore(dettagli: DettagliErrore): string {
  const codice = generaCodiceErrore(dettagli.messaggio);
  try {
    const payload = JSON.stringify({
      codice,
      messaggio: dettagli.messaggio,
      stack: dettagli.stack,
      componentStack: dettagli.componentStack,
      url: window.location.href,
    });
    // sendBeacon non blocca la pagina e funziona anche se l'errore avviene
    // durante uno scaricamento/cambio pagina; se non disponibile, fetch normale.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/client-errors", blob);
    } else {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // silenzioso di proposito
  }
  return codice;
}

let listenerGlobaleAttivo = false;

/**
 * Cattura gli errori che l'ErrorBoundary di React NON puo' vedere: quelli
 * fuori dal ciclo di render, come una Promise rifiutata senza .catch o
 * un'eccezione dentro un event handler (es. onClick) o un setTimeout.
 * Da chiamare una sola volta all'avvio dell'app.
 */
export function attivaSegnalazioneErroriGlobale(): void {
  if (listenerGlobaleAttivo) return;
  listenerGlobaleAttivo = true;

  window.addEventListener("error", (event) => {
    segnalaErrore({
      messaggio: event.message || "Errore JS non gestito",
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const motivo = event.reason;
    segnalaErrore({
      messaggio: motivo instanceof Error ? motivo.message : String(motivo ?? "Promise rifiutata"),
      stack: motivo instanceof Error ? motivo.stack : undefined,
    });
  });
}
