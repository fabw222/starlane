import { describe, expect, it } from "vitest";
import {
  parseSuiRuntimeConfig
} from "./sui-config";
import {
  getSuccessfulTransactionDigest,
  normalizeRequiredSuiObjectId
} from "./sui-transactions";

describe("parseSuiRuntimeConfig", () => {
  it("requires the published StarLane ids at startup", () => {
    expect(() => parseSuiRuntimeConfig({ VITE_TOLL_REGISTRY_ID: "0x2" })).toThrow(
      "VITE_STARLANE_PACKAGE_ID is required."
    );
    expect(() => parseSuiRuntimeConfig({ VITE_STARLANE_PACKAGE_ID: "0x1" })).toThrow(
      "VITE_TOLL_REGISTRY_ID is required."
    );
  });

  it("defaults the network and normalizes configured object ids", () => {
    const config = parseSuiRuntimeConfig({
      VITE_STARLANE_PACKAGE_ID: "0x1",
      VITE_TOLL_REGISTRY_ID: "0x2"
    });

    expect(config.network).toBe("testnet");
    expect(config.starLanePackageId).toHaveLength(66);
    expect(config.tollRegistryId).toHaveLength(66);
    expect(config.worldPackageId).toHaveLength(66);
  });

  it("rejects wallet networks that the Eve provider cannot execute against", () => {
    expect(() =>
      parseSuiRuntimeConfig({
        VITE_SUI_NETWORK: "mainnet",
        VITE_STARLANE_PACKAGE_ID: "0x1",
        VITE_TOLL_REGISTRY_ID: "0x2"
      })
    ).toThrow("VITE_SUI_NETWORK must be one of: testnet, devnet.");

    expect(() =>
      parseSuiRuntimeConfig({
        VITE_SUI_NETWORK: "localnet",
        VITE_STARLANE_PACKAGE_ID: "0x1",
        VITE_TOLL_REGISTRY_ID: "0x2"
      })
    ).toThrow("VITE_SUI_NETWORK must be one of: testnet, devnet.");
  });
});

describe("normalizeRequiredSuiObjectId", () => {
  it("normalizes valid ids and rejects malformed input", () => {
    const normalized = normalizeRequiredSuiObjectId(" 0x2 ", "Character object ID");
    expect(normalized).toHaveLength(66);
    expect(() => normalizeRequiredSuiObjectId("not-an-object-id", "Character object ID")).toThrow(
      "Character object ID must be a valid Sui object ID."
    );
  });
});

describe("getSuccessfulTransactionDigest", () => {
  it("returns the digest from a successful transaction", () => {
    expect(getSuccessfulTransactionDigest({ Transaction: { digest: "0xabc" } })).toBe("0xabc");
  });

  it("throws the wallet error when execution fails", () => {
    expect(() =>
      getSuccessfulTransactionDigest({
        FailedTransaction: {
          digest: "0xdef",
          status: {
            error: {
              message: "Insufficient gas"
            }
          }
        }
      })
    ).toThrow("Transaction failed: Insufficient gas");
  });
});
