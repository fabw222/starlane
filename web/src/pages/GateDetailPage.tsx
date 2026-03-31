import { Suspense, lazy } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { TransactionTable } from "@/components/TransactionTable";
import type { EveContext } from "@/hooks/useEveContext";
import { useGateDetail } from "@/hooks/useGateDetail";
import { formatMistLabel, shortAddress } from "@/lib/format";

const RevenueChart = lazy(async () => {
  const module = await import("@/components/RevenueChart");
  return { default: module.RevenueChart };
});

export function GateDetailPage() {
  const eve = useOutletContext<EveContext>();
  const { gateId } = useParams<{ gateId: string }>();
  const { data: gate, isLoading, error } = useGateDetail(gateId);

  if (isLoading) {
    return <p className="text-sm text-steel">Loading gate telemetry…</p>;
  }

  if (error) {
    return <p className="text-sm text-ember">Failed to load gate: {error.message}</p>;
  }

  if (!gate) {
    return <p className="text-sm text-steel">Gate not found.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="panel rounded-[2rem] p-8">
        <p className="tech-label">Gate Telemetry</p>
        <h1 className="display-font mt-4 text-4xl uppercase tracking-[0.18em] text-white">
          {eve?.assembly?.name || shortAddress(gate.onChainGateId)}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-steel">
          Operator {shortAddress(gate.operator)} · registration tx {shortAddress(gate.txDigest)}
        </p>
        {eve?.assembly && (
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full border border-cyan/20 bg-cyan/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan">
              {eve.assembly.state}
            </span>
            {eve.assembly.solarSystem && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-steel">
                {eve.assembly.solarSystem.name}
              </span>
            )}
            {"gate" in eve.assembly && eve.assembly.gate?.destinationId && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-steel">
                Dest: {eve.assembly.gate.destinationId.slice(0, 10)}…
              </span>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Current fee" value={formatMistLabel(gate.feeMist)} />
        <StatCard label="Jump count" value={String(gate.txCount)} />
        <StatCard label="Operator revenue" value={formatMistLabel(gate.totalOperatorRevenue)} />
      </section>

      {eve?.isInGame && (
        <Link
          to={`/jump?itemId=${eve.itemId}${eve.tenant ? `&tenant=${eve.tenant}` : ""}`}
          className="action-button inline-flex px-8 py-3 text-center"
        >
          Buy jump permit from this gate
        </Link>
      )}

      <Suspense fallback={<p className="text-sm text-steel">Loading 30-day revenue telemetry…</p>}>
        <RevenueChart gateId={gate.onChainGateId} />
      </Suspense>
      <TransactionTable transactions={gate.recentTransactions} />
    </div>
  );
}
