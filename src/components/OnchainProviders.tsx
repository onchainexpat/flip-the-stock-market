'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { NEXT_PUBLIC_PRIVY_APP_ID } from '../config';
import { useWagmiConfig } from '../wagmi';

type Props = { children: ReactNode };

const queryClient = new QueryClient();

function OnchainProviders({ children }: Props) {
  const wagmiConfig = useWagmiConfig();

  return (
    <PrivyProvider
      appId={NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#ff8c00',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: {
          id: 8453, // Base
          name: 'Base',
          network: 'base',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: ['https://mainnet.base.org'],
            },
            public: {
              http: ['https://mainnet.base.org'],
            },
          },
          blockExplorers: {
            default: {
              name: 'BaseScan',
              url: 'https://basescan.org',
            },
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default OnchainProviders;