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

/**
 * Sane bounds for any user-entered date. A 4-digit year far outside this range
 * (e.g. 0620 or 65120 from a mis-keyed `<input type="date">`) is always a typo,
 * and passing it through to Postgres `::date` throws "value out of range".
 */
export const MIN_DATE_ISO = "2000-01-01";
export const MAX_DATE_ISO = "2100-12-31";
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * Type guard: true only when `s` is a real calendar date in "YYYY-MM-DD" form
 * within [MIN_DATE_ISO, MAX_DATE_ISO]. Rejects malformed strings, impossible
 * dates (e.g. "2025-02-30"), and absurd years (e.g. "0620", "65120").
 */
export function isValidDateString(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Type guard for a 24-hour "HH:MM" (or "HH:MM:SS") time-of-day string. */
export function isValidTimeString(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s);
}

/** Format a "HH:MM[:SS]" 24h string as a friendly 12h label, e.g. "2:05 PM".
 *  Returns "" for an invalid/empty input. */
export function formatTime12(s: string | null | undefined): string {
  if (!isValidTimeString(s)) return "";
  const [hStr, mStr] = s.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
