# Privy + 7702 ZeroDev Integration Examples

## Overview
This guide provides practical examples for integrating Privy with 7702 ZeroDev to enable gasless transactions, transaction batching, and advanced account abstraction features.

## Installation

```bash
npm i @turnkey/sdk-react @turnkey/viem wagmi @zerodev/ecdsa-validator @zerodev/sdk @tanstack/react-query
```

## Basic Setup

### 1. Provider Configuration

```typescript
// providers/PrivyZeroDevProvider.tsx
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../config/wagmi';

const queryClient = new QueryClient();

export function PrivyZeroDevProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: true,
        },
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

### 2. Kernel Account Creation Hook

```typescript
// hooks/useKernelAccount.ts
import { useTurnkey } from '@turnkey/sdk-react';
import { createKernelAccount } from '@zerodev/sdk';
import { createAccount } from '@turnkey/viem';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useCallback } from 'react';

export function useKernelAccount() {
  const { turnkey, authIframeClient, getActiveClient } = useTurnkey();
  const { user } = usePrivy();
  const [kernelAccount, setKernelAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const createKernel = useCallback(async () => {
    if (!turnkey || !user) return;

    setIsLoading(true);
    try {
      // Get Turnkey session and active client
      const session = await turnkey.getSession();
      const turnkeyActiveClient = await getActiveClient();
      
      // Get the embedded wallet from Privy
      const embeddedWallet = user.linkedAccounts.find(
        account => account.type === 'wallet' && account.walletClientType === 'privy'
      );
      
      if (!embeddedWallet) throw new Error('No embedded wallet found');

      // Create Viem account from Turnkey
      const viemAccount = await createAccount({
        client: turnkeyActiveClient,
        organizationId: session.organizationId,
        signWith: embeddedWallet.address,
        ethereumAddress: embeddedWallet.address,
      });

      // Create EIP-7702 authorization
      const authorization = await viemAccount.signAuthorization({
        contractAddress: process.env.NEXT_PUBLIC_KERNEL_IMPLEMENTATION_ADDRESS!,
        chainId: 11155111, // Sepolia
        nonce: await publicClient.getTransactionCount({
          address: embeddedWallet.address,
        }),
      });

      // Create kernel account
      const kernel = await createKernelAccount(publicClient, {
        eip7702Account: viemAccount,
        entryPoint: process.env.NEXT_PUBLIC_ENTRY_POINT_ADDRESS!,
        kernelVersion: '0.3.0',
        eip7702Auth: authorization,
      });

      setKernelAccount(kernel);
      return kernel;
    } catch (error) {
      console.error('Failed to create kernel account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [turnkey, user, getActiveClient]);

  return {
    kernelAccount,
    createKernel,
    isLoading,
  };
}
```

### 3. Transaction Execution Component

```typescript
// components/TransactionExecutor.tsx
import { useKernelAccount } from '../hooks/useKernelAccount';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { parseEther } from 'viem';

export function TransactionExecutor() {
  const { kernelAccount, createKernel, isLoading } = useKernelAccount();
  const { authenticated } = usePrivy();
  const [txHash, setTxHash] = useState<string>('');
  const [executing, setExecuting] = useState(false);

  const handleInitialize = async () => {
    try {
      await createKernel();
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  };

  const executeTransaction = async () => {
    if (!kernelAccount) return;

    setExecuting(true);
    try {
      // Example: Send ETH transaction
      const hash = await kernelAccount.sendTransaction({
        to: '0x742d35Cc6634C0532925a3b8D7f96c2c3d09ae8A',
        value: parseEther('0.001'),
        data: '0x',
      });

      setTxHash(hash);
      console.log('Transaction sent:', hash);
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setExecuting(false);
    }
  };

  const executeBatchTransaction = async () => {
    if (!kernelAccount) return;

    setExecuting(true);
    try {
      // Example: Batch multiple transactions
      const hash = await kernelAccount.sendTransactions([
        {
          to: '0x742d35Cc6634C0532925a3b8D7f96c2c3d09ae8A',
          value: parseEther('0.001'),
          data: '0x',
        },
        {
          to: '0x742d35Cc6634C0532925a3b8D7f96c2c3d09ae8A',
          value: parseEther('0.002'),
          data: '0x',
        },
      ]);

      setTxHash(hash);
      console.log('Batch transaction sent:', hash);
    } catch (error) {
      console.error('Batch transaction failed:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (!authenticated) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">7702 ZeroDev Integration</h3>
        <p className="text-sm text-gray-600">
          Initialize your kernel account and execute gasless transactions
        </p>
      </div>

      {!kernelAccount ? (
        <button
          onClick={handleInitialize}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Initializing...' : 'Initialize Kernel Account'}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={executeTransaction}
            disabled={executing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Send Transaction'}
          </button>
          
          <button
            onClick={executeBatchTransaction}
            disabled={executing}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Send Batch Transaction'}
          </button>
        </div>
      )}

      {txHash && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <strong>Transaction Hash:</strong>
            <br />
            <code className="text-xs">{txHash}</code>
          </p>
        </div>
      )}
    </div>
  );
}
```

### 4. Configuration Files

```typescript
// config/wagmi.ts
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});
```

```typescript
// config/zerodev.ts
export const ZERODEV_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
  entryPointAddress: process.env.NEXT_PUBLIC_ENTRY_POINT_ADDRESS!,
  kernelImplementationAddress: process.env.NEXT_PUBLIC_KERNEL_IMPLEMENTATION_ADDRESS!,
  bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL!,
  paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL!,
};
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_ZERODEV_PROJECT_ID=your_zerodev_project_id
NEXT_PUBLIC_ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_KERNEL_IMPLEMENTATION_ADDRESS=your_kernel_implementation_address
NEXT_PUBLIC_BUNDLER_URL=https://rpc.zerodev.app/api/v2/bundler/your_project_id
NEXT_PUBLIC_PAYMASTER_URL=https://rpc.zerodev.app/api/v2/paymaster/your_project_id
```

## Advanced Features

### Gas Sponsorship

```typescript
// Enable gas sponsorship for all transactions
const kernelAccount = await createKernelAccount(publicClient, {
  eip7702Account: viemAccount,
  entryPoint,
  kernelVersion: '0.3.0',
  eip7702Auth: authorization,
  paymaster: {
    // ZeroDev will sponsor gas for all transactions
    sponsor: true,
  },
});
```

### Permission Management

```typescript
// Set up session keys for limited permissions
const sessionKey = await kernelAccount.createSessionKey({
  permissions: {
    allowedMethods: ['transfer', 'approve'],
    allowedContracts: ['0x742d35Cc6634C0532925a3b8D7f96c2c3d09ae8A'],
    maxGasLimit: BigInt(100000),
    validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  },
});
```

## Key Benefits

1. **Gasless Transactions**: Users don't need ETH for gas fees
2. **Transaction Batching**: Multiple operations in a single transaction
3. **Enhanced UX**: Seamless wallet experience with Privy
4. **Flexible Permissions**: Session keys and time-limited access
5. **Chain Abstraction**: Works across multiple chains

## Resources

- [7702 ZeroDev Documentation](https://docs.zerodev.app/sdk/getting-started/quickstart-7702)
- [Privy Documentation](https://docs.privy.io/)
- [ZeroDev Dashboard](https://dashboard.zerodev.app)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)