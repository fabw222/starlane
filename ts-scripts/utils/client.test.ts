import test from "node:test";
import assert from "node:assert/strict";
import { expectEvent, findCreatedObjectId, normalizeRequiredObjectId } from "./client.js";

test("normalizeRequiredObjectId rejects blank and zero ids", () => {
  assert.throws(() => normalizeRequiredObjectId("   ", "Gate ID"), /Gate ID is required/);
  assert.throws(() => normalizeRequiredObjectId("0x0", "Gate ID"), /Gate ID must not be 0x0/);
  assert.equal(
    normalizeRequiredObjectId("0xabc", "Gate ID"),
    "0x0000000000000000000000000000000000000000000000000000000000000abc"
  );
});

test("findCreatedObjectId normalizes addresses inside generic type params", () => {
  const createdObjectId = findCreatedObjectId(
    {
      objectChanges: [
        {
          type: "created",
          objectId: "0xabc",
          objectType:
            "0x0000000000000000000000000000000000000000000000000000000000000123::access::OwnerCap<0x123::gate::Gate>"
        }
      ]
    } as never,
    "0x123::access::OwnerCap<0x0000000000000000000000000000000000000000000000000000000000000123::gate::Gate>"
  );

  assert.equal(
    createdObjectId,
    "0x0000000000000000000000000000000000000000000000000000000000000abc"
  );
});

test("expectEvent reports the emitted event types when the expected one is missing", () => {
  assert.throws(
    () =>
      expectEvent(
        {
          events: [{ type: "pkg::module::OtherEvent" }]
        } as never,
        "pkg::module::WantedEvent"
      ),
    /Expected event pkg::module::WantedEvent, but found: \[pkg::module::OtherEvent\]/
  );
});
