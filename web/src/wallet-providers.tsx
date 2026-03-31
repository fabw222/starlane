import type { ReactNode } from "react";
import { useEffect } from "react";
import { EveFrontierProvider, dAppKit } from "@evefrontier/dapp-kit";
import { SUI_NETWORK } from "@/lib/sui-config";
import { appQueryClient } from "@/providers";

function WalletNetworkSync() {
  useEffect(() => {
    dAppKit.switchNetwork(SUI_NETWORK);
  }, []);

  return null;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <EveFrontierProvider queryClient={appQueryClient}>
      <WalletNetworkSync />
      {children}
    </EveFrontierProvider>
  );
}
