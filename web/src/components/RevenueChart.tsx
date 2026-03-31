import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useJumpEvents } from "@/hooks/useJumpEvents";
import { buildDailyRevenueSeries, subtractDays } from "@/lib/timeline";
import { formatDay, formatMistLabel, mistToSuiString } from "@/lib/format";

export function RevenueChart({ gateId }: { gateId: string }) {
  const { data: jumpEvents, isLoading, error } = useJumpEvents(gateId);

  const chartData = useMemo(() => {
    if (!jumpEvents) return null;

    // Aggregate events by date
    const dateMap = new Map<string, { totalFeeMist: bigint; txCount: number }>();
    for (const event of jumpEvents) {
      const date = new Date(Number(event.timestampMs)).toISOString().slice(0, 10);
      const existing = dateMap.get(date) ?? { totalFeeMist: 0n, txCount: 0 };
      existing.totalFeeMist += BigInt(event.feeMist);
      existing.txCount += 1;
      dateMap.set(date, existing);
    }

    const rows = Array.from(dateMap.entries()).map(([date, stats]) => ({
      date,
      totalFeeMist: stats.totalFeeMist,
      txCount: stats.txCount
    }));

    const startDate = subtractDays(new Date(), 29).toISOString().slice(0, 10);
    return buildDailyRevenueSeries({ startDate, days: 30, rows });
  }, [jumpEvents]);

  if (error) {
    return <p className="mt-4 text-sm text-ember">{error.message}</p>;
  }

  if (isLoading || !chartData) {
    return <p className="mt-4 text-sm text-steel">Loading 30-day revenue telemetry…</p>;
  }

  return (
    <section className="panel rounded-[1.8rem] p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="tech-label">Revenue Waveform</p>
          <h2 className="display-font mt-3 text-2xl uppercase tracking-[0.16em] text-white">
            30-day verified intake
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-steel">Total fee volume</p>
          <p className="display-font text-2xl text-cyan">{mistToSuiString(chartData.totalFeeMist)} SUI</p>
        </div>
      </div>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData.dailyRevenue}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fill: "#89a7b7", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => mistToSuiString(value)}
              tick={{ fill: "#89a7b7", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "1rem",
                border: "1px solid rgba(106, 247, 242, 0.25)",
                background: "rgba(4, 16, 25, 0.96)"
              }}
              formatter={(value: string) => formatMistLabel(value)}
              labelFormatter={(value) => formatDay(String(value))}
            />
            <Line
              type="monotone"
              dataKey="totalFeeMist"
              stroke="#6af7f2"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, stroke: "#041019", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
