'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';

interface SmartWalletResult {
  smartWalletAddress: Address;
  isDeployed: boolean;
}

export const useSimpleSmartWallet = () => {
  const { ready, authenticated, user } = usePrivy();
  const [isChecking, setIsChecking] = useState(false);
  const [smartWalletAddress, setSmartWalletAddress] = useState<Address | null>(
    null,
  );

  // Check user's linked accounts for smart wallet
  const getSmartWalletFromUser = useCallback(() => {
    if (!user?.linkedAccounts) return null;

    const smartWallet = user.linkedAccounts.find(
      (account) => account.type === 'smart_wallet',
    );

    if (smartWallet && 'address' in smartWallet) {
      return smartWallet.address as Address;
    }

    return null;
  }, [user?.linkedAccounts]);

  // Update smart wallet address when user changes
  useEffect(() => {
    const address = getSmartWalletFromUser();
    if (address) {
      setSmartWalletAddress(address);
      console.log('Smart wallet found:', address);
    }
  }, [getSmartWalletFromUser]);

  // Get embedded wallet
  const embeddedWallet = user?.linkedAccounts?.find(
    (account) =>
      account.type === 'wallet' && account.walletClientType === 'privy',
  );

  // Check for smart wallet (Privy should create it automatically)
  const checkForSmartWallet =
    useCallback(async (): Promise<SmartWalletResult> => {
      if (!ready || !authenticated || !user) {
        throw new Error('Not authenticated');
      }

      // If smart wallet already exists, return it
      const existingAddress = getSmartWalletFromUser();
      if (existingAddress) {
        return {
          smartWalletAddress: existingAddress,
          isDeployed: true,
        };
      }

      setIsChecking(true);

      try {
        console.log('Checking for Privy smart wallet...');

        // Since Privy has createOnLogin: 'all-users', the smart wallet should be created
        // Let's wait a bit and check again
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const smartWalletCheck = getSmartWalletFromUser();
          if (smartWalletCheck) {
            console.log('Smart wallet appeared:', smartWalletCheck);
            setSmartWalletAddress(smartWalletCheck);

            return {
              smartWalletAddress: smartWalletCheck,
              isDeployed: true,
            };
          }

          attempts++;
          console.log(
            `Waiting for Privy smart wallet... attempt ${attempts}/${maxAttempts}`,
          );
        }

        // If we still don't have a smart wallet, Privy might need a refresh
        console.log('Smart wallet not found. Privy might need to sync.');

        // Return embedded wallet as fallback
        if (embeddedWallet && 'address' in embeddedWallet) {
          return {
            smartWalletAddress: embeddedWallet.address as Address,
            isDeployed: false,
          };
        }

        throw new Error('No wallet found');
      } finally {
        setIsChecking(false);
      }
    }, [ready, authenticated, user, getSmartWalletFromUser, embeddedWallet]);

  return {
    checkForSmartWallet,
    isChecking,
    smartWalletAddress,
    embeddedWallet,
    isReady: ready && authenticated && !!user,
  };
};
