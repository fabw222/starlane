import { describe, expect, it } from "vitest";
import { resolveSelectedGateId } from "./gate-selection";

const gates = [
  {
    onChainGateId: "0xgate-a",
    operator: "0xoperator-a",
    feeMist: "100",
    txDigest: "0xtx-a",
    txCount: 1,
    totalFeeMist: "100",
    totalOperatorRevenue: "99",
    lastJumpAt: "1",
    registeredAt: "1"
  },
  {
    onChainGateId: "0xgate-b",
    operator: "0xoperator-b",
    feeMist: "200",
    txDigest: "0xtx-b",
    txCount: 2,
    totalFeeMist: "200",
    totalOperatorRevenue: "198",
    lastJumpAt: "2",
    registeredAt: "2"
  }
];

describe("resolveSelectedGateId", () => {
  it("returns the first gate when the current selection is empty", () => {
    expect(resolveSelectedGateId("", gates)).toBe("0xgate-a");
  });

  it("returns the first gate when the current selection no longer exists", () => {
    expect(resolveSelectedGateId("0xmissing", gates)).toBe("0xgate-a");
  });

  it("preserves a valid selection", () => {
    expect(resolveSelectedGateId("0xgate-b", gates)).toBe("0xgate-b");
  });

  it("returns an empty string when there are no gates", () => {
    expect(resolveSelectedGateId("0xanything", [])).toBe("");
  });
});
