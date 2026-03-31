const SUPPORTED_SUI_NETWORKS = ["testnet", "devnet"] as const;

type SupportedSuiNetwork = (typeof SUPPORTED_SUI_NETWORKS)[number];

type SuiRuntimeEnv = Partial<
  Record<
    | "VITE_SUI_NETWORK"
    | "VITE_STARLANE_PACKAGE_ID"
    | "VITE_WORLD_PACKAGE_ID"
    | "VITE_TOLL_REGISTRY_ID"
    | "VITE_EVE_WORLD_PACKAGE_ID",
    string | undefined
  >
>;

export interface SuiRuntimeConfig {
  network: SupportedSuiNetwork;
  starLanePackageId: string;
  worldPackageId: string;
  tollRegistryId: string;
  eveWorldPackageId: string;
}

function normalizeConfiguredObjectId(value: string | undefined, label: string, fallback?: string) {
  const candidate = value?.trim() || fallback;
  if (!candidate) {
    throw new Error(`${label} is required.`);
  }

  const normalizedCandidate = candidate.toLowerCase();
  const hex = normalizedCandidate.startsWith("0x")
    ? normalizedCandidate.slice(2)
    : normalizedCandidate;

  if (!hex || hex.length > 64 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error(`${label} must be a valid Sui object ID.`);
  }

  return `0x${hex.padStart(64, "0")}`;
}

export function parseSuiRuntimeConfig(env: SuiRuntimeEnv): SuiRuntimeConfig {
  const rawNetwork = env.VITE_SUI_NETWORK?.trim() || "testnet";
  if (!SUPPORTED_SUI_NETWORKS.includes(rawNetwork as SupportedSuiNetwork)) {
    throw new Error(
      `VITE_SUI_NETWORK must be one of: ${SUPPORTED_SUI_NETWORKS.join(", ")}.`
    );
  }

  return {
    network: rawNetwork as SupportedSuiNetwork,
    starLanePackageId: normalizeConfiguredObjectId(
      env.VITE_STARLANE_PACKAGE_ID,
      "VITE_STARLANE_PACKAGE_ID"
    ),
    worldPackageId: normalizeConfiguredObjectId(
      env.VITE_WORLD_PACKAGE_ID,
      "VITE_WORLD_PACKAGE_ID",
      "0x777"
    ),
    tollRegistryId: normalizeConfiguredObjectId(
      env.VITE_TOLL_REGISTRY_ID,
      "VITE_TOLL_REGISTRY_ID"
    ),
    eveWorldPackageId: normalizeConfiguredObjectId(
      env.VITE_EVE_WORLD_PACKAGE_ID,
      "VITE_EVE_WORLD_PACKAGE_ID"
    )
  };
}

const runtimeConfig = parseSuiRuntimeConfig(import.meta.env);

export const SUI_NETWORK = runtimeConfig.network;
export const STARLANE_PACKAGE_ID = runtimeConfig.starLanePackageId;
export const WORLD_PACKAGE_ID = runtimeConfig.worldPackageId;
export const TOLL_REGISTRY_ID = runtimeConfig.tollRegistryId;
export const EVE_WORLD_PACKAGE_ID = runtimeConfig.eveWorldPackageId;
