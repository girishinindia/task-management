import test from "node:test";
import assert from "node:assert/strict";
import {
  shiftIso,
  nextOccurrenceDates,
  RECUR_RULES,
} from "../../lib/recurrence";

test("daily shift adds one day", () => {
  assert.equal(shiftIso("2026-05-29", "daily"), "2026-05-30");
});

test("daily shift rolls over month end", () => {
  assert.equal(shiftIso("2026-01-31", "daily"), "2026-02-01");
});

test("weekly shift adds seven days", () => {
  assert.equal(shiftIso("2026-05-29", "weekly"), "2026-06-05");
});

test("monthly shift keeps the day of month", () => {
  assert.equal(shiftIso("2026-03-15", "monthly"), "2026-04-15");
});

test("monthly shift clamps to the last valid day", () => {
  // Jan 31 → Feb (no 31st) → clamp to Feb 28 in a non-leap year.
  assert.equal(shiftIso("2026-01-31", "monthly"), "2026-02-28");
  // Leap year 2028: Feb has 29 days.
  assert.equal(shiftIso("2028-01-31", "monthly"), "2028-02-29");
});

test("monthly shift rolls over the year in December", () => {
  assert.equal(shiftIso("2026-12-10", "monthly"), "2027-01-10");
});

test("nextOccurrenceDates shifts both present dates", () => {
  const r = nextOccurrenceDates("2026-05-01", "2026-05-05", "weekly");
  assert.equal(r.start, "2026-05-08");
  assert.equal(r.due, "2026-05-12");
});

test("nextOccurrenceDates leaves null dates null", () => {
  const r = nextOccurrenceDates(null, "2026-05-05", "daily");
  assert.equal(r.start, null);
  assert.equal(r.due, "2026-05-06");
});

test("RECUR_RULES has the three supported rules", () => {
  assert.deepEqual([...RECUR_RULES].sort(), ["daily", "monthly", "weekly"]);
});
