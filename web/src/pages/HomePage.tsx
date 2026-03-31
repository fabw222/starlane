import { Navigate, useOutletContext } from "react-router-dom";
import { GateCard } from "@/components/GateCard";
import { StatCard } from "@/components/StatCard";
import type { EveContext } from "@/hooks/useEveContext";
import { useGates } from "@/hooks/useGates";
import { formatMistLabel } from "@/lib/format";

export function HomePage() {
  const eve = useOutletContext<EveContext>();
  const { data: gates, isLoading, error } = useGates();

  if (eve?.itemId) {
    return <Navigate to={`/gates/${eve.itemId}?itemId=${eve.itemId}${eve.tenant ? `&tenant=${eve.tenant}` : ""}`} replace />;
  }

  if (isLoading) {
    return <p className="text-sm text-steel">Loading gate registry from chain…</p>;
  }

  if (error) {
    return <p className="text-sm text-ember">Failed to load gates: {error.message}</p>;
  }

  const gateList = gates ?? [];
  const totals = gateList.reduce(
    (current, gate) => ({
      gates: current.gates + 1,
      totalFeeMist: current.totalFeeMist + BigInt(gate.totalFeeMist),
      totalTxCount: current.totalTxCount + gate.txCount
    }),
    { gates: 0, totalFeeMist: 0n, totalTxCount: 0 }
  );

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel rounded-[2rem] p-8">
          <p className="tech-label">Frontier Toll Registry</p>
          <h1 className="display-font mt-4 text-5xl uppercase tracking-[0.22em] text-white">
            Verified jump access, indexed from chain truth
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-steel">
            StarLane reads all gate data directly from Sui on-chain events. Operators set fees on
            chain, pilots pay on chain, and the app displays verified results in real time.
          </p>
        </div>

        <div className="grid gap-4">
          <StatCard label="Indexed gates" value={String(totals.gates)} />
          <StatCard label="Verified jumps" value={String(totals.totalTxCount)} />
          <StatCard label="Total indexed fees" value={formatMistLabel(totals.totalFeeMist)} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="tech-label">Registry Surface</p>
          <h2 className="display-font mt-3 text-3xl uppercase tracking-[0.16em] text-white">All tracked toll gates</h2>
        </div>
        {gateList.length === 0 ? (
          <div className="panel rounded-[1.8rem] p-6 text-sm text-steel">
            No gates have been registered yet. Visit the operator deck to register the first route.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {gateList.map((gate) => (
              <GateCard key={gate.onChainGateId} gate={gate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
