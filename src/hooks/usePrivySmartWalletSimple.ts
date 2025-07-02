'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { base } from 'viem/chains';

export function usePrivySmartWallet() {
  const { user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);

  // Get the active wallet (embedded or external)
  const activeWallet = wallets[0];

  // Test transaction to verify smart wallet works
  const testSmartWallet = useCallback(async () => {
    if (!authenticated || !activeWallet) {
      toast.error('Please sign in first');
      return;
    }

    try {
      setIsDeploying(true);

      // First ensure wallet is ready
      await activeWallet.connect();

      // Switch to Base network
      console.log('Switching to Base network...');
      await activeWallet.switchChain(base.id);
      console.log('Switched to Base network');

      // Get the provider and send transaction using the wallet directly
      const provider = await activeWallet.getEthereumProvider();
      console.log('Got provider:', provider);

      // Send transaction directly through the provider
      const transactionRequest = {
        from: activeWallet.address,
        to: activeWallet.address,
        value: '0x0', // 0 ETH in hex
        chainId: '0x2105', // Base chain ID in hex
      };

      console.log('Sending transaction:', transactionRequest);

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [transactionRequest],
      });

      console.log('Transaction sent:', hash);
      toast.success(`Transaction sent successfully! Hash: ${hash}`);
      return hash;
    } catch (error: any) {
      console.error('Smart wallet test error:', error);
      toast.error(error.message || 'Failed to send transaction');
      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, [authenticated, activeWallet]);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!activeWallet) return '0';

    try {
      await activeWallet.connect();
      const provider = await activeWallet.getEthereumProvider();
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [activeWallet.address, 'latest'],
      });
      return balance;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  }, [activeWallet]);

  return {
    // Wallet state
    walletAddress: activeWallet?.address,
    walletType: activeWallet?.walletClientType,
    isLoading: isDeploying,

    // Actions
    testSmartWallet,
    getBalance,

    // User state
    user,
    ready,
    authenticated,
    activeWallet,
  };
}
