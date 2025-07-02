'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { http, type Address, createPublicClient } from 'viem';
import { base } from 'viem/chains';

export const useDeploySmartWallet = () => {
  const { ready, authenticated, user, sendTransaction } = usePrivy();
  const { wallets } = useWallets();

  // Get embedded wallet (signer)
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );

  // Get smart wallet from user data
  const smartWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'coinbase_smart_wallet',
  );

  const deploySmartWalletOnChain = async () => {
    try {
      // Check if smart wallet is already available
      if (smartWallet) {
        // Check if it's deployed on-chain
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const bytecode = await publicClient.getBytecode({
          address: smartWallet.address as Address,
        });

        const isDeployed = bytecode && bytecode !== '0x';

        return {
          address: smartWallet.address as Address,
          alreadyDeployed: isDeployed,
          isSmartWallet: true,
        };
      }

      // Smart wallet deployment disabled to prevent user approval popups
      // DCA transactions will create smart wallets automatically when needed
      if (!embeddedWallet) {
        throw new Error('No embedded wallet found');
      }

      // Return embedded wallet info - smart wallet creation happens on first DCA transaction
      return {
        address: embeddedWallet.address as Address,
        alreadyDeployed: false,
        isSmartWallet: false,
        message:
          'Smart wallet will be created automatically on first transaction',
      };
    } catch (error) {
      // Silent failure - smart wallet creation will happen automatically
      throw error;
    }
  };

  const getSmartWalletInfo = () => {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    return {
      hasEmbeddedWallet: !!embeddedWallet,
      hasSmartWallet: !!smartWallet,
      embeddedWalletAddress: embeddedWallet?.address,
      smartWalletAddress: smartWallet?.address,
      canDeploy: !!embeddedWallet && !smartWallet,
    };
  };

  return {
    deploySmartWalletOnChain,
    getSmartWalletInfo,
    smartWallet,
    embeddedWallet,
    isReady: ready && authenticated && !!embeddedWallet,
  };
};
