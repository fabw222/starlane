import { loadConfig } from "./starlane-config.js";
import { invariant } from "./utils/assert.js";
import { createClient, createSigner, signAndExecute } from "./utils/client.js";
import { buildWithdrawRevenueTransaction } from "./utils/transactions.js";

const config = loadConfig();
invariant(config.operatorCapId, "OPERATOR_CAP_ID is required");

const client = createClient(config.network);
const operatorSigner = createSigner(config.operatorKey);
const transaction = buildWithdrawRevenueTransaction({
  packageId: config.starLanePackageId,
  tollRegistryId: config.tollRegistryId,
  operatorCapId: config.operatorCapId,
  recipient: operatorSigner.toSuiAddress()
});

const response = await signAndExecute({
  client,
  signer: operatorSigner,
  transaction
});

console.log(
  JSON.stringify(
    {
      digest: response.digest,
      effects: response.effects?.status
    },
    null,
    2
  )
);
