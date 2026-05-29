import test from "node:test";
import assert from "node:assert/strict";
import { isValidDateString } from "../../lib/date";

test("accepts a normal date", () => {
  assert.equal(isValidDateString("2026-05-29"), true);
});

test("rejects empty / null / undefined", () => {
  assert.equal(isValidDateString(""), false);
  assert.equal(isValidDateString(null), false);
  assert.equal(isValidDateString(undefined), false);
});

test("rejects the wrong shape", () => {
  assert.equal(isValidDateString("2026-5-9"), false);
  assert.equal(isValidDateString("29-05-2026"), false);
  assert.equal(isValidDateString("not-a-date"), false);
});

test("rejects impossible calendar dates", () => {
  assert.equal(isValidDateString("2025-02-30"), false);
  assert.equal(isValidDateString("2026-13-01"), false);
});

test("rejects absurd years outside 2000..2100", () => {
  assert.equal(isValidDateString("0620-01-01"), false);
  assert.equal(isValidDateString("65120-01-01"), false);
  assert.equal(isValidDateString("1999-12-31"), false);
  assert.equal(isValidDateString("2101-01-01"), false);
});

test("accepts the inclusive boundaries", () => {
  assert.equal(isValidDateString("2000-01-01"), true);
  assert.equal(isValidDateString("2100-12-31"), true);
});

test("accepts a leap day in a leap year", () => {
  assert.equal(isValidDateString("2028-02-29"), true);
  assert.equal(isValidDateString("2026-02-29"), false);
});
