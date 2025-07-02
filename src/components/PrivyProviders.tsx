'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { base, baseSepolia } from 'viem/chains';
import {
  NEXT_PUBLIC_BASE_BUNDLER_URL,
  NEXT_PUBLIC_BASE_PAYMASTER_URL,
  NEXT_PUBLIC_PRIVY_APP_ID,
} from '../config';

type Props = {
  children: ReactNode;
};

export default function PrivyProviders({ children }: Props) {
  const appId = NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
    // Return children unwrapped in development if no app ID
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Simple appearance configuration
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          showWalletLoginFirst: false,
        },

        // Basic login methods
        loginMethods: ['email', 'wallet'],

        // Configure embedded wallets to prefer Base network
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          // Force creation on Base network
          pregen: false,
          noPromptOnSignature: false, // Allow prompts for proper signing
        },

        // Simple external wallet config
        externalWallets: {
          coinbaseWallet: {
            connectionOptions: 'all',
          },
        },

        // Chain configuration - ensure Base is default
        defaultChain: base,
        supportedChains: [base, baseSepolia],

        // Enable smart wallets with ZeroDev paymaster for Base network
        smartWallets: {
          enabled: true,
          // Use ZeroDev bundler and paymaster endpoints
          bundlerUrl: NEXT_PUBLIC_BASE_BUNDLER_URL,
          paymasterUrl: NEXT_PUBLIC_BASE_PAYMASTER_URL,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
