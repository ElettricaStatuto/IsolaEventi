import "./lib/resize-observer-patch";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Defensive backstop for production (where the dev-only runtime-error
// overlay script isn't injected, so our listeners run first): swallow any
// residual "ResizeObserver loop" errors instead of letting them surface as
// uncaught runtime errors. See ./lib/resize-observer-patch.ts for the
// root-cause fix.
function isResizeObserverLoopError(message: unknown): boolean {
  return typeof message === "string" && message.includes("ResizeObserver loop");
}

window.addEventListener("error", (event) => {
  if (isResizeObserverLoopError(event.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = typeof reason === "string" ? reason : reason?.message;
  if (isResizeObserverLoopError(message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
