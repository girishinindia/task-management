import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL_TRANSITIONS, MEMBER_STATUSES } from "../../lib/schemas/status";
import { TASK_STATUSES } from "../../lib/schemas/tasks";

test("every status has a transition entry", () => {
  for (const s of TASK_STATUSES) {
    assert.ok(
      Array.isArray(LEGAL_TRANSITIONS[s]),
      `missing transitions for ${s}`
    );
  }
});

test("pending can start or cancel but not jump to done", () => {
  assert.deepEqual(LEGAL_TRANSITIONS.pending, ["in_progress", "cancelled"]);
  assert.ok(!LEGAL_TRANSITIONS.pending.includes("done"));
});

test("in_progress can complete, block, or cancel", () => {
  assert.ok(LEGAL_TRANSITIONS.in_progress.includes("done"));
  assert.ok(LEGAL_TRANSITIONS.in_progress.includes("blocked"));
});

test("done and cancelled can be re-opened", () => {
  assert.ok(LEGAL_TRANSITIONS.done.includes("in_progress"));
  assert.ok(LEGAL_TRANSITIONS.cancelled.includes("pending"));
});

test("transitions only target real statuses", () => {
  for (const targets of Object.values(LEGAL_TRANSITIONS)) {
    for (const t of targets) {
      assert.ok(
        (TASK_STATUSES as readonly string[]).includes(t),
        `unknown target ${t}`
      );
    }
  }
});

test("members may only set in_progress or done", () => {
  assert.deepEqual([...MEMBER_STATUSES].sort(), ["done", "in_progress"]);
  assert.ok(!MEMBER_STATUSES.includes("blocked"));
  assert.ok(!MEMBER_STATUSES.includes("cancelled"));
  assert.ok(!MEMBER_STATUSES.includes("pending"));
});
