import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { loadConfig } from "./starlane-config.js";
import { invariant } from "./utils/assert.js";
import {
  createClient,
  createSigner,
  expectEvent,
  findCreatedObjectId,
  signAndExecute,
  waitForObject
} from "./utils/client.js";
import { hasExpectedFeeUpdateTransition } from "./utils/smoke-test-helpers.js";
import {
  buildBuyJumpPermitTransaction,
  buildCreateCharacterTransaction,
  buildCreateGateTransaction,
  buildRegisterGateTransaction,
  buildUpdateFeeTransaction,
  buildWithdrawRevenueTransaction
} from "./utils/transactions.js";

const config = loadConfig();
invariant(config.playerKey, "PLAYER_KEY is required for smoke test");

const client = createClient(config.network);
const operatorSigner = createSigner(config.operatorKey);
const playerSigner = createSigner(config.playerKey);

type RegisterGateResult = {
  response: Awaited<ReturnType<typeof signAndExecute>> | null;
  operatorCapId: string | null;
};

async function isGateRegistered(gateId: string) {
  const normalizedGateId = normalizeSuiObjectId(gateId);
  const eventType = `${config.starLanePackageId}::toll_gate::TollConfiguredEvent`;
  let cursor:
    | {
        txDigest: string;
        eventSeq: string;
      }
    | null
    | undefined = undefined;

  while (true) {
    const response = await client.queryEvents({
      query: { MoveEventType: eventType },
      limit: 50,
      order: "ascending",
      cursor
    });

    if (
      response.data.some((event) => {
        const parsed = event.parsedJson as Record<string, unknown>;
        const configuredGateId = parsed.gate_id;
        return typeof configuredGateId === "string" && normalizeSuiObjectId(configuredGateId) === normalizedGateId;
      })
    ) {
      return true;
    }

    if (!response.hasNextPage || !response.nextCursor) {
      return false;
    }

    cursor = {
      txDigest: response.nextCursor.txDigest,
      eventSeq: String(response.nextCursor.eventSeq)
    };
  }
}

async function registerGateIfNeeded({
  gateId,
  ownerCapId,
  signer,
  recipient,
  existingOperatorCapId
}: {
  gateId: string;
  ownerCapId: string;
  signer: typeof operatorSigner;
  recipient: string;
  existingOperatorCapId?: string;
}): Promise<RegisterGateResult> {
  if (await isGateRegistered(gateId)) {
    return {
      response: null,
      operatorCapId: existingOperatorCapId ?? null
    };
  }

  const response = await signAndExecute({
    client,
    signer,
    transaction: buildRegisterGateTransaction({
      packageId: config.starLanePackageId,
      tollRegistryId: config.tollRegistryId,
      gateId,
      ownerCapId,
      feeMist: config.registerFeeMist,
      recipient
    })
  });

  expectEvent(response, `${config.starLanePackageId}::toll_gate::TollConfiguredEvent`);
  return {
    response,
    operatorCapId: findCreatedObjectId(response, `${config.starLanePackageId}::toll_gate::OperatorCap`)
  };
}

async function ensureGate({
  existingId,
  existingOwnerCapId,
  ownerAddress,
  signer
}: {
  existingId: string;
  existingOwnerCapId: string;
  ownerAddress: string;
  signer: typeof operatorSigner;
}): Promise<{ gateId: string; ownerCapId: string }> {
  if (existingId && existingOwnerCapId) {
    return {
      gateId: normalizeSuiObjectId(existingId),
      ownerCapId: normalizeSuiObjectId(existingOwnerCapId)
    };
  }

  const response = await signAndExecute({
    client,
    signer,
    transaction: buildCreateGateTransaction({
      worldPackageId: config.worldPackageId,
      operator: ownerAddress
    })
  });

  const gateId = findCreatedObjectId(response, `${config.worldPackageId}::gate::Gate`);
  invariant(gateId, "Failed to create gate");

  // OwnerCap<Gate> type includes the Gate type parameter
  const ownerCapId = findCreatedObjectId(
    response,
    `${config.worldPackageId}::access::OwnerCap<${config.worldPackageId}::gate::Gate>`
  );
  invariant(ownerCapId, "Failed to find OwnerCap<Gate> in gate creation TX");

  await waitForObject({ client, objectId: gateId });
  await waitForObject({ client, objectId: ownerCapId });
  return { gateId, ownerCapId };
}

async function ensureCharacter(existingId: string, callsign: string, ownerAddress: string) {
  if (existingId) {
    return normalizeSuiObjectId(existingId);
  }

  const response = await signAndExecute({
    client,
    signer: playerSigner,
    transaction: buildCreateCharacterTransaction({
      worldPackageId: config.worldPackageId,
      owner: ownerAddress,
      callsign
    })
  });

  const characterId = findCreatedObjectId(response, `${config.worldPackageId}::character::Character`);
  invariant(characterId, `Failed to create character ${callsign}`);
  await waitForObject({ client, objectId: characterId });
  return characterId;
}

// --- Step 1: Ensure gates and character exist ---

const sourceGate = await ensureGate({
  existingId: config.sourceGateId,
  existingOwnerCapId: config.sourceOwnerCapId,
  ownerAddress: playerSigner.toSuiAddress(),
  signer: playerSigner
});

