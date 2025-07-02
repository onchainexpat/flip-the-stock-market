'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { type Address, createWalletClient, custom } from 'viem';
import { base } from 'viem/chains';

interface SmartWalletResult {
  smartWalletAddress: Address;
  isDeployed: boolean;
}

export const useRealSmartWallet = () => {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);
  const [smartWalletAddress, setSmartWalletAddress] = useState<Address | null>(
    null,
  );

  // Get embedded wallet
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );

  // Get smart wallet - check multiple possible types
  const smartWallet = wallets.find(
    (wallet) =>
      wallet.connectorType === 'smart_wallet' ||
      wallet.walletClientType === 'coinbase_smart_wallet' ||
      wallet.walletClientType === 'smart_wallet' ||
      (wallet.walletClientType === 'privy' && wallet.imported),
  );

  // Check user's linked accounts for smart wallet
  const linkedSmartWallet = user?.linkedAccounts?.find(
    (account) => account.type === 'smart_wallet',
  );

  // Debug wallet information
  useEffect(() => {
    console.log('Wallet debug info:', {
      wallets: wallets.map((w) => ({
        address: w.address,
        connectorType: w.connectorType,
        walletClientType: w.walletClientType,
        imported: w.imported,
      })),
      linkedAccounts: user?.linkedAccounts,
    });
  }, [wallets, user]);

  // Update smart wallet address when available
  useEffect(() => {
    if (smartWallet?.address) {
      setSmartWalletAddress(smartWallet.address as Address);
    } else if (linkedSmartWallet && 'address' in linkedSmartWallet) {
      setSmartWalletAddress(linkedSmartWallet.address as Address);
    }
  }, [smartWallet, linkedSmartWallet]);

  // Deploy smart wallet by creating a wallet client
  const deploySmartWallet =
    useCallback(async (): Promise<SmartWalletResult> => {
      if (!ready || !authenticated || !embeddedWallet) {
        throw new Error('Wallet not ready for deployment');
      }

      // If smart wallet already exists, return it
      if (smartWalletAddress) {
        return {
          smartWalletAddress,
          isDeployed: true,
        };
      }

      setIsDeploying(true);

      try {
        console.log('Creating smart wallet client...');

        // Get the provider from the embedded wallet
        const provider = await embeddedWallet.getEthereumProvider();

        // Create a wallet client to trigger smart wallet creation
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(provider),
        });

        // Get the account address - this should trigger smart wallet creation
        const [account] = await walletClient.getAddresses();

        console.log('Wallet client created with account:', account);

        // Wait for smart wallet to be available
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Check if smart wallet is now available with multiple conditions
          const smartWalletCheck = wallets.find(
            (wallet) =>
              wallet.connectorType === 'smart_wallet' ||
              wallet.walletClientType === 'coinbase_smart_wallet' ||
              wallet.walletClientType === 'smart_wallet' ||
              (wallet.walletClientType === 'privy' && wallet.imported),
          );

          // Also check user's linked accounts
          const linkedCheck = user?.linkedAccounts?.find(
            (account) => account.type === 'smart_wallet',
          );

          if (smartWalletCheck?.address) {
            console.log(
              'Smart wallet found in wallets:',
              smartWalletCheck.address,
            );
            setSmartWalletAddress(smartWalletCheck.address as Address);

            return {
              smartWalletAddress: smartWalletCheck.address as Address,
              isDeployed: true,
            };
          }

          if (linkedCheck && 'address' in linkedCheck) {
            console.log(
              'Smart wallet found in linked accounts:',
              linkedCheck.address,
            );
            setSmartWalletAddress(linkedCheck.address as Address);

            return {
              smartWalletAddress: linkedCheck.address as Address,
              isDeployed: true,
            };
          }

          attempts++;
          console.log(
            `Waiting for smart wallet... attempt ${attempts}/${maxAttempts}`,
          );
        }

        // If Privy has createOnLogin enabled, the smart wallet should exist
        // Let's check if we need to trigger a page reload
        if (user?.id && attempts >= maxAttempts) {
          console.log(
            'Smart wallet not found after waiting. This might be a Privy sync issue.',
          );
          // Instead of throwing, return a pending state
          return {
            smartWalletAddress: embeddedWallet.address as Address, // Use embedded wallet temporarily
            isDeployed: false,
          };
        }

        throw new Error('Smart wallet deployment timed out');
      } catch (error) {
        console.error('Smart wallet deployment failed:', error);
        throw error;
      } finally {
        setIsDeploying(false);
      }
    }, [
      ready,
      authenticated,
      embeddedWallet,
      wallets,
      smartWalletAddress,
      user,
    ]);

  return {
    deploySmartWallet,
    isDeploying,
    embeddedWallet,
    smartWallet,
    smartWalletAddress,
    isReady: ready && authenticated && !!embeddedWallet,
  };
};

// Helper function to get smart wallet address from localStorage
export const getRealSmartWallet = (): Address | null => {
  if (typeof window === 'undefined') return null;

  try {
    // Privy stores wallet data in localStorage
    const privyData = localStorage.getItem('privy:connections');
    if (privyData) {
      const connections = JSON.parse(privyData);
      const smartWallet = connections.find(
        (c: any) => c.type === 'smart_wallet',
      );
      if (smartWallet?.address) {
        return smartWallet.address as Address;
      }
    }
  } catch (error) {
    console.error('Error reading smart wallet from storage:', error);
  }

  return null;
};
