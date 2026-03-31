import { describe, expect, it } from "vitest";
import { buildDailyRevenueSeries, normalizeStatsDays } from "./timeline";

describe("normalizeStatsDays", () => {
  it("falls back to 30 days for invalid values", () => {
    expect(normalizeStatsDays(undefined)).toBe(30);
    expect(normalizeStatsDays("abc")).toBe(30);
    expect(normalizeStatsDays("0")).toBe(30);
    expect(normalizeStatsDays("91")).toBe(30);
  });

  it("accepts values between 1 and 90", () => {
    expect(normalizeStatsDays("1")).toBe(1);
    expect(normalizeStatsDays("45")).toBe(45);
    expect(normalizeStatsDays("90")).toBe(90);
  });
});

describe("buildDailyRevenueSeries", () => {
  it("fills missing days with zeroes and preserves totals", () => {
    const series = buildDailyRevenueSeries({
      startDate: "2026-03-10",
      days: 4,
      rows: [
        { date: "2026-03-10", totalFeeMist: 120n, txCount: 2n },
        { date: "2026-03-12", totalFeeMist: 300n, txCount: 1n }
      ]
    });

    expect(series.dailyRevenue).toEqual([
      { date: "2026-03-10", totalFeeMist: "120", txCount: 2 },
      { date: "2026-03-11", totalFeeMist: "0", txCount: 0 },
      { date: "2026-03-12", totalFeeMist: "300", txCount: 1 },
      { date: "2026-03-13", totalFeeMist: "0", txCount: 0 }
    ]);
    expect(series.totalFeeMist).toBe("420");
    expect(series.totalTxCount).toBe(3);
  });
});
