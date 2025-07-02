'use client';
import { usePrivy } from '@privy-io/react-auth';
import type { Address } from 'viem';

export interface SmartWalletInfo {
  address: Address | null;
  isDeployed: boolean;
  deploymentTxHash?: string;
  canUseSessionKeys: boolean;
}

export const usePrivySmartWallet = () => {
  const { ready, authenticated, user } = usePrivy();

  const getSmartWalletAddress = (): Address | null => {
    if (!user?.linkedAccounts) return null;

    const smartWallet = user.linkedAccounts.find(
      (account) => account.type === 'smart_wallet',
    );

    return (smartWallet?.address as Address) || null;
  };

  const getEmbeddedWalletAddress = (): Address | null => {
    if (!user?.linkedAccounts) return null;

    const embeddedWallet = user.linkedAccounts.find(
      (account) =>
        account.type === 'wallet' &&
        'walletClientType' in account &&
        account.walletClientType === 'privy',
    );

    return embeddedWallet && 'address' in embeddedWallet
      ? (embeddedWallet.address as Address)
      : null;
  };

  const isSmartWalletDeployed = (): boolean => {
    const smartWalletAddress = getSmartWalletAddress();
    return !!smartWalletAddress;
  };

  const deploySmartWallet = async (): Promise<SmartWalletInfo> => {
    try {
      if (!ready || !authenticated) {
        throw new Error('User not authenticated');
      }

      // Check if smart wallet already exists
      const existingAddress = getSmartWalletAddress();
      if (existingAddress) {
        return {
          address: existingAddress,
          isDeployed: true,
          canUseSessionKeys: true,
        };
      }

      // Since smart wallets are enabled in your dashboard, they should be auto-created
      // Check if user logged in before smart wallets were enabled

      // Check if there are any accounts that might be smart wallets but with different type
      const potentialSmartWallets = user?.linkedAccounts?.filter(
        (acc) =>
          ('walletClientType' in acc &&
            acc.walletClientType === 'coinbase_smart_wallet') ||
          ('connectorType' in acc &&
            acc.connectorType === 'coinbase_smart_wallet') ||
          acc.type.includes('smart'),
      );

      // Check potential smart wallets

      if (potentialSmartWallets && potentialSmartWallets.length > 0) {
        // Found a potential smart wallet with different detection
        const smartWallet = potentialSmartWallets[0];
        return {
          address:
            'address' in smartWallet
              ? (smartWallet.address as Address)
              : ('' as Address),
          isDeployed: true,
          canUseSessionKeys: true,
        };
      }

      // With dashboard configuration, smart wallets are typically created on first transaction
      // or automatically on login. If none exists, user may need to reconnect.
      throw new Error(
        'No smart wallet found. Smart wallets may be created on first transaction, or check your Privy Dashboard configuration.',
      );
    } catch (error) {
      // Silent failure - smart wallet will be created on first transaction if needed
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Smart wallet deployment failed: ${String(error)}`);
      }
    }
  };

  const getSmartWalletInfo = (): SmartWalletInfo => {
    const address = getSmartWalletAddress();
    return {
      address,
      isDeployed: !!address,
      canUseSessionKeys: !!address,
    };
  };

  return {
    // Address getters
    getSmartWalletAddress,
    getEmbeddedWalletAddress,
    // Status checks
    isSmartWalletDeployed,
    getSmartWalletInfo,
    // Deployment
    deploySmartWallet,
    // State
    isReady: ready && authenticated,
    user,
  };
};
