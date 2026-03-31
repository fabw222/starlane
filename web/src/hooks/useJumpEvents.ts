import { useQuery } from "@tanstack/react-query";
import { queryAllJumpEvents } from "@/lib/chain-queries";
import type { JumpEventRecord } from "@/lib/chain-queries";

export function useJumpEvents(gateId: string | undefined) {
  return useQuery({
    queryKey: ["jumpEvents"],
    queryFn: async (): Promise<JumpEventRecord[]> => {
      const { getSuiClient } = await import("@/lib/sui-runtime");
      const client = getSuiClient();
      return queryAllJumpEvents(client);
    },
    select: (allEvents) => {
      if (!gateId) {
        return [];
      }

      return allEvents.filter((event) => event.gateId === gateId);
    },
    enabled: !!gateId,
    staleTime: 30_000
  });
}
