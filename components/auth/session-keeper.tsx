"use client";

/**
 * Keeps an active user signed in.
 *
 * The access token lives ~15 min and nothing else refreshes it, so without this
 * the user gets bounced to /login mid-session. Mounted in the authenticated
 * shell (SiteHeader), this silently rotates the token a bit before it lapses —
 * on an interval and when the tab regains focus — via the existing
 * POST /api/auth/refresh (which rotates the access + refresh cookies).
 */
import { useEffect } from "react";

// Refresh comfortably inside the 15-minute access-token window.
const REFRESH_EVERY_MS = 12 * 60 * 1000;

export function SessionKeeper() {
  useEffect(() => {
    let last = Date.now();

    const refresh = () => {
      last = Date.now();
      fetch("/api/auth/refresh", { method: "POST", cache: "no-store" }).catch(
        () => {
          /* transient — the next tick or navigation will retry */
        }
      );
    };

    const interval = setInterval(refresh, REFRESH_EVERY_MS);

    // Background tabs throttle timers; refresh on return if it's been a while.
    const onFocus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - last > REFRESH_EVERY_MS
      ) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
