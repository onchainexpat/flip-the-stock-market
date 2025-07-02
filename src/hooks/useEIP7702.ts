'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import { getZeroDevConfig, signEIP7702Authorization } from '../utils/zerodev';

export const useEIP7702 = () => {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [smartAccount, setSmartAccount] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Upgrade EOA to smart account using EIP-7702
  const upgradeToSmartAccount = useCallback(
    async (contractAddress: Address) => {
      if (!authenticated || !user || wallets.length === 0) {
        setError('User not authenticated or no wallets available');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = wallets[0]; // Use the first available wallet
        const config = getZeroDevConfig(base);

        // Sign EIP-7702 authorization
        const authorization = await signEIP7702Authorization(
          wallet,
          contractAddress,
          base.id,
        );

        const smartAccountData = {
          authorization,
          config,
          wallet,
        };

        setSmartAccount(smartAccountData);
        return smartAccountData;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to upgrade to smart account';
        setError(errorMessage);
        console.error('Error upgrading to smart account:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [authenticated, user, wallets],
  );

  // Check if user can upgrade to smart account
  const canUpgrade = useCallback(() => {
    return authenticated && user && wallets.length > 0;
  }, [authenticated, user, wallets]);

  // Send sponsored transaction
  const sendSponsoredTransaction = useCallback(
    async (txData: any) => {
      if (!smartAccount?.wallet) {
        setError('Smart account not initialized');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // This would use the smart account to send a sponsored transaction
        // Implementation would depend on the specific ZeroDev SDK integration
        console.log('Sending sponsored transaction with ZeroDev:', txData);
        return 'placeholder-tx-hash';
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send transaction';
        setError(errorMessage);
        console.error('Error sending sponsored transaction:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [smartAccount],
  );

  return {
    upgradeToSmartAccount,
    sendSponsoredTransaction,
    canUpgrade: canUpgrade(),
    smartAccount,
    isLoading,
    error,
  };
};
