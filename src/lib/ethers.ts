import { type PublicClient, http, type WalletClient } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { BrowserProvider, FallbackProvider, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { useMemo } from "react";

export function publicClientToProvider(publicClient: PublicClient) {
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  if (transport.type === "fallback") {
    const providers = (transport.transports as ReturnType<typeof http>[]).map(
      ({ value }) => new JsonRpcProvider(value?.url, network),
    );
    if (providers.length === 1) return providers[0];
    return new FallbackProvider(providers);
  }
  return new BrowserProvider(transport, network);
}

/** Hook to convert a viem PublicClient to an ethers.js Provider. */
export function useEthersProvider({ chainId }: { chainId?: number } = {}) {
  const publicClient = usePublicClient({ chainId });
  return useMemo(() => publicClient ? publicClientToProvider(publicClient) : undefined, [publicClient]);
}

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);
  return signer;
}

/** Hook to convert a Viem WalletClient to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });
  return useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient],
  );
}
