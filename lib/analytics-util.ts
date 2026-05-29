/**
 * Pure helpers for reporting math. No imports, so safe in client components,
 * server code, and unit tests alike.
 */

/** Percentage of `part` out of `total`, rounded to a whole number. Returns 0
 *  when total is 0 (avoids NaN). Result is clamped to 0..100. */
export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  const v = Math.round((part / total) * 100);
  return Math.max(0, Math.min(100, v));
}

/** Completion rate = done / total, as a 0..100 integer. */
export function completionRate(done: number, total: number): number {
  return pct(done, total);
}
