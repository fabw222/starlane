import { dAppKit, useConnection } from "@evefrontier/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { GateSummary } from "@/lib/contracts";
import { useWalletObjects } from "@/hooks/useWalletObjects";
import {
  buildBuyJumpPermitTransaction,
  getSuccessfulTransactionDigest,
  normalizeRequiredSuiObjectId
} from "@/lib/sui-transactions";
import { formatMistLabel, shortAddress } from "@/lib/format";
import { ShellSelect } from "@/components/ShellSelect";

export function JumpConsole({
  gates,
  initialSourceGateId = ""
}: {
  gates: GateSummary[];
  initialSourceGateId?: string;
}) {
  const { isConnected, walletAddress, handleConnect, handleDisconnect } = useConnection();
  const queryClient = useQueryClient();
  const { data: walletObjects } = useWalletObjects();
  const [sourceGateId, setSourceGateId] = useState(initialSourceGateId);
  const [destinationGateId, setDestinationGateId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (walletObjects?.characterId && !characterId) {
      setCharacterId(walletObjects.characterId);
    }
  }, [walletObjects, characterId]);

  // Auto-select first gate if none selected
  useEffect(() => {
    if (!destinationGateId && gates.length > 0) {
      setDestinationGateId(gates[0].onChainGateId);
    }
  }, [destinationGateId, gates]);

  const destinationGate = useMemo(
    () => gates.find((gate) => gate.onChainGateId === destinationGateId) ?? null,
    [gates, destinationGateId]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!walletAddress) { setError("Connect a pilot wallet first."); return; }
    if (!destinationGate) { setError("Select a destination gate."); return; }

    try {
      const normalizedSourceGateId = normalizeRequiredSuiObjectId(sourceGateId, "Source gate");
      const normalizedCharacterId = normalizeRequiredSuiObjectId(characterId, "Character");
      setBusy(true);
      setStatus("Submitting buy_jump_permit…");
      const transaction = buildBuyJumpPermitTransaction({
        sourceGateId: normalizedSourceGateId,
        destinationGateId,
        characterId: normalizedCharacterId,
        feeMist: BigInt(destinationGate.feeMist),
        recipient: walletAddress
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      const digest = getSuccessfulTransactionDigest(result);
      setStatus(`Jump permit purchased. Tx ${shortAddress(digest)}`);
      void queryClient.invalidateQueries({ queryKey: ["gates"] });
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Failed to purchase jump permit");
    } finally { setBusy(false); }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <form onSubmit={handleSubmit} className="panel rounded-[2rem] p-7">
        <p className="tech-label">Pilot Jump Console</p>
        <h1 className="display-font mt-3 text-4xl uppercase tracking-[0.18em] text-white">Acquire a verified permit</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
          Choose source and destination gates, pay the toll fee, and receive a jump permit on chain.
        </p>

        <div className="mt-8 grid gap-4">
          <label className="grid gap-1">
            <span className="tech-label">Source gate</span>
            {gates.length > 0 ? (
              <ShellSelect
                options={gates.map((gate) => ({
                  value: gate.onChainGateId,
                  label: `${shortAddress(gate.onChainGateId)} · ${formatMistLabel(gate.feeMist)}`
                }))}
                value={sourceGateId}
                onChange={setSourceGateId}
                placeholder="Select source gate…"
              />
            ) : (
              <input
                className="input-shell"
                placeholder="Source gate object ID"
                value={sourceGateId}
                onChange={(e) => setSourceGateId(e.target.value)}
              />
            )}
          </label>

          <label className="grid gap-1">
            <span className="tech-label">Destination gate</span>
            <ShellSelect
              options={gates.map((gate) => ({
                value: gate.onChainGateId,
                label: `${shortAddress(gate.onChainGateId)} · ${formatMistLabel(gate.feeMist)}`
              }))}
              value={destinationGateId}
              onChange={setDestinationGateId}
              placeholder={gates.length === 0 ? "No registered gates" : "Select destination gate…"}
            />
          </label>

          <label className="grid gap-1">
            <span className="tech-label">Character</span>
            {walletObjects?.characterId ? (
              <div className="input-shell flex items-center text-white">
                {walletObjects.characterName || shortAddress(walletObjects.characterId)}
              </div>
            ) : (
              <input
                className="input-shell"
                placeholder="Character object ID"
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
              />
            )}
          </label>

          <button className="action-button w-full" disabled={busy} type="submit">
            {busy ? "Processing…" : "Buy jump permit"}
          </button>
        </div>
      </form>

      <aside className="panel rounded-[2rem] p-7">
        <p className="tech-label">Mission Intel</p>
        <div className="mt-4 space-y-3 text-sm leading-7 text-steel">
          <p>
            Connected pilot: <span className="text-white">{walletAddress ? shortAddress(walletAddress) : "none"}</span>
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
          {destinationGate && (
            <dl className="space-y-1">
              <div><dt className="inline text-steel/60">Destination fee:</dt> <dd className="inline text-white">{formatMistLabel(destinationGate.feeMist)}</dd></div>
              <div><dt className="inline text-steel/60">Jumps on this gate:</dt> <dd className="inline text-white">{destinationGate.txCount}</dd></div>
              <div><dt className="inline text-steel/60">Operator:</dt> <dd className="inline text-white">{shortAddress(destinationGate.operator)}</dd></div>
            </dl>
          )}
          {status ? <p className="rounded-2xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-cyan">{status}</p> : null}
          {error ? <p className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-ember">{error}</p> : null}
        </div>
      </aside>
    </section>
  );
}
