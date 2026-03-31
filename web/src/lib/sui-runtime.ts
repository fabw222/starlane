import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { SUI_NETWORK } from "./sui-config";

let suiClient: SuiJsonRpcClient | null = null;

export function getSuiClient() {
  if (!suiClient) {
    suiClient = new SuiJsonRpcClient({
      network: SUI_NETWORK,
      url: getJsonRpcFullnodeUrl(SUI_NETWORK)
    });
  }

  return suiClient;
}
