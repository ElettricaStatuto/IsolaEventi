import { useCallback, useEffect, useState } from "react";

/**
 * L'evento che Chrome/Edge/Android sparano quando decidono che la pagina e'
 * "installabile" (ha un manifest valido, e' servita in HTTPS, ecc). Non e'
 * ancora nei tipi standard del DOM, va dichiarato a mano.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function giaInstallata(): boolean {
  // Safari iOS espone navigator.standalone; gli altri browser espongono
  // invece la media query display-mode quando l'app gira gia' come PWA.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Gestisce il pulsante "Installa app" nel menu:
 * - su Chrome/Edge/Android il browser offre un evento beforeinstallprompt
 *   che possiamo intercettare e richiamare a piacimento (installaOra);
 * - Safari iOS non lo supporta affatto, l'unico modo e' l'utente che tocca
 *   Condividi → Aggiungi a Home in autonomia, quindi li' mostriamo solo
 *   istruzioni invece di un vero pulsante funzionante.
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installata, setInstallata] = useState(giaInstallata);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallata(true);
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const installaOra = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const scelta = await promptEvent.userChoice;
    if (scelta.outcome === "accepted") setInstallata(true);
    setPromptEvent(null);
  }, [promptEvent]);

  return {
    installata,
    // Pronto per un vero prompt nativo del browser
    puoiInstallareOra: !!promptEvent && !installata,
    // iOS Safari: nessun evento possibile, servono istruzioni manuali
    mostraIstruzioniIos: isIos() && !installata && !promptEvent,
    installaOra,
  };
}
