import test from "node:test";
import assert from "node:assert/strict";
import { extractObjectRef } from "./object-ref.js";

test("extractObjectRef returns the resolved version and digest", () => {
  const ref = extractObjectRef("0xabc", {
    data: {
      digest: "11111111111111111111111111111111",
      version: "42"
    }
  });

  assert.deepEqual(ref, {
    objectId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
    digest: "11111111111111111111111111111111",
    version: "42"
  });
});

test("extractObjectRef throws when the object ref is incomplete", () => {
  assert.throws(() => {
    extractObjectRef("0xabc", {
      data: {
        version: "42"
      }
    });
  }, /Unable to resolve object ref/);
});

test("extractObjectRef rejects zero versions", () => {
  assert.throws(() => {
    extractObjectRef("0xabc", {
      data: {
        version: "0",
        digest: "11111111111111111111111111111111"
      }
    });
  }, /Unable to resolve object ref/);
});
