import type { GateTransactionRecord } from "@/lib/contracts";
import { formatDateTime, formatMistLabel, shortAddress } from "@/lib/format";

export function TransactionTable({
  title,
  transactions
}: {
  title?: string;
  transactions: GateTransactionRecord[];
}) {
  return (
    <section className="panel rounded-[1.8rem] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="tech-label">Recent Traffic</p>
          <h2 className="display-font mt-3 text-2xl uppercase tracking-[0.16em] text-white">
            {title ?? "Latest Jump Events"}
          </h2>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="mt-6 text-sm text-steel">No verified jump transactions yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead>
              <tr className="text-steel">
                <th className="pb-2 font-medium">Player</th>
                <th className="pb-2 font-medium">Fee</th>
                <th className="pb-2 font-medium">Protocol</th>
                <th className="pb-2 font-medium">Operator</th>
                <th className="pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={`${transaction.txDigest}-${transaction.eventSeq}`} className="panel-soft">
                  <td className="rounded-l-2xl px-4 py-3 text-white">{shortAddress(transaction.player)}</td>
                  <td className="px-4 py-3 text-white">{formatMistLabel(transaction.feeMist)}</td>
                  <td className="px-4 py-3 text-steel">{formatMistLabel(transaction.protocolFee)}</td>
                  <td className="px-4 py-3 text-steel">{formatMistLabel(transaction.operatorRevenue)}</td>
                  <td className="rounded-r-2xl px-4 py-3 text-steel">
                    {formatDateTime(BigInt(transaction.onChainTimestampMs))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
