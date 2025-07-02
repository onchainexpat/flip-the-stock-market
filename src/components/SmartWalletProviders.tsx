'use client';
import type { ReactNode } from 'react';

type Props = { children: ReactNode };

function SmartWalletProviders({ children }: Props) {
  // Smart wallet functionality is now handled directly by wagmi + Coinbase Wallet SDK
  // with smartWalletOnly preference configured in src/wagmi.ts
  return <>{children}</>;
}

export default SmartWalletProviders;
