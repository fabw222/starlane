export interface GateSummary {
  onChainGateId: string;
  operator: string;
  feeMist: string;
  txDigest: string;
  txCount: number;
  totalFeeMist: string;
  totalOperatorRevenue: string;
  lastJumpAt: string | null;
  registeredAt: string;
}

export interface GateTransactionRecord {
  txDigest: string;
  eventSeq: number;
  player: string;
  feeMist: string;
  protocolFee: string;
  operatorRevenue: string;
  onChainTimestampMs: string;
}

export interface GateDetail extends GateSummary {
  recentTransactions: GateTransactionRecord[];
}

export interface DailyRevenuePoint {
  date: string;
  totalFeeMist: string;
  txCount: number;
}

export interface DailyRevenueResponse {
  dailyRevenue: DailyRevenuePoint[];
  totalFeeMist: string;
  totalTxCount: number;
}
