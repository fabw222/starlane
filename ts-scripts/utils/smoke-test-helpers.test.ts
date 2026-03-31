import test from "node:test";
import assert from "node:assert/strict";
import { hasExpectedFeeUpdateTransition } from "./smoke-test-helpers.js";

test("accepts the first-run register-to-update fee transition", () => {
  assert.equal(
    hasExpectedFeeUpdateTransition({
      oldFeeMist: 100n,
      newFeeMist: 150n,
      registerFeeMist: 100n,
      updatedFeeMist: 150n
    }),
    true
  );
});

test("accepts the rerun no-op transition when the fee is already updated", () => {
  assert.equal(
    hasExpectedFeeUpdateTransition({
      oldFeeMist: 150n,
      newFeeMist: 150n,
      registerFeeMist: 100n,
      updatedFeeMist: 150n
    }),
    true
  );
});

test("rejects unexpected fee transitions", () => {
  assert.equal(
    hasExpectedFeeUpdateTransition({
      oldFeeMist: 120n,
      newFeeMist: 150n,
      registerFeeMist: 100n,
      updatedFeeMist: 150n
    }),
    false
  );
  assert.equal(
    hasExpectedFeeUpdateTransition({
      oldFeeMist: 100n,
      newFeeMist: 180n,
      registerFeeMist: 100n,
      updatedFeeMist: 150n
    }),
    false
  );
});
