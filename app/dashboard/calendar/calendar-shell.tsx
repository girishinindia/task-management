"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DaySheet } from "./day-sheet";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarShellProps {
  year: number;
  month: number; // 1-12
  grid: string[]; // 42 ISO YYYY-MM-DD strings
  counts: Record<string, number>;
  today: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
}

export function CalendarShell(props: CalendarShellProps) {
  const {
    year,
    month,
    grid,
    counts,
    today,
    monthLabel,
    prevMonth,
    nextMonth,
    thisMonth,
  } = props;

  const [openDay, setOpenDay] = useState<string | null>(null);

  function inThisMonth(iso: string) {
    const m = Number(iso.slice(5, 7));
    return m === month;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {monthLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            Click a day to see the tasks scheduled on it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/dashboard/calendar?month=${prevMonth}`}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(
              thisMonth === todayMonth(today) &&
                "border-primary/40 bg-primary/10 text-primary"
            )}
          >
            <Link href={`/dashboard/calendar?month=${todayMonth(today)}`}>
              <CalendarDays className="mr-1 h-4 w-4" /> Today
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/dashboard/calendar?month=${nextMonth}`}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((iso) => {
            const isThis = inThisMonth(iso);
            const isToday = iso === today;
            const count = counts[iso] ?? 0;
            const dayNum = Number(iso.slice(8, 10));
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setOpenDay(iso)}
                title={
                  count > 0
                    ? `${count} task${count === 1 ? "" : "s"} on this day — click to view`
                    : "No tasks scheduled — click to view"
                }
                className={cn(
                  "group relative flex h-24 flex-col items-stretch border-b border-r p-2 text-left transition-colors hover:bg-accent/40",
                  !isThis && "bg-muted/20 text-muted-foreground",
                  isToday && "bg-primary/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {dayNum}
                  </span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        isThis
                          ? "bg-brand-100 text-brand-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </div>
                {count > 0 ? (
                  <div className="mt-auto truncate text-[10px] font-medium text-primary">
                    {count} task{count === 1 ? "" : "s"}
                  </div>
                ) : (
                  <div className="mt-auto text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    No tasks
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Year {year} · {Object.values(counts).reduce((a, b) => a + b, 0)} task-day
        overlaps in this view.
      </p>

      <DaySheet
        open={openDay !== null}
        day={openDay}
        onOpenChange={(o) => {
          if (!o) setOpenDay(null);
        }}
      />
    </div>
  );
}

function todayMonth(today: string) {
  return today.slice(0, 7);
}
