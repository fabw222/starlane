import { loadConfig } from "./starlane-config.js";
import { invariant } from "./utils/assert.js";
import { createClient, createSigner, expectEvent, signAndExecute } from "./utils/client.js";
import { buildBuyJumpPermitTransaction } from "./utils/transactions.js";

const config = loadConfig();
invariant(config.playerKey, "PLAYER_KEY is required");
invariant(config.sourceGateId, "SOURCE_GATE_ID is required");
invariant(config.destinationGateId, "DEST_GATE_ID is required");
invariant(config.characterId, "CHARACTER_ID is required");

const client = createClient(config.network);
const playerSigner = createSigner(config.playerKey);
const transaction = buildBuyJumpPermitTransaction({
  packageId: config.starLanePackageId,
  tollRegistryId: config.tollRegistryId,
  sourceGateId: config.sourceGateId,
  destinationGateId: config.destinationGateId,
  characterId: config.characterId,
  feeMist: config.updatedFeeMist,
  recipient: playerSigner.toSuiAddress()
});

const response = await signAndExecute({
  client,
  signer: playerSigner,
  transaction
});

const event = expectEvent(response, `${config.starLanePackageId}::toll_gate::TollPaidEvent`);
console.log(
  JSON.stringify(
    {
      digest: response.digest,
      event: event.parsedJson
    },
    null,
    2
  )
);
