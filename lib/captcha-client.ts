"use client";

/**
 * Client-side reCAPTCHA helper (classic v3, invisible).
 *
 * Lazy-loads the api.js script once per browser tab and exposes a
 * `useRecaptcha()` hook that returns `execute(action)`. When the feature is
 * disabled via NEXT_PUBLIC_RECAPTCHA_ENABLED=false, `execute` returns
 * undefined and the form should submit without a token (the server-side
 * verifier short-circuits to `{ ok: true }` in that case).
 */
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        opts: { action: string }
      ) => Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const ENABLED = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED === "true";

let scriptInjected = false;

export function useRecaptcha() {
  const [ready, setReady] = useState(!ENABLED);

  useEffect(() => {
    if (!ENABLED || !SITE_KEY) return;
    if (typeof window === "undefined") return;

    if (window.grecaptcha) {
      window.grecaptcha.ready(() => setReady(true));
      return;
    }

    if (scriptInjected) return;
    scriptInjected = true;

    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      window.grecaptcha?.ready(() => setReady(true));
    };
    document.body.appendChild(s);
  }, []);

  const execute = useCallback(
    async (action: string): Promise<string | undefined> => {
      if (!ENABLED || !SITE_KEY) return undefined;
      if (typeof window === "undefined") return undefined;
      if (!window.grecaptcha) return undefined;
      try {
        return await window.grecaptcha.execute(SITE_KEY, { action });
      } catch {
        return undefined;
      }
    },
    []
  );

  return { ready, enabled: ENABLED, execute };
}
