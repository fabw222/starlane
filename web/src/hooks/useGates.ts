import { useQuery } from "@tanstack/react-query";
import {
  queryAllGateConfiguredEvents,
  queryAllJumpEvents,
  queryAllFeeUpdateEvents
} from "@/lib/chain-queries";
import type { GateSummary } from "@/lib/contracts";

async function fetchGates(): Promise<GateSummary[]> {
  const { getSuiClient } = await import("@/lib/sui-runtime");
  const client = getSuiClient();

  const [configuredEvents, jumpEvents, feeUpdateEvents] = await Promise.all([
    queryAllGateConfiguredEvents(client),
    queryAllJumpEvents(client),
    queryAllFeeUpdateEvents(client)
  ]);

  // Build latest fee map from fee update events (last update wins)
  const latestFee = new Map<string, string>();
  for (const event of feeUpdateEvents) {
    latestFee.set(event.gateId, event.newFeeMist);
  }

  // Aggregate jump stats per gate
  const jumpStats = new Map<
    string,
    { txCount: number; totalFeeMist: bigint; totalOperatorRevenue: bigint; lastJumpAt: string | null }
  >();
  for (const event of jumpEvents) {
    const existing = jumpStats.get(event.gateId) ?? {
      txCount: 0,
      totalFeeMist: 0n,
      totalOperatorRevenue: 0n,
      lastJumpAt: null
    };
    existing.txCount += 1;
    existing.totalFeeMist += BigInt(event.feeMist);
    existing.totalOperatorRevenue += BigInt(event.operatorRevenue);
    if (!existing.lastJumpAt || BigInt(event.timestampMs) > BigInt(existing.lastJumpAt)) {
      existing.lastJumpAt = event.timestampMs;
    }
    jumpStats.set(event.gateId, existing);
  }

  // Merge into GateSummary[]
  return configuredEvents.map((config) => {
    const stats = jumpStats.get(config.gateId);
    return {
      onChainGateId: config.gateId,
      operator: config.operator,
      feeMist: latestFee.get(config.gateId) ?? config.feeMist,
      txDigest: config.txDigest,
      txCount: stats?.txCount ?? 0,
      totalFeeMist: (stats?.totalFeeMist ?? 0n).toString(),
      totalOperatorRevenue: (stats?.totalOperatorRevenue ?? 0n).toString(),
      lastJumpAt: stats?.lastJumpAt ?? null,
      registeredAt: config.timestampMs
    };
  });
}

export function useGates() {
  return useQuery({
    queryKey: ["gates"],
    queryFn: fetchGates,
    staleTime: 30_000
  });
}
