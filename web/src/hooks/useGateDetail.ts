import { useGates } from "./useGates";
import { useJumpEvents } from "./useJumpEvents";
import type { GateDetail, GateTransactionRecord } from "@/lib/contracts";

export function useGateDetail(gateId: string | undefined) {
  const gatesQuery = useGates();
  const jumpEventsQuery = useJumpEvents(gateId);
  const gate = gatesQuery.data?.find((candidate) => candidate.onChainGateId === gateId) ?? null;

  const recentTransactions: GateTransactionRecord[] = (jumpEventsQuery.data ?? [])
    .slice()
    .reverse()
    .slice(0, 50)
    .map((event) => ({
      txDigest: event.txDigest,
      eventSeq: event.eventSeq,
      player: event.player,
      feeMist: event.feeMist,
      protocolFee: event.protocolFee,
      operatorRevenue: event.operatorRevenue,
      onChainTimestampMs: event.timestampMs
    }));

  return {
    data: gate ? ({ ...gate, recentTransactions } satisfies GateDetail) : null,
    isLoading: gatesQuery.isLoading || jumpEventsQuery.isLoading,
    error: gatesQuery.error ?? jumpEventsQuery.error ?? null
  };
}
