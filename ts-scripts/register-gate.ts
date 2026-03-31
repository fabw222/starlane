import { loadConfig } from "./starlane-config.js";
import { invariant } from "./utils/assert.js";
import {
  createClient,
  createSigner,
  expectEvent,
  findCreatedObjectId,
  getObjectRef,
  normalizeRequiredObjectId,
  signAndExecute
} from "./utils/client.js";
import { buildRegisterGateTransaction } from "./utils/transactions.js";

const config = loadConfig();
invariant(config.registerGateId || config.destinationGateId, "REGISTER_GATE_ID or DEST_GATE_ID is required");
invariant(config.gateOwnerCapId || config.destOwnerCapId, "GATE_OWNER_CAP_ID or DEST_OWNER_CAP_ID is required");
invariant(config.characterId, "CHARACTER_ID is required for borrow_owner_cap");

const client = createClient(config.network);
const operatorSigner = createSigner(config.operatorKey);
const gateId = normalizeRequiredObjectId(
  config.registerGateId || config.destinationGateId,
  "Gate object ID"
);
const ownerCapId = normalizeRequiredObjectId(
  config.gateOwnerCapId || config.destOwnerCapId,
  "OwnerCap object ID"
);
const characterId = normalizeRequiredObjectId(config.characterId, "Character ID");

console.log("Fetching OwnerCap object ref...");
const ownerCapRef = await getObjectRef({ client, objectId: ownerCapId });
console.log(`  OwnerCap version: ${ownerCapRef.version}, digest: ${ownerCapRef.digest}`);

const transaction = buildRegisterGateTransaction({
  packageId: config.starLanePackageId,
  worldPackageId: config.worldPackageId,
  tollRegistryId: config.tollRegistryId,
  gateId,
  characterId,
  ownerCapRef,
  feeMist: config.registerFeeMist,
  recipient: operatorSigner.toSuiAddress()
});

console.log("Submitting register_gate transaction...");
const response = await signAndExecute({
  client,
  signer: operatorSigner,
  transaction
});

const event = expectEvent(response, `${config.starLanePackageId}::toll_gate::TollConfiguredEvent`);
const operatorCapId = findCreatedObjectId(response, `${config.starLanePackageId}::toll_gate::OperatorCap`);

console.log(
  JSON.stringify(
    {
      digest: response.digest,
      gateId: (event.parsedJson as Record<string, unknown>).gate_id,
      operatorCapId
    },
    null,
    2
  )
);
