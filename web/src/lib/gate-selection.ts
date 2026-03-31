import type { GateSummary } from "./contracts";

export function resolveSelectedGateId(selectedGateId: string, gates: GateSummary[]) {
  if (gates.length === 0) {
    return "";
  }

  if (selectedGateId && gates.some((gate) => gate.onChainGateId === selectedGateId)) {
    return selectedGateId;
  }

  return gates[0].onChainGateId;
}
