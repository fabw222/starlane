import { OperatorConsole } from "@/components/OperatorConsole";
import { useGates } from "@/hooks/useGates";

export function OperatorPage() {
  const { data: gates, isLoading, error } = useGates();

  if (isLoading) {
    return <p className="text-sm text-steel">Loading operator inventory…</p>;
  }

  if (error) {
    return <p className="text-sm text-ember">Failed to load gates: {error.message}</p>;
  }

  return <OperatorConsole gates={gates ?? []} />;
}
