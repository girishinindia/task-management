/**
 * Date helpers used across the app.
 *
 * The DB stores dates as `date` (no time, no timezone). When the API returns
 * them as "YYYY-MM-DD" strings, the naive `new Date("YYYY-MM-DD")` parses
 * them as UTC midnight — which shifts to the day before in negative-offset
 * timezones. The helpers below dodge that by building a local-time Date.
 */

/** Parse a "YYYY-MM-DD" string as a local-time Date at noon. */
export function localDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** Today as a "YYYY-MM-DD" string in the caller's local timezone. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
