import { useOutletContext } from "react-router-dom";
import { JumpConsole } from "@/components/JumpConsole";
import type { EveContext } from "@/hooks/useEveContext";
import { useGates } from "@/hooks/useGates";

export function JumpPage() {
  const eve = useOutletContext<EveContext>();
  const { data: gates, isLoading, error } = useGates();

  if (isLoading) {
    return <p className="text-sm text-steel">Loading available gates…</p>;
  }

  if (error) {
    return <p className="text-sm text-ember">Failed to load gates: {error.message}</p>;
  }

  return <JumpConsole gates={gates ?? []} initialSourceGateId={eve?.itemId ?? ""} />;
}
