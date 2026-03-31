/// Set dApp URL on a Smart Assembly (Gate) in EVE Frontier.
/// When a player interacts with the Gate in-game, the in-game browser opens this URL.
///
/// Usage:
///   npx tsx set-assembly-url.ts --assembly <ID> --character <ID> --ownercap <ID> [--url <URL>]
///
/// The World Package ID is the EVE Frontier Utopia World contract on Sui testnet.

import { Transaction } from "@mysten/sui/transactions";
import { loadConfig } from "./starlane-config.js";
import {
  createClient,
  createSigner,
  getObjectRef,
  normalizeRequiredObjectId,
  signAndExecute
} from "./utils/client.js";

const DEFAULT_DAPP_URL = "https://starlane.vercel.app";

function parseArgs() {
  const args = process.argv.slice(2);
  let assemblyId = "";
  let characterId = "";
  let ownerCapId = "";
  let url = DEFAULT_DAPP_URL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--assembly" && args[i + 1]) assemblyId = args[++i];
    else if (args[i] === "--character" && args[i + 1]) characterId = args[++i];
    else if (args[i] === "--ownercap" && args[i + 1]) ownerCapId = args[++i];
    else if (args[i] === "--url" && args[i + 1]) url = args[++i];
  }

  return { assemblyId, characterId, ownerCapId, url };
}

async function main() {
  const parsedArgs = parseArgs();

  if (!parsedArgs.assemblyId || !parsedArgs.characterId || !parsedArgs.ownerCapId) {
    console.log(
      "Usage: npx tsx set-assembly-url.ts --assembly <ID> --character <ID> --ownercap <ID> [--url <URL>]"
    );
    console.log(
      "\nThis sets the dApp URL on an EVE Frontier Smart Assembly (Gate)."
    );
    console.log(
      "When players interact with the gate in-game, the in-game browser opens this URL."
    );
    console.log(`\nDefault URL: ${DEFAULT_DAPP_URL}`);
    process.exit(1);
  }

  const config = loadConfig();
  const client = createClient(config.network);
  const signer = createSigner(config.operatorKey);
  const assemblyId = normalizeRequiredObjectId(parsedArgs.assemblyId, "Assembly ID");
  const characterId = normalizeRequiredObjectId(parsedArgs.characterId, "Character ID");
  const ownerCapId = normalizeRequiredObjectId(parsedArgs.ownerCapId, "OwnerCap ID");
  const url = parsedArgs.url;

  console.log("Setting dApp URL on assembly...");
  console.log(`  Assembly: ${assemblyId}`);
  console.log(`  Character: ${characterId}`);
  console.log(`  OwnerCap: ${ownerCapId}`);
  console.log(`  URL: ${url}`);

  const ownerCapRef = await getObjectRef({ client, objectId: ownerCapId });
  const tx = new Transaction();

  // Step 1: Borrow OwnerCap from Character
  const [ownerCap, receipt] = tx.moveCall({
    target: `${config.worldPackageId}::character::borrow_owner_cap`,
    typeArguments: [
      `${config.worldPackageId}::assembly::Assembly`,
    ],
    arguments: [
      tx.object(characterId),
      tx.receivingRef(ownerCapRef),
    ],
  });

  // Step 2: Update metadata URL
  tx.moveCall({
    target: `${config.worldPackageId}::assembly::update_metadata_url`,
    arguments: [tx.object(assemblyId), ownerCap, tx.pure.string(url)],
  });

  // Step 3: Return OwnerCap to Character
  tx.moveCall({
    target: `${config.worldPackageId}::character::return_owner_cap`,
    typeArguments: [
      `${config.worldPackageId}::assembly::Assembly`,
    ],
    arguments: [tx.object(characterId), ownerCap, receipt],
  });

  try {
    const result = await signAndExecute({ client, signer, transaction: tx });
    console.log("\nURL set successfully!");
    console.log(`  Tx digest: ${result.digest}`);
    console.log(
      `\nPlayers can now open this assembly in-game to see StarLane at: ${url}`
    );
  } catch (err) {
    console.error("Failed:", err);
    console.log(
      "\nPossible causes:"
    );
    console.log("  - The Assembly ID is not a valid Smart Assembly object");
    console.log("  - The OwnerCap does not belong to this assembly");
    console.log("  - The Character does not own this OwnerCap");
    console.log(
      "  - The EVE World Package ID may have changed (check EVE Frontier docs)"
    );
  }
}

main().catch(console.error);
