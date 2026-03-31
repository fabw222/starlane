import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiObjectId, normalizeSuiObjectId } from "@mysten/sui/utils";
import { STARLANE_PACKAGE_ID, TOLL_REGISTRY_ID, EVE_WORLD_PACKAGE_ID } from "./sui-config";
import { getSuiClient } from "./sui-runtime";

const SUI_CLOCK_OBJECT_ID = "0x6";

export async function fetchObjectRef(objectId: string) {
  const client = getSuiClient();
  let obj = await client.getObject({ id: objectId });
  // Retry once after a short delay if object not found (node propagation lag)
  if (!obj.data) {
    await new Promise((r) => setTimeout(r, 2000));
    obj = await client.getObject({ id: objectId });
  }
  if (!obj.data) throw new Error(`OwnerCap object not found: ${objectId.slice(0, 10)}… — try again in a few seconds`);
  return {
    objectId: obj.data.objectId,
    version: obj.data.version!,
    digest: obj.data.digest!,
  };
}

type TransactionResultLike = {
  Transaction?: { digest: string } | null;
  FailedTransaction?:
    | {
        digest: string;
        status?: {
          error?: { message?: string | null } | string | null;
        } | null;
      }
    | null;
};

function normalizeConfiguredObjectId(value: string | undefined, label: string) {
  const candidate = value?.trim();
  if (!candidate) {
    throw new Error(`${label} is required.`);
  }

  try {
    const normalized = normalizeSuiObjectId(candidate);
    if (!isValidSuiObjectId(normalized)) {
      throw new Error("invalid object id");
    }

    return normalized;
  } catch {
    throw new Error(`${label} must be a valid Sui object ID.`);
  }
}

function getTransactionFailureMessage(result: TransactionResultLike) {
  const error = result.FailedTransaction?.status?.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return "wallet execution failed.";
}

export function normalizeRequiredSuiObjectId(value: string, label: string) {
  return normalizeConfiguredObjectId(value, label);
}

export function getSuccessfulTransactionDigest(result: TransactionResultLike) {
  const digest = result.Transaction?.digest;
  if (digest) {
    return digest;
  }

  throw new Error(`Transaction failed: ${getTransactionFailureMessage(result)}`);
}

export function buildRegisterGateTransaction({
  gateObjectId,
  characterId,
  ownerCapRef,
  feeMist,
  recipient
}: {
  gateObjectId: string;
  characterId: string;
  ownerCapRef: { objectId: string; version: string | number; digest: string };
  feeMist: bigint | number;
  recipient: string;
}) {
  const tx = new Transaction();

  // Step 1: Borrow OwnerCap<Gate> from Character
  const [ownerCap, receipt] = tx.moveCall({
    target: `${EVE_WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
    typeArguments: [`${EVE_WORLD_PACKAGE_ID}::gate::Gate`],
    arguments: [
      tx.object(characterId),
      tx.receivingRef(ownerCapRef),
    ],
  });

  // Step 2: Register gate with borrowed OwnerCap
  const operatorCap = tx.moveCall({
    target: `${STARLANE_PACKAGE_ID}::toll_gate::register_gate`,
    arguments: [
      tx.object(TOLL_REGISTRY_ID),
      tx.object(gateObjectId),
      ownerCap,
      tx.pure.u64(feeMist)
    ]
  });

  // Step 3: Return OwnerCap to Character
  tx.moveCall({
    target: `${EVE_WORLD_PACKAGE_ID}::character::return_owner_cap`,
    typeArguments: [`${EVE_WORLD_PACKAGE_ID}::gate::Gate`],
    arguments: [
      tx.object(characterId),
      ownerCap,
      receipt,
    ],
  });

  tx.transferObjects([operatorCap], tx.pure.address(recipient));
  return tx;
}

export function buildUpdateFeeTransaction({
  operatorCapId,
  newFeeMist
}: {
  operatorCapId: string;
  newFeeMist: bigint | number;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${STARLANE_PACKAGE_ID}::toll_gate::update_toll_fee`,
    arguments: [tx.object(TOLL_REGISTRY_ID), tx.object(operatorCapId), tx.pure.u64(newFeeMist)]
  });
  return tx;
}

export function buildWithdrawRevenueTransaction({
  operatorCapId,
  recipient
}: {
  operatorCapId: string;
  recipient: string;
}) {
  const tx = new Transaction();
  const payout = tx.moveCall({
    target: `${STARLANE_PACKAGE_ID}::toll_gate::withdraw_revenue`,
    arguments: [tx.object(TOLL_REGISTRY_ID), tx.object(operatorCapId)]
  });
  tx.transferObjects([payout], tx.pure.address(recipient));
  return tx;
}

export function buildBuyJumpPermitTransaction({
  sourceGateId,
  destinationGateId,
  characterId,
  feeMist,
  recipient
}: {
  sourceGateId: string;
  destinationGateId: string;
  characterId: string;
  feeMist: bigint | number;
  recipient: string;
}) {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(feeMist)]);

  const change = tx.moveCall({
    target: `${STARLANE_PACKAGE_ID}::toll_gate::buy_jump_permit`,
    arguments: [
      tx.object(TOLL_REGISTRY_ID),
      tx.object(sourceGateId),
      tx.object(destinationGateId),
      tx.object(characterId),
      payment,
      tx.object(SUI_CLOCK_OBJECT_ID)
    ]
  });
  tx.transferObjects([change], tx.pure.address(recipient));
  return tx;
}
