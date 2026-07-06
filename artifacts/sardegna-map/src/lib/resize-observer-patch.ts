// Patches the global ResizeObserver to defer its callback to the next
// animation frame. This eliminates the classic "ResizeObserver loop
// completed with undelivered notifications" / "loop limit exceeded" browser
// error, which can fire when a layout-heavy popover (e.g. our date range
// picker animating open with 2 months) triggers synchronous resize
// notifications that feed back into each other within the same frame.
//
// The browser reports this as a bare, non-Error exception (no stack trace),
// which the dev runtime-error overlay surfaces as "(unknown runtime error)".
// It does not indicate a broken app, but deferring the callback prevents the
// loop — and the resulting error — from ever occurring.
//
// Must run before any component constructs a ResizeObserver, so it is
// imported as the very first statement in main.tsx.
if (typeof window !== "undefined" && "ResizeObserver" in window) {
  const OriginalResizeObserver = window.ResizeObserver;

  class PatchedResizeObserver extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  }

  window.ResizeObserver = PatchedResizeObserver;
}
