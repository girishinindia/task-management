import test from "node:test";
import assert from "node:assert/strict";
import { pct, completionRate } from "../../lib/analytics-util";

test("pct computes a rounded percentage", () => {
  assert.equal(pct(1, 4), 25);
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(2, 3), 67);
});

test("pct returns 0 when total is 0 (no NaN)", () => {
  assert.equal(pct(0, 0), 0);
  assert.equal(pct(5, 0), 0);
});

test("pct clamps to 0..100", () => {
  assert.equal(pct(10, 5), 100);
  assert.equal(pct(-3, 5), 0);
});

test("completionRate is done / total", () => {
  assert.equal(completionRate(0, 10), 0);
  assert.equal(completionRate(10, 10), 100);
  assert.equal(completionRate(3, 4), 75);
});