const destGate = await ensureGate({
  existingId: config.destinationGateId,
  existingOwnerCapId: config.destOwnerCapId,
  ownerAddress: operatorSigner.toSuiAddress(),
  signer: operatorSigner
});

const characterId = await ensureCharacter(
  config.characterId,
  config.characterCallsign,
  playerSigner.toSuiAddress()
);

// --- Step 2: Register BOTH gates with StarLane ---
// Both gates need TollAuth extension for jump permits to work.

// Register source gate (player is operator of source)
const sourceRegistration = await registerGateIfNeeded({
  gateId: sourceGate.gateId,
  ownerCapId: sourceGate.ownerCapId,
  signer: playerSigner,
  recipient: playerSigner.toSuiAddress()
});
const sourceOperatorCapId = sourceRegistration.operatorCapId;
if (sourceOperatorCapId) {
  await waitForObject({ client, objectId: sourceOperatorCapId });
}

// Register destination gate (operator is operator of destination)
const destinationRegistration = await registerGateIfNeeded({
  gateId: destGate.gateId,
  ownerCapId: destGate.ownerCapId,
  signer: operatorSigner,
  recipient: operatorSigner.toSuiAddress(),
  existingOperatorCapId: config.operatorCapId || undefined
});
const registerEvent = destinationRegistration.response
  ? expectEvent(
      destinationRegistration.response,
      `${config.starLanePackageId}::toll_gate::TollConfiguredEvent`
    )
  : null;
const destOperatorCapId = destinationRegistration.operatorCapId;
invariant(
  destOperatorCapId,
  "Destination gate is already registered. Set OPERATOR_CAP_ID to reuse the existing OperatorCap."
);
await waitForObject({ client, objectId: destOperatorCapId });

// --- Step 3: Update fee on destination gate ---

const feeUpdateResponse = await signAndExecute({
  client,
  signer: operatorSigner,
  transaction: buildUpdateFeeTransaction({
    packageId: config.starLanePackageId,
    tollRegistryId: config.tollRegistryId,
    operatorCapId: destOperatorCapId,
    feeMist: config.updatedFeeMist
  })
});

const feeUpdateEvent = expectEvent(feeUpdateResponse, `${config.starLanePackageId}::toll_gate::TollFeeUpdatedEvent`);
const feeUpdatePayload = feeUpdateEvent.parsedJson as Record<string, unknown>;
const oldFeeMist = BigInt(String(feeUpdatePayload.old_fee_mist));
const newFeeMist = BigInt(String(feeUpdatePayload.new_fee_mist));
invariant(
  hasExpectedFeeUpdateTransition({
    oldFeeMist,
    newFeeMist,
    registerFeeMist: config.registerFeeMist,
    updatedFeeMist: config.updatedFeeMist
  }),
  "Unexpected fee transition"
);

// --- Step 4: Buy jump permit (player pays destination toll) ---

const buyResponse = await signAndExecute({
  client,
  signer: playerSigner,
  transaction: buildBuyJumpPermitTransaction({
    packageId: config.starLanePackageId,
    tollRegistryId: config.tollRegistryId,
    sourceGateId: sourceGate.gateId,
    destinationGateId: destGate.gateId,
    characterId,
    feeMist: config.updatedFeeMist,
    recipient: playerSigner.toSuiAddress()
  })
});

const buyEvent = expectEvent(buyResponse, `${config.starLanePackageId}::toll_gate::TollPaidEvent`);
const buyPayload = buyEvent.parsedJson as Record<string, unknown>;
const feeMist = BigInt(String(buyPayload.fee_mist));
const protocolFee = BigInt(String(buyPayload.protocol_fee));
const operatorRevenue = BigInt(String(buyPayload.operator_revenue));
invariant(feeMist === config.updatedFeeMist, "buy_jump_permit used unexpected fee");
invariant(protocolFee === (feeMist * 1n) / 100n, "Protocol fee is not 1%");
invariant(operatorRevenue === feeMist - protocolFee, "Operator revenue does not equal 99%");
invariant(protocolFee + operatorRevenue === feeMist, "Fee split does not balance");

// --- Step 5: Withdraw revenue ---

const withdrawResponse = await signAndExecute({
  client,
  signer: operatorSigner,
  transaction: buildWithdrawRevenueTransaction({
    packageId: config.starLanePackageId,
    tollRegistryId: config.tollRegistryId,
    operatorCapId: destOperatorCapId,
    recipient: operatorSigner.toSuiAddress()
  })
});

console.log(
  JSON.stringify(
    {
      network: config.network,
      assets: {
        sourceGateId: sourceGate.gateId,
        sourceOwnerCapId: sourceGate.ownerCapId,
        sourceOperatorCapId,
        destinationGateId: destGate.gateId,
        destOwnerCapId: destGate.ownerCapId,
        destOperatorCapId,
        characterId
      },
      registerSourceTxDigest: sourceRegistration.response?.digest ?? null,
      registerDestTxDigest: destinationRegistration.response?.digest ?? null,
      feeUpdateTxDigest: feeUpdateResponse.digest,
      buyTxDigest: buyResponse.digest,
      withdrawTxDigest: withdrawResponse.digest,
      registerEvent: registerEvent?.parsedJson ?? null,
      feeUpdateEvent: feeUpdateEvent.parsedJson,
      buyEvent: buyEvent.parsedJson,
      withdrawEffects: withdrawResponse.effects?.status
    },
    null,
    2
  )
);
