/**
 * Tiny hotkey helper — no new dep.
 *
 * `useHotkey('n', fn)` runs fn() whenever the user presses 'n' OUTSIDE an
 * input/textarea/contenteditable element. Modifier keys (Meta/Ctrl/Alt) and
 * IME composition are ignored to avoid stealing browser shortcuts.
 */
"use client";

import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useHotkey(key: string, handler: Handler) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing) return;
      if (isTypingTarget(e)) return;
      // Match by .key (case-insensitive for letters).
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      handler(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler]);
}
