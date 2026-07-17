import { useEffect } from "react";

/**
 * Defensive safeguard against a known Radix UI issue: components that lock
 * body scroll while open (Select, Dialog, ...) can leave `pointer-events:
 * none` stuck on <body> if their cleanup effect doesn't run — most commonly
 * during dev-mode hot module reloads. When that happens the entire page
 * stops responding to clicks. This periodically clears the lock if nothing
 * is actually open, so a stuck reload never permanently freezes the app.
 */
export function useScrollLockGuard() {
  useEffect(() => {
    const interval = setInterval(() => {
      const isLocked = document.body.style.pointerEvents === "none";
      const hasOpenOverlay = document.querySelector('[data-state="open"]') !== null;

      if (isLocked && !hasOpenOverlay) {
        document.body.style.removeProperty("pointer-events");
        document.body.removeAttribute("data-scroll-locked");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);
}
