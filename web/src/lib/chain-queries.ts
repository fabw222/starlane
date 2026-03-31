import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { queryAllEventsWithCache, type EventQueryRecord } from "./event-cache";
import { STARLANE_PACKAGE_ID, SUI_NETWORK } from "./sui-config";

interface RawTollConfiguredEvent {
  gate_id: string;
  operator: string;
  fee_mist: string;
}

interface RawTollPaidEvent {
  gate_id: string;
  player: string;
  fee_mist: string;
  protocol_fee: string;
  operator_revenue: string;
}

interface RawTollFeeUpdatedEvent {
  gate_id: string;
  old_fee_mist: string;
  new_fee_mist: string;
  operator: string;
}

export interface GateConfiguredRecord {
  gateId: string;
  operator: string;
  feeMist: string;
  txDigest: string;
  timestampMs: string;
}

export interface JumpEventRecord {
  gateId: string;
  player: string;
  feeMist: string;
  protocolFee: string;
  operatorRevenue: string;
  txDigest: string;
  eventSeq: number;
  timestampMs: string;
}

export interface FeeUpdateRecord {
  gateId: string;
  oldFeeMist: string;
  newFeeMist: string;
  operator: string;
  timestampMs: string;
}

const inFlightEventQueries = new Map<string, Promise<EventQueryRecord<unknown>[]>>();

async function queryAllEvents<T>(
  client: SuiJsonRpcClient,
  eventType: string
): Promise<EventQueryRecord<T>[]> {
  const cacheKey = `starlane:${SUI_NETWORK}:${eventType}`;
  const existing = inFlightEventQueries.get(cacheKey);
  if (existing) {
    return existing as Promise<EventQueryRecord<T>[]>;
  }

  const promise = queryAllEventsWithCache<T>({
    client,
    eventType,
    cacheKey
  }).finally(() => {
    inFlightEventQueries.delete(cacheKey);
  });

  inFlightEventQueries.set(cacheKey, promise as Promise<EventQueryRecord<unknown>[]>);
  return promise;
}

export async function queryAllGateConfiguredEvents(
  client: SuiJsonRpcClient
): Promise<GateConfiguredRecord[]> {
  const events = await queryAllEvents<RawTollConfiguredEvent>(
    client,
    `${STARLANE_PACKAGE_ID}::toll_gate::TollConfiguredEvent`
  );

  return events.map((e) => ({
    gateId: e.parsed.gate_id,
    operator: e.parsed.operator,
    feeMist: e.parsed.fee_mist,
    txDigest: e.txDigest,
    timestampMs: e.timestampMs
  }));
}

export async function queryAllJumpEvents(
  client: SuiJsonRpcClient
): Promise<JumpEventRecord[]> {
  const events = await queryAllEvents<RawTollPaidEvent>(
    client,
    `${STARLANE_PACKAGE_ID}::toll_gate::TollPaidEvent`
  );

  return events.map((e) => ({
    gateId: e.parsed.gate_id,
    player: e.parsed.player,
    feeMist: e.parsed.fee_mist,
    protocolFee: e.parsed.protocol_fee,
    operatorRevenue: e.parsed.operator_revenue,
    txDigest: e.txDigest,
    eventSeq: e.eventSeq,
    timestampMs: e.timestampMs
  }));
}

export async function queryAllFeeUpdateEvents(
  client: SuiJsonRpcClient
): Promise<FeeUpdateRecord[]> {
  const events = await queryAllEvents<RawTollFeeUpdatedEvent>(
    client,
    `${STARLANE_PACKAGE_ID}::toll_gate::TollFeeUpdatedEvent`
  );

  return events.map((e) => ({
    gateId: e.parsed.gate_id,
    oldFeeMist: e.parsed.old_fee_mist,
    newFeeMist: e.parsed.new_fee_mist,
    operator: e.parsed.operator,
    timestampMs: e.timestampMs
  }));
}
