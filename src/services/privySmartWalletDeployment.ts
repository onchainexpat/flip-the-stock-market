'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';
// DEPRECATED: Using ZeroDev smart wallet integration instead

interface SmartWalletDeploymentResult {
  smartWalletAddress: Address;
  deploymentTxHash: string;
  isDeployed: boolean;
}

export const usePrivySmartWalletDeployment = () => {
  const { ready, authenticated, user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Get embedded wallet
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );

  // Check if smart wallet already exists
  const getExistingSmartWallet = useCallback(() => {
    if (!user?.linkedAccounts) return null;

    const smartWallet = user.linkedAccounts.find(
      (account) => account.type === 'smart_wallet',
    );

    return smartWallet && 'address' in smartWallet
      ? (smartWallet.address as Address)
      : null;
  }, [user?.linkedAccounts]);

  // Get or deploy smart wallet using Privy's infrastructure
  const deploySmartWallet =
    useCallback(async (): Promise<SmartWalletDeploymentResult> => {
      if (!ready || !authenticated) {
        throw new Error('Not authenticated');
      }

      setIsDeploying(true);
      setDeploymentError(null);

      try {
        // First check if smart wallet already exists
        const existingSmartWallet = getExistingSmartWallet();
        if (existingSmartWallet) {
          console.log('Smart wallet already exists:', existingSmartWallet);
          return {
            smartWalletAddress: existingSmartWallet,
            deploymentTxHash: 'already-exists',
            isDeployed: true,
          };
        }

        console.log(
          'Smart wallet not found, waiting for Privy to create it...',
        );

        // Privy should create the smart wallet automatically based on our config
        // Let's wait and check again
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const smartWallet = getExistingSmartWallet();
          if (smartWallet) {
            console.log('Smart wallet created by Privy:', smartWallet);
            return {
              smartWalletAddress: smartWallet,
              deploymentTxHash: 'privy-created',
              isDeployed: true,
            };
          }

          attempts++;
        }

        // If we still don't have a smart wallet, try to force creation
        // by refreshing the user's linked accounts
        if (user?.id) {
          console.log('Attempting to refresh user linked accounts...');
          // Force a refresh by reloading the page
          // This ensures Privy's state is fully synchronized
          window.location.reload();

          throw new Error(
            'Smart wallet creation in progress. Page will reload.',
          );
        }

        throw new Error(
          'Failed to create smart wallet after multiple attempts',
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown deployment error';
        setDeploymentError(errorMessage);

        console.error('Smart wallet deployment failed:', error);
        throw new Error(`Smart wallet deployment failed: ${errorMessage}`);
      } finally {
        setIsDeploying(false);
      }
    }, [ready, authenticated, user, getExistingSmartWallet]);

  return {
    deploySmartWallet,
    isDeploying,
    deploymentError,
    embeddedWallet,
    existingSmartWallet: getExistingSmartWallet(),
    isReady: ready && authenticated && !!embeddedWallet,
  };
};
