import test from "node:test";
import assert from "node:assert/strict";
import { addDaysIso, mondayOfWeekIso, dateChipRange } from "../../lib/date";

test("addDaysIso rolls over months and years", () => {
  assert.equal(addDaysIso("2026-05-31", 1), "2026-06-01");
  assert.equal(addDaysIso("2026-01-01", -1), "2025-12-31");
  assert.equal(addDaysIso("2026-05-30", 0), "2026-05-30");
});

test("mondayOfWeekIso returns the Monday of that week", () => {
  const mon = mondayOfWeekIso("2026-05-30");
  assert.equal(new Date(`${mon}T12:00:00`).getDay(), 1); // Monday
  assert.equal(mondayOfWeekIso(mon), mon); // idempotent on a Monday
  assert.ok(mon <= "2026-05-30");
});

test("today / tomorrow chips", () => {
  assert.deepEqual(dateChipRange("today", "2026-05-30"), {
    from: "2026-05-30",
    to: "2026-05-30",
    no_date: false,
    overdue: false,
  });
  const t = dateChipRange("tomorrow", "2026-05-30");
  assert.equal(t.from, "2026-05-31");
  assert.equal(t.to, "2026-05-31");
});

test("week chip is Mon–Sun containing today", () => {
  const today = "2026-05-30";
  const r = dateChipRange("week", today);
  assert.equal(new Date(`${r.from}T12:00:00`).getDay(), 1); // starts Monday
  assert.equal(r.to, addDaysIso(r.from as string, 6)); // 7-day span
  assert.ok((r.from as string) <= today && today <= (r.to as string));
});

test("overdue / no_date chips set flags, not a range", () => {
  const o = dateChipRange("overdue", "2026-05-30");
  assert.equal(o.overdue, true);
  assert.equal(o.from, null);
  assert.equal(o.to, null);
  const n = dateChipRange("no_date", "2026-05-30");
  assert.equal(n.no_date, true);
  assert.equal(n.from, null);
});

test("unknown chip = no constraint", () => {
  assert.deepEqual(dateChipRange("none", "2026-05-30"), {
    from: null,
    to: null,
    no_date: false,
    overdue: false,
  });
});
