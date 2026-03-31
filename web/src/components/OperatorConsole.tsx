import { dAppKit, useConnection } from "@evefrontier/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { useMemo, useState } from "react";
import type { GateSummary } from "@/lib/contracts";
import { useWalletObjects } from "@/hooks/useWalletObjects";
import {
  buildRegisterGateTransaction,
  getSuccessfulTransactionDigest,
  buildUpdateFeeTransaction,
  buildWithdrawRevenueTransaction,
  fetchObjectRef,
} from "@/lib/sui-transactions";
import { formatMistLabel, mistToSuiString, shortAddress, suiToMistString } from "@/lib/format";
import { ShellSelect } from "@/components/ShellSelect";

function sameSuiAddress(left: string, right: string) {
  return normalizeSuiObjectId(left) === normalizeSuiObjectId(right);
}

export function OperatorConsole({ gates }: { gates: GateSummary[] }) {
  const { isConnected, walletAddress, handleConnect, handleDisconnect } = useConnection();
  const queryClient = useQueryClient();
  const { data: walletObjects } = useWalletObjects();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGateIndex, setSelectedGateIndex] = useState(0);
  const [registerFeeSui, setRegisterFeeSui] = useState("0.1");
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Only show Gate-type assemblies, not SSU/Turret/etc
  const unregisteredGates = useMemo(() => {
    if (!walletObjects?.ownedGates.length) return [];
    const registeredGateIds = new Set(gates.map((g) => g.onChainGateId));
    return walletObjects.ownedGates.filter(
      (g) => !registeredGateIds.has(g.gateId) && g.typeRepr.toLowerCase().includes("gate")
    );
  }, [walletObjects, gates]);

  const myGates = useMemo(() => {
    if (!walletAddress) return [];
    return gates.filter((gate) => sameSuiAddress(gate.operator, walletAddress));
  }, [walletAddress, gates]);

  function resolveOperatorCap(gateId: string): string | null {
    return walletObjects?.operatorCapByGate[gateId] ?? null;
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletAddress) { setError("Connect a wallet first."); return; }
    const gate = unregisteredGates[selectedGateIndex];
    if (!gate) { setError("No gate selected."); return; }
    if (!walletObjects?.characterId) { setError("No character detected."); return; }

    try {
      setError(null); setBusy(true);

      // Diagnostic: log key info
      console.log("[StarLane] register_gate diagnostics:", {
        walletAddress,
        characterId: walletObjects.characterId,
        gateId: gate.gateId,
        ownerCapAddress: gate.ownerCapAddress,
        assemblyType: gate.typeRepr,
        ownerCapType: gate.ownerCapType,
      });

      setStatus("Fetching OwnerCap reference…");
      const ownerCapRef = await fetchObjectRef(gate.ownerCapAddress);
      console.log("[StarLane] ownerCapRef:", ownerCapRef);

      setStatus("Submitting register_gate…");
      const transaction = buildRegisterGateTransaction({
        gateObjectId: gate.gateId,
        characterId: walletObjects.characterId,
        ownerCapRef,
        feeMist: BigInt(suiToMistString(registerFeeSui)),
        recipient: walletAddress
      });
      // Explicitly set sender to connected wallet
      transaction.setSenderIfNotSet(walletAddress);

      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      const digest = getSuccessfulTransactionDigest(result);
      setStatus(`Gate registered. Tx ${shortAddress(digest)}. Refreshing…`);
      setSelectedGateIndex(0);
      // Wait for queries to refresh before allowing next registration
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gates"] }),
        queryClient.invalidateQueries({ queryKey: ["walletObjects"] }),
      ]);
    } catch (cause) {
      console.error("[StarLane] register_gate error:", cause);
      const msg = cause instanceof Error ? cause.message : String(cause);
      setError(msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
    } finally { setBusy(false); }
  }

  async function handleFeeUpdate(gate: GateSummary) {
    if (!walletAddress) { setError("Connect a wallet first."); return; }
    const operatorCapId = resolveOperatorCap(gate.onChainGateId);
    if (!operatorCapId) { setError(`No OperatorCap for gate ${shortAddress(gate.onChainGateId)}.`); return; }
    const suiValue = feeDrafts[gate.onChainGateId] ?? mistToSuiString(gate.feeMist);

    try {
      setError(null); setBusy(true);
      setStatus(`Updating fee for ${shortAddress(gate.onChainGateId)}…`);
      const transaction = buildUpdateFeeTransaction({
        operatorCapId,
        newFeeMist: BigInt(suiToMistString(suiValue))
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      const digest = getSuccessfulTransactionDigest(result);
      setStatus(`Fee updated. Tx ${shortAddress(digest)}`);
      void queryClient.invalidateQueries({ queryKey: ["gates"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update fee");
    } finally { setBusy(false); }
  }

  async function handleWithdraw(gate: GateSummary) {
    if (!walletAddress) { setError("Connect a wallet first."); return; }
    const operatorCapId = resolveOperatorCap(gate.onChainGateId);
    if (!operatorCapId) { setError(`No OperatorCap for gate ${shortAddress(gate.onChainGateId)}.`); return; }

    try {
      setError(null); setBusy(true);
      setStatus(`Withdrawing revenue for ${shortAddress(gate.onChainGateId)}…`);
      const transaction = buildWithdrawRevenueTransaction({
        operatorCapId,
        recipient: walletAddress
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      const digest = getSuccessfulTransactionDigest(result);
      setStatus(`Withdrawal submitted. Tx ${shortAddress(digest)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to withdraw revenue");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel rounded-[2rem] p-7">
          <p className="tech-label">Operator Control Plane</p>
          <h1 className="display-font mt-3 text-4xl uppercase tracking-[0.18em] text-white">
            Register and manage toll gates
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
            Connect your wallet to auto-detect gates. Select an unregistered gate, set the toll fee, and register with one click.
          </p>

          <form onSubmit={handleRegister} className="mt-8 grid gap-4">
            {unregisteredGates.length > 0 ? (
              <>
                <label className="grid gap-1">
                  <span className="tech-label">Gate</span>
                  <ShellSelect
                    options={unregisteredGates.map((gate, i) => ({
                      value: String(i),
                      label: shortAddress(gate.gateId)
                    }))}
                    value={String(selectedGateIndex)}
                    onChange={(v) => setSelectedGateIndex(Number(v))}
                    placeholder="Select gate…"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <label className="grid gap-1">
                    <span className="tech-label">Toll fee (SUI)</span>
                    <input
                      className="input-shell"
                      placeholder="0.1"
                      value={registerFeeSui}
                      onChange={(event) => setRegisterFeeSui(event.target.value)}
                    />
                  </label>
                  <button className="action-button self-end" disabled={busy} type="submit">
                    {busy ? "Processing…" : "Register gate"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-steel">
                {walletAddress
                  ? "No unregistered gates detected. All owned gates are already registered, or connect the wallet that owns gates."
                  : "Connect a wallet to detect your gates."}
              </p>
            )}
          </form>
        </div>

        <aside className="panel rounded-[2rem] p-7">
          <p className="tech-label">Execution Status</p>
          <div className="mt-4 space-y-3 text-sm leading-7">
            <p className="text-steel">
              Connected operator: <span className="text-white">{walletAddress ? shortAddress(walletAddress) : "none"}</span>
            </p>
            {isConnected && walletAddress ? (
              <button className="ghost-button" onClick={handleDisconnect} type="button">
                Disconnect capsule
              </button>
            ) : (
              <button className="action-button" onClick={handleConnect} type="button">
                Connect capsule
              </button>
            )}
            {walletObjects && walletAddress && (
              <div className="space-y-1 text-steel">
                <p>Character: <span className="text-white">{walletObjects.characterName || (walletObjects.characterId ? shortAddress(walletObjects.characterId) : "none")}</span></p>
                <p>Managed gates: <span className="text-white">{walletObjects.operatorCaps.length || "none"}</span></p>
              </div>
            )}
            {status ? <p className="rounded-2xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-cyan">{status}</p> : null}
            {error ? <p className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-ember break-all">{error}</p> : null}
            {walletObjects && walletAddress && unregisteredGates.length > 0 && (
              <details className="mt-2 text-xs text-steel/60">
                <summary className="cursor-pointer">Diagnostics</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black/30 p-3 text-[10px] leading-relaxed">
{JSON.stringify({
  wallet: walletAddress,
  character: walletObjects.characterId,
  gate: unregisteredGates[selectedGateIndex]?.gateId,
  ownerCap: unregisteredGates[selectedGateIndex]?.ownerCapAddress,
  ownerCapType: unregisteredGates[selectedGateIndex]?.ownerCapType,
  assemblyType: unregisteredGates[selectedGateIndex]?.typeRepr,
}, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </aside>
      </section>

      <section className="space-y-4">
        <div>
          <p className="tech-label">My Gates</p>
          <h2 className="display-font mt-3 text-3xl uppercase tracking-[0.16em] text-white">Verified operator inventory</h2>
        </div>

        {myGates.length === 0 ? (
          <div className="panel rounded-[1.8rem] p-6 text-sm text-steel">
            {walletAddress
              ? "No gates are indexed for the connected operator yet. Register one above."
              : "Connect an operator wallet to see the gates you control."}
          </div>
        ) : (
          <div className="grid gap-5">
            {myGates.map((gate) => (
              <article key={gate.onChainGateId} className="panel rounded-[1.8rem] p-6">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div>
                    <p className="tech-label">Gate Object</p>
                    <h3 className="display-font mt-3 text-2xl uppercase tracking-[0.14em] text-white">
                      {shortAddress(gate.onChainGateId)}
                    </h3>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-steel">
                      <div><dt className="inline text-steel/60">Current fee:</dt> <dd className="inline text-white">{formatMistLabel(gate.feeMist)}</dd></div>
                      <div><dt className="inline text-steel/60">Jumps:</dt> <dd className="inline text-white">{gate.txCount}</dd></div>
                      <div><dt className="inline text-steel/60">Revenue:</dt> <dd className="inline text-white">{formatMistLabel(gate.totalOperatorRevenue)}</dd></div>
                    </dl>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <label className="grid gap-1">
                      <span className="tech-label">New fee (SUI)</span>
                      <input
                        className="input-shell"
                        placeholder={mistToSuiString(gate.feeMist)}
                        value={feeDrafts[gate.onChainGateId] ?? mistToSuiString(gate.feeMist)}
                        onChange={(event) =>
                          setFeeDrafts((current) => ({ ...current, [gate.onChainGateId]: event.target.value }))
                        }
                      />
                    </label>
                    <button
                      className="action-button self-end"
                      disabled={busy || !resolveOperatorCap(gate.onChainGateId)}
                      onClick={() => handleFeeUpdate(gate)}
                    >
                      Update fee
                    </button>
                    <button
                      className="ghost-button self-end"
                      disabled={busy || !resolveOperatorCap(gate.onChainGateId)}
                      onClick={() => handleWithdraw(gate)}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
                {!resolveOperatorCap(gate.onChainGateId) && (
                  <p className="mt-3 text-xs text-ember/70">OperatorCap not detected — connect the wallet that registered this gate.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
