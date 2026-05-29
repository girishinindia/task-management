"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { localDate } from "@/lib/date";
import type { TaskRow } from "@/lib/dao/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  priorityVariant,
  statusVariant,
} from "../tasks/task-meta";

export interface DaySheetProps {
  open: boolean;
  day: string | null;
  onOpenChange: (open: boolean) => void;
}

export function DaySheet({ open, day, onOpenChange }: DaySheetProps) {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !day) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tasks/by-date?date=${day}`);
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message ?? "Failed to load tasks");
        }
        const data = await res.json();
        if (!cancelled) setTasks(data.tasks ?? []);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load tasks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, day]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {day ? format(localDate(day), "EEEE, PP") : "Day"}
          </SheetTitle>
          <SheetDescription>
            {loading
              ? "Loading…"
              : tasks.length === 0
                ? "No tasks overlap this day."
                : `${tasks.length} task${tasks.length === 1 ? "" : "s"} on this day.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing here.
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/tasks/${t.id}`}
                    className="flex flex-col gap-1 px-3 py-2 hover:bg-accent/40"
                    onClick={() => onOpenChange(false)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {t.title}
                      </span>
                      {isOverdue(t.due_date, t.status) ? (
                        <Badge variant="destructive" className="text-[10px]">
                          overdue
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusVariant(t.status)} className="text-[10px]">
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      <Badge
                        variant={priorityVariant(t.priority)}
                        className="text-[10px]"
                      >
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                      {t.due_date ? (
                        <span className="text-[10px] text-muted-foreground">
                          due {format(localDate(t.due_date), "PP")}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
