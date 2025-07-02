'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { base } from 'viem/chains';

export function usePrivySmartWallet() {
  const { user, ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);
  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(
    null,
  );
  const [deploymentHash, setDeploymentHash] = useState<string | null>(null);

  // Get the active wallet (embedded or external)
  const activeWallet = wallets[0];

  // Check for smart wallet in user's linked accounts
  useEffect(() => {
    if (user?.linkedAccounts) {
      const smartWallet = user.linkedAccounts.find(
        (account: any) => account.type === 'smart_wallet',
      );
      if (smartWallet) {
        setSmartWalletAddress(smartWallet.address);
        console.log('Smart wallet found:', smartWallet.address);
      }
    }
  }, [user]);

  // Deploy smart wallet (trigger first transaction)
  const deploySmartWallet = useCallback(async () => {
    if (!authenticated || !activeWallet) {
      toast.error('Please sign in first');
      return;
    }

    try {
      setIsDeploying(true);

      // Switch to Base network
      console.log('Switching to Base network...');
      try {
        await activeWallet.switchChain(base.id);
      } catch (switchError: any) {
        console.log(
          'Chain switch error (may be expected for embedded wallets):',
          switchError,
        );
      }

      // Get the provider
      const provider = await activeWallet.getEthereumProvider();
      console.log('Got provider');

      // Send a transaction to deploy the smart wallet
      // Smart wallets are deployed on the first transaction
      const deployTx = {
        from: activeWallet.address,
        to: activeWallet.address, // Self transfer to trigger deployment
        value: '0x0', // 0 ETH
        data: '0x', // Empty data
      };

      console.log('Sending deployment transaction:', deployTx);

      let hash: string;
      try {
        // Try using sendTransaction if available
        if (activeWallet.sendTransaction) {
          const result = await activeWallet.sendTransaction(deployTx);
          hash = result.hash || result;
        } else {
          // Fallback to provider
          hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [deployTx],
          });
        }
      } catch (error: any) {
        console.error('Transaction error:', error);
        throw error;
      }

      console.log('Deployment transaction sent:', hash);
      setDeploymentHash(hash);

      // The smart wallet address should be available after deployment
      // In Privy, it might be the same as the EOA address or a different one
      // We'll need to check user.linkedAccounts again after deployment

      toast.success(
        `Smart wallet deployment initiated! Tx: ${hash.slice(0, 10)}...`,
      );

      // Wait a bit and check for smart wallet
      setTimeout(async () => {
        if (user?.linkedAccounts) {
          const smartWallet = user.linkedAccounts.find(
            (account: any) => account.type === 'smart_wallet',
          );
          if (smartWallet) {
            setSmartWalletAddress(smartWallet.address);
            console.log('Smart wallet deployed at:', smartWallet.address);
          }
        }
      }, 3000);

      return hash;
    } catch (error: any) {
      console.error('Smart wallet deployment error:', error);
      toast.error(error.message || 'Failed to deploy smart wallet');
      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, [authenticated, activeWallet, user]);

  // Get wallet balance
  const getBalance = useCallback(
    async (address?: string) => {
      if (!activeWallet && !address) return '0';

      try {
        const provider = await activeWallet?.getEthereumProvider();
        if (!provider) return '0';

        const targetAddress =
          address || smartWalletAddress || activeWallet.address;
        const balance = await provider.request({
          method: 'eth_getBalance',
          params: [targetAddress, 'latest'],
        });

        return balance;
      } catch (error) {
        console.error('Error fetching balance:', error);
        return '0';
      }
    },
    [activeWallet, smartWalletAddress],
  );

  // Send transaction from smart wallet
  const sendTransaction = useCallback(
    async (to: string, value: string, data?: string) => {
      if (!authenticated || !activeWallet) {
        throw new Error('Not authenticated');
      }

      try {
        // Switch to Base network
        try {
          await activeWallet.switchChain(base.id);
        } catch (switchError) {
          console.log('Chain switch error:', switchError);
        }

        const provider = await activeWallet.getEthereumProvider();

        const tx = {
          from: smartWalletAddress || activeWallet.address,
          to,
          value,
          data: data || '0x',
        };

        console.log('Sending transaction:', tx);

        let hash: string;
        if (activeWallet.sendTransaction) {
          const result = await activeWallet.sendTransaction(tx);
          hash = result.hash || result;
        } else {
          hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [tx],
          });
        }

        toast.success(`Transaction sent! Hash: ${hash.slice(0, 10)}...`);
        return hash;
      } catch (error: any) {
        console.error('Transaction error:', error);
        toast.error(error.message || 'Transaction failed');
        throw error;
      }
    },
    [authenticated, activeWallet, smartWalletAddress],
  );

  return {
    // Wallet state
    walletAddress: activeWallet?.address,
    smartWalletAddress,
    walletType: activeWallet?.walletClientType,
    chainId: activeWallet?.chainId,
    isConnected: !!activeWallet,
    isLoading: isDeploying,
    deploymentHash,

    // Actions
    deploySmartWallet,
    getBalance,
    sendTransaction,

    // User state
    user,
    ready: ready && walletsReady,
    authenticated,
    activeWallet,
  };
}
