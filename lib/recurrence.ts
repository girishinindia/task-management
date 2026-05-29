/**
 * Pure date-math for recurring tasks. No DB / server imports, so it's safe to
 * use from client components and unit tests.
 *
 * Recurrence is "on completion": when a recurring task is marked Done, the next
 * occurrence is created with its dates shifted forward by the rule. Duration
 * (start → due) is preserved by shifting both dates by the same rule.
 */
export type RecurRule = "daily" | "weekly" | "monthly";

export const RECUR_RULES: RecurRule[] = ["daily", "weekly", "monthly"];

export const RECUR_LABEL: Record<RecurRule, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Shift a "YYYY-MM-DD" date forward by one period of `rule`. Month rollovers
 *  clamp to the last valid day (e.g. Jan 31 + 1 month → Feb 28/29). */
export function shiftIso(iso: string, rule: RecurRule): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (rule === "daily" || rule === "weekly") {
    const delta = rule === "daily" ? 1 : 7;
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
      dt.getUTCDate()
    )}`;
  }
  // monthly
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

/** Compute the next occurrence's dates. Each present date is shifted by the
 *  rule; absent dates stay absent. */
export function nextOccurrenceDates(
  start: string | null,
  due: string | null,
  rule: RecurRule
): { start: string | null; due: string | null } {
  return {
    start: start ? shiftIso(start, rule) : null,
    due: due ? shiftIso(due, rule) : null,
  };
}
