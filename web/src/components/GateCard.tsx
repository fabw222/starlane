import { Link } from "react-router-dom";
import type { GateSummary } from "@/lib/contracts";
import { formatDateTime, formatMistLabel, shortAddress } from "@/lib/format";

export function GateCard({ gate }: { gate: GateSummary }) {
  return (
    <Link
      to={`/gates/${gate.onChainGateId}`}
      className="panel group block rounded-[1.8rem] p-6 transition hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="tech-label">Gate Registry Entry</p>
          <h3 className="display-font mt-3 text-2xl uppercase tracking-[0.18em] text-white">
            {shortAddress(gate.onChainGateId)}
          </h3>
          <p className="mt-2 text-sm text-steel">Operator {shortAddress(gate.operator)}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-steel">Current Fee</dt>
          <dd className="mt-2 text-lg text-white">{formatMistLabel(gate.feeMist)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-steel">Jump Count</dt>
          <dd className="mt-2 text-lg text-white">{gate.txCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-steel">Last Activity</dt>
          <dd className="mt-2 text-lg text-white">
            {gate.lastJumpAt ? formatDateTime(BigInt(gate.lastJumpAt)) : "No jumps yet"}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
