import "dotenv/config";

import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { z } from "zod";

const networkSchema = z.enum(["mainnet", "testnet", "devnet", "localnet"]);

const configSchema = z.object({
  SUI_NETWORK: networkSchema.default("testnet"),
  WORLD_PACKAGE_ID: z.string().trim().min(1),
  STARLANE_PACKAGE_ID: z.string().trim().min(1),
  TOLL_REGISTRY_ID: z.string().trim().min(1),
  OPERATOR_KEY: z.string().trim().min(1),
  PLAYER_KEY: z.string().trim().optional().default(""),
  OPERATOR_CAP_ID: z.string().trim().optional().default(""),
  SOURCE_GATE_ID: z.string().trim().optional().default(""),
  DEST_GATE_ID: z.string().trim().optional().default(""),
  CHARACTER_ID: z.string().trim().optional().default(""),
  REGISTER_GATE_ID: z.string().trim().optional().default(""),
  GATE_OWNER_CAP_ID: z.string().trim().optional().default(""),
  SOURCE_OWNER_CAP_ID: z.string().trim().optional().default(""),
  DEST_OWNER_CAP_ID: z.string().trim().optional().default(""),
  REGISTER_FEE_MIST: z.string().trim().optional().default("100000000"),
  UPDATED_FEE_MIST: z.string().trim().optional().default("150000000"),
  SOURCE_GATE_LABEL: z.string().trim().optional().default("SL-SOURCE"),
  DEST_GATE_LABEL: z.string().trim().optional().default("SL-DEST"),
  CHARACTER_CALLSIGN: z.string().trim().optional().default("SL-PILOT")
});

export function loadConfig() {
  const parsed = configSchema.parse(process.env);

  return {
    network: parsed.SUI_NETWORK,
    worldPackageId: normalizeSuiObjectId(parsed.WORLD_PACKAGE_ID),
    starLanePackageId: normalizeSuiObjectId(parsed.STARLANE_PACKAGE_ID),
    tollRegistryId: normalizeSuiObjectId(parsed.TOLL_REGISTRY_ID),
    operatorKey: parsed.OPERATOR_KEY,
    playerKey: parsed.PLAYER_KEY,
    operatorCapId: parsed.OPERATOR_CAP_ID,
    sourceGateId: parsed.SOURCE_GATE_ID,
    destinationGateId: parsed.DEST_GATE_ID,
    characterId: parsed.CHARACTER_ID,
    registerGateId: parsed.REGISTER_GATE_ID,
    gateOwnerCapId: parsed.GATE_OWNER_CAP_ID,
    sourceOwnerCapId: parsed.SOURCE_OWNER_CAP_ID,
    destOwnerCapId: parsed.DEST_OWNER_CAP_ID,
    registerFeeMist: BigInt(parsed.REGISTER_FEE_MIST),
    updatedFeeMist: BigInt(parsed.UPDATED_FEE_MIST),
    sourceGateLabel: parsed.SOURCE_GATE_LABEL,
    destinationGateLabel: parsed.DEST_GATE_LABEL,
    characterCallsign: parsed.CHARACTER_CALLSIGN
  };
}
