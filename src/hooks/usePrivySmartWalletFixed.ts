'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { base } from 'viem/chains';

export function usePrivySmartWallet() {
  const { user, ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Get the active wallet (embedded or external)
  const activeWallet = wallets[0];

  // Ensure wallet is connected when authenticated
  useEffect(() => {
    const connectWallet = async () => {
      if (
        authenticated &&
        activeWallet &&
        !activeWallet.connected &&
        walletsReady &&
        !isConnecting
      ) {
        try {
          setIsConnecting(true);
          console.log('Auto-connecting wallet...');
          await activeWallet.connect();
          console.log('Wallet connected');
        } catch (error) {
          console.error('Auto-connect failed:', error);
        } finally {
          setIsConnecting(false);
        }
      }
    };

    connectWallet();
  }, [authenticated, activeWallet, walletsReady, isConnecting]);

  // Test transaction to verify smart wallet works
  const testSmartWallet = useCallback(async () => {
    if (!authenticated || !activeWallet) {
      toast.error('Please sign in first');
      return;
    }

    // Check if wallet is connected
    if (!activeWallet.connected) {
      toast.error('Wallet not connected. Please wait...');
      try {
        await activeWallet.connect();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        toast.error('Failed to connect wallet');
        return;
      }
    }

    try {
      setIsDeploying(true);

      // Check current chain
      const currentChainId = activeWallet.chainId;
      console.log('Current chain ID:', currentChainId);

      // Switch to Base network if not already on it
      if (currentChainId !== 'eip155:8453' && currentChainId !== base.id) {
        console.log('Switching to Base network...');
        try {
          await activeWallet.switchChain(base.id);
          console.log('Switched to Base network');

          // Wait a bit for the chain switch to propagate
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (switchError: any) {
          console.error('Chain switch error:', switchError);

          // For embedded wallets, the error might be expected
          if (activeWallet.walletClientType === 'privy') {
            console.log('Embedded wallet - proceeding despite switch error');
          } else {
            throw switchError;
          }
        }
      }

      // Get the provider
      const provider = await activeWallet.getEthereumProvider();
      console.log('Got provider:', provider);

      // For embedded wallets, we might need to use a different approach
      if (activeWallet.walletClientType === 'privy') {
        console.log('Using embedded wallet transaction flow');

        // Try using the sendTransaction method directly
        try {
          const tx = await activeWallet.sendTransaction({
            to: activeWallet.address,
            value: 0,
            chain: base,
          });

          console.log('Transaction sent via wallet method:', tx);
          toast.success(`Transaction sent! Hash: ${tx.hash || tx}`);
          return tx.hash || tx;
        } catch (walletError: any) {
          console.error('Wallet sendTransaction failed:', walletError);

          // Fallback to provider method
          const transactionRequest = {
            from: activeWallet.address,
            to: activeWallet.address,
            value: '0x0',
            chainId: base.id,
          };

          console.log('Sending via provider:', transactionRequest);

          const hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [transactionRequest],
          });

          console.log('Transaction sent via provider:', hash);
          toast.success(`Transaction sent! Hash: ${hash}`);
          return hash;
        }
      } else {
        // For external wallets, use the standard flow
        const transactionRequest = {
          from: activeWallet.address,
          to: activeWallet.address,
          value: '0x0',
        };

        console.log('Sending transaction:', transactionRequest);

        const hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [transactionRequest],
        });

        console.log('Transaction sent:', hash);
        toast.success(`Transaction sent! Hash: ${hash}`);
        return hash;
      }
    } catch (error: any) {
      console.error('Smart wallet test error:', error);

      // Provide more helpful error messages
      if (
        error.message?.includes('disconnected') ||
        error.message?.includes('Disconnected')
      ) {
        toast.error('Wallet disconnected. Please refresh and try again.');
      } else if (error.message?.includes('chain')) {
        toast.error('Chain switching issue. Please try again.');
      } else {
        toast.error(error.message || 'Failed to send transaction');
      }

      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, [authenticated, activeWallet]);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!activeWallet) return '0';

    try {
      if (!activeWallet.connected) {
        await activeWallet.connect();
      }

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
    chainId: activeWallet?.chainId,
    isConnected: activeWallet?.connected || false,
    isLoading: isDeploying || isConnecting,

    // Actions
    testSmartWallet,
    getBalance,

    // User state
    user,
    ready: ready && walletsReady,
    authenticated,
    activeWallet,
  };
}
