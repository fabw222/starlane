import type { DailyRevenueResponse } from "@/lib/contracts";

export function normalizeStatsDays(input?: string | null) {
  const parsed = Number(input ?? "30");

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
    return 30;
  }

  return parsed;
}

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function subtractDays(from: Date, days: number) {
  const value = new Date(from);
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

export function buildDailyRevenueSeries({
  startDate,
  days,
  rows
}: {
  startDate: string;
  days: number;
  rows: Array<{ date: string; totalFeeMist: bigint | number | string; txCount: bigint | number | string }>;
}): DailyRevenueResponse {
  const rowMap = new Map(rows.map((row) => [row.date, row]));
  const dailyRevenue: DailyRevenueResponse["dailyRevenue"] = [];
  let totalFeeMist = 0n;
  let totalTxCount = 0;

  for (let index = 0; index < days; index += 1) {
    const current = new Date(toUtcDate(startDate));
    current.setUTCDate(current.getUTCDate() + index);
    const date = formatDateKey(current);
    const row = rowMap.get(date);
    const feeMist = row ? BigInt(row.totalFeeMist) : 0n;
    const txCount = row ? Number(row.txCount) : 0;

    totalFeeMist += feeMist;
    totalTxCount += txCount;

    dailyRevenue.push({
      date,
      totalFeeMist: feeMist.toString(),
      txCount
    });
  }

  return {
    dailyRevenue,
    totalFeeMist: totalFeeMist.toString(),
    totalTxCount
  };
}
