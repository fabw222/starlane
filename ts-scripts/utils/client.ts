import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiObjectResponse, SuiTransactionBlockResponse } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { invariant } from "./assert.js";
import { extractObjectRef, type ResolvedObjectRef } from "./object-ref.js";

const ZERO_OBJECT_ID = normalizeSuiObjectId("0x0");

export function createClient(network: "mainnet" | "testnet" | "devnet" | "localnet") {
  return new SuiClient({
    url: getFullnodeUrl(network)
  });
}

export function createSigner(secretKey: string) {
  return Ed25519Keypair.fromSecretKey(secretKey);
}

export function normalizeRequiredObjectId(value: string, label: string) {
  const trimmed = value.trim();
  invariant(trimmed.length > 0, `${label} is required`);

  const normalized = normalizeSuiObjectId(trimmed);
  invariant(normalized !== ZERO_OBJECT_ID, `${label} must not be 0x0`);
  return normalized;
}

function normalizeTypeAddresses(typeName: string) {
  return typeName.replace(/0x[0-9a-fA-F]+/g, (value) => normalizeSuiObjectId(value));
}

export async function getObjectRef({
  client,
  objectId
}: {
  client: SuiClient;
  objectId: string;
}): Promise<ResolvedObjectRef> {
  const normalizedObjectId = normalizeRequiredObjectId(objectId, "Object ID");
  const response = (await client.getObject({
    id: normalizedObjectId
  })) as SuiObjectResponse;

  return extractObjectRef(normalizedObjectId, response);
}

export async function signAndExecute({
  client,
  signer,
  transaction
}: {
  client: SuiClient;
  signer: Ed25519Keypair;
  transaction: Transaction;
}) {
  return client.signAndExecuteTransaction({
    signer,
    transaction,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true
    }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForObject({
  client,
  objectId,
  timeoutMs = 15_000,
  intervalMs = 1_000
}: {
  client: SuiClient;
  objectId: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const normalizedObjectId = normalizeSuiObjectId(objectId);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await client.getObject({
        id: normalizedObjectId,
        options: {
          showOwner: true,
          showType: true
        }
      });

      if (response.data) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(intervalMs);
  }

  const detail = lastError instanceof Error ? lastError.message : "object did not become queryable";
  throw new Error(`Timed out waiting for object ${normalizedObjectId}: ${detail}`);
}

export function findCreatedObjectId(
  response: SuiTransactionBlockResponse,
  expectedType: string
) {
  const normalizedExpectedType = normalizeTypeAddresses(expectedType);

  for (const change of response.objectChanges ?? []) {
    if (change.type !== "created") {
      continue;
    }

    if (!("objectType" in change) || !("objectId" in change)) {
      continue;
    }

    const normalizedChangeType = normalizeTypeAddresses(String(change.objectType));

    if (normalizedChangeType === normalizedExpectedType) {
      return normalizeSuiObjectId(change.objectId);
    }
  }

  return null;
}

export function expectEvent(response: SuiTransactionBlockResponse, eventType: string) {
  const event = response.events?.find((candidate) => candidate.type === eventType);
  const actualTypes = response.events?.map((candidate) => candidate.type).join(", ") || "none";
  invariant(event, `Expected event ${eventType}, but found: [${actualTypes}]`);
  return event;
}
