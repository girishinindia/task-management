"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SavedView {
  name: string;
  /** Querystring without the leading "?" (may be empty). */
  query: string;
}

const STORAGE_KEY = "task-portal:saved-views";

function load(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is SavedView =>
        !!v &&
        typeof (v as SavedView).name === "string" &&
        typeof (v as SavedView).query === "string"
    );
  } catch {
    return [];
  }
}

function persist(views: SavedView[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Saved filter presets, stored locally in the browser. Lets a user capture the
 *  current set of filters/sort under a name and jump back to it later. */
export function SavedViews() {
  const router = useRouter();
  const params = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setViews(load());
    setReady(true);
  }, []);

  const currentQuery = params.toString();

  const saveCurrent = useCallback(() => {
    const name = window.prompt("Name this view (e.g. \"My overdue\")")?.trim();
    if (!name) return;
    setViews((prev) => {
      const next = [
        ...prev.filter((v) => v.name.toLowerCase() !== name.toLowerCase()),
        { name, query: currentQuery },
      ].sort((a, b) => a.name.localeCompare(b.name));
      persist(next);
      return next;
    });
    toast.success(`Saved view “${name}”`);
  }, [currentQuery]);

  const remove = useCallback((name: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.name !== name);
      persist(next);
      return next;
    });
  }, []);

  if (!ready) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" /> Views:
      </span>

      {views.length === 0 ? (
        <span className="text-xs text-muted-foreground">none saved</span>
      ) : (
        views.map((v) => (
          <span
            key={v.name}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium",
              "border-border text-foreground"
            )}
          >
            <button
              type="button"
              className="hover:text-primary"
              onClick={() =>
                router.replace(
                  v.query ? `/dashboard/tasks?${v.query}` : "/dashboard/tasks"
                )
              }
            >
              {v.name}
            </button>
            <button
              type="button"
              aria-label={`Delete view ${v.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove(v.name)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))
      )}

      <button
        type="button"
        onClick={saveCurrent}
        className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-3 w-3" /> Save current
      </button>
    </div>
  );
}
