import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@evefrontier/dapp-kit";
import { executeGraphQLQuery } from "@evefrontier/dapp-kit/graphql";
import { parseCharacterFromJson } from "@evefrontier/dapp-kit/utils";
import { STARLANE_PACKAGE_ID } from "@/lib/sui-config";

/** An OperatorCap with the gate it controls. */
export interface OperatorCapInfo {
  address: string;
  gateId: string;
}

/** A Gate (or Assembly) owned by the character via OwnerCap. */
export interface OwnedGateInfo {
  /** The Gate/Assembly object ID (authorized_object_id). */
  gateId: string;
  /** The OwnerCap object address (needed for register_gate tx). */
  ownerCapAddress: string;
  /** The Assembly type (from contents.type.repr). */
  typeRepr: string;
  /** The OwnerCap's full type (e.g. OwnerCap<Gate> or OwnerCap<Assembly>). */
  ownerCapType: string;
}

export interface WalletObjects {
  characterId: string | null;
  characterName: string | null;
  /** Gates/Assemblies owned by this character (via OwnerCap). */
  ownedGates: OwnedGateInfo[];
  /** StarLane OperatorCaps with gate_id mapping. */
  operatorCaps: OperatorCapInfo[];
  /** Quick lookup: gate_id → OperatorCap address. */
  operatorCapByGate: Record<string, string>;
}

const EMPTY: WalletObjects = {
  characterId: null,
  characterName: null,
  ownedGates: [],
  operatorCaps: [],
  operatorCapByGate: {},
};

/** Custom query to fetch Character's OwnerCaps with their addresses and authorized Assembly data. */
const GET_CHARACTER_OWNERCAPS = `
  query GetCharacterOwnerCaps($owner: SuiAddress!, $characterPlayerProfileType: String!) {
    address(address: $owner) {
      objects(last: 1, filter: { type: $characterPlayerProfileType }) {
        nodes {
          contents {
            extract(path: "character_id") {
              asAddress {
                asObject {
                  asMoveObject {
                    contents { type { repr } json }
                  }
                }
                objects {
                  nodes {
                    address
                    contents {
                      type { repr }
                      json
                      extract(path: "authorized_object_id") {
                        asAddress {
                          asObject {
                            asMoveObject {
                              contents { type { repr } json }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/** Custom query to fetch OperatorCaps with gate_id JSON. */
const GET_OPERATOR_CAPS_WITH_JSON = `
  query GetOperatorCaps($owner: SuiAddress!, $capType: String!) {
    address(address: $owner) {
      objects(filter: { type: $capType }) {
        nodes {
          address
          asMoveObject {
            contents {
              json
            }
          }
        }
      }
    }
  }
`;

interface OperatorCapNode {
  address: string;
  asMoveObject?: {
    contents?: {
      json?: { gate_id?: string; operator?: string };
    };
  } | null;
}

interface OperatorCapsResponse {
  address?: {
    objects?: {
      nodes?: OperatorCapNode[];
    };
  };
}

async function fetchWalletObjects(
  walletAddress: string,
): Promise<WalletObjects> {
  const operatorCapType = `${STARLANE_PACKAGE_ID}::toll_gate::OperatorCap`;

  const characterPlayerProfileType = (() => {
    try {
      const pkg =
        import.meta.env.VITE_EVE_WORLD_PACKAGE_ID;
      return pkg ? `${pkg}::character::PlayerProfile` : "";
    } catch {
      return "";
    }
  })();

  const [charResult, capsResult] = await Promise.all([
    characterPlayerProfileType
      ? executeGraphQLQuery<{
          address?: {
            objects?: {
              nodes?: Array<{
                contents?: {
                  extract?: {
                    asAddress?: {
                      asObject?: {
                        asMoveObject?: {
                          contents?: { type?: { repr: string }; json?: unknown };
                        };
                      };
                      objects?: {
                        nodes?: Array<{
                          address: string;
                          contents?: {
                            type?: { repr: string };
                            json?: unknown;
                            extract?: {
                              asAddress?: {
                                asObject?: {
                                  asMoveObject?: {
                                    contents?: {
                                      type?: { repr: string };
                                      json?: unknown;
                                    };
                                  };
                                };
                              };
                            };
                          };
                        }>;
                      };
                    };
                  };
                };
              }>;
            };
          };
        }>(GET_CHARACTER_OWNERCAPS, {
          owner: walletAddress,
          characterPlayerProfileType,
        })
      : Promise.resolve({ data: undefined } as { data: undefined }),
    executeGraphQLQuery<OperatorCapsResponse>(GET_OPERATOR_CAPS_WITH_JSON, {
      owner: walletAddress,
      capType: operatorCapType,
    }),
  ]);

  // --- Character + owned gates (from OwnerCap chain) ---
  const profileNode = charResult.data?.address?.objects?.nodes?.[0];
  const charExtract = profileNode?.contents?.extract?.asAddress;

  const characterJson = charExtract?.asObject?.asMoveObject?.contents?.json;
  const character = characterJson
    ? parseCharacterFromJson(characterJson)
    : null;

  const ownerCapNodes = charExtract?.objects?.nodes ?? [];
  const ownedGates: OwnedGateInfo[] = [];

  for (const node of ownerCapNodes) {
    const assemblyData =
      node.contents?.extract?.asAddress?.asObject?.asMoveObject?.contents;
    if (!assemblyData?.json) continue;
    const json = assemblyData.json as Record<string, unknown>;
    const id = json.id as string | undefined;
    const typeRepr = assemblyData.type?.repr ?? "";
    const ownerCapType = node.contents?.type?.repr ?? "";
    if (id) {
      ownedGates.push({
        gateId: id,
        ownerCapAddress: node.address,
        typeRepr,
        ownerCapType,
      });
    }
  }

  // --- StarLane OperatorCaps ---
  const capNodes = capsResult.data?.address?.objects?.nodes ?? [];
  const operatorCaps: OperatorCapInfo[] = capNodes
    .map((n) => ({
      address: n.address,
      gateId: n.asMoveObject?.contents?.json?.gate_id ?? "",
    }))
    .filter((c) => c.gateId);

  const operatorCapByGate: Record<string, string> = {};
  for (const cap of operatorCaps) {
    operatorCapByGate[cap.gateId] = cap.address;
  }

  return {
    characterId: character?.id ?? null,
    characterName: character?.name ?? null,
    ownedGates,
    operatorCaps,
    operatorCapByGate,
  };
}

/**
 * Queries the connected wallet for all StarLane-relevant objects:
 * Character, owned Gates (via OwnerCap chain), and StarLane OperatorCaps.
 */
export function useWalletObjects() {
  const { walletAddress, isConnected } = useConnection();

  return useQuery({
    queryKey: ["walletObjects", walletAddress],
    queryFn: () => fetchWalletObjects(walletAddress!),
    enabled: isConnected && !!walletAddress,
    staleTime: 30_000,
    placeholderData: EMPTY,
  });
}
