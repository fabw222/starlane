import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Assemblies, AssemblyType } from "@evefrontier/dapp-kit";

export interface EveContext {
  /** Smart Assembly (gate) object ID passed by the EVE in-game browser. */
  itemId: string | null;
  /** Tenant ID passed by the EVE in-game browser. */
  tenant: string | null;
  /** Whether the app is running inside the EVE in-game browser. */
  isInGame: boolean;
  /** Smart Assembly data from the EVE dApp Kit (populated when in-game). */
  assembly?: AssemblyType<Assemblies> | null;
}

/**
 * Reads EVE Frontier in-game browser query parameters.
 *
 * When a player opens a Smart Assembly's dApp URL in-game, the browser
 * appends `?itemId=<assemblyObjectId>&tenant=<tenantId>` to the URL.
 */
export function useEveContext(): EveContext {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const itemId = searchParams.get("itemId") || null;
    const tenant = searchParams.get("tenant") || null;
    return { itemId, tenant, isInGame: itemId !== null };
  }, [searchParams]);
}
