'use client';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { PrivyProvider } from '@privy-io/react-auth';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { coinbaseWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { base } from 'viem/chains';
import { WagmiProvider } from 'wagmi';
import { http, createConfig } from 'wagmi';
import { NEXT_PUBLIC_CDP_API_KEY, NEXT_PUBLIC_PRIVY_APP_ID } from '../config';
import { NEXT_PUBLIC_WC_PROJECT_ID } from '../config';

type Props = { children: ReactNode };

const queryClient = new QueryClient();

function ZeroDevProviders({ children }: Props) {
  if (!NEXT_PUBLIC_PRIVY_APP_ID) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is required');
  }

  if (!NEXT_PUBLIC_WC_PROJECT_ID) {
    throw new Error('NEXT_PUBLIC_WC_PROJECT_ID is required');
  }

  // Create wagmi config for Privy
  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended',
        wallets: [coinbaseWallet, injectedWallet],
      },
    ],
    {
      appName: 'Flip the Stock Market',
      projectId: NEXT_PUBLIC_WC_PROJECT_ID,
    },
  );

  const wagmiConfig = createConfig({
    chains: [base],
    connectors,
    transports: {
      [base.id]: http(),
    },
    ssr: true,
  });

  return (
    <PrivyProvider
      appId={NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        // Customize login methods
        loginMethods: ['email', 'sms', 'wallet', 'google', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#3B82F6',
        },
        // Configure embedded wallets
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        },
        // Default to Base chain
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <OnchainKitProvider apiKey={NEXT_PUBLIC_CDP_API_KEY} chain={base}>
            {children}
          </OnchainKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default ZeroDevProviders;
