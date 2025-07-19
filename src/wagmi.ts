'use client';
import { useMemo } from 'react';
import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

export function useWagmiConfig() {
  return useMemo(() => {
    const wagmiConfig = createConfig({
      chains: [base, baseSepolia],
      multiInjectedProviderDiscovery: false,
      connectors: [], // Privy will handle wallet connections
      ssr: true,
      transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
      },
    });

    return wagmiConfig;
  }, []);
}