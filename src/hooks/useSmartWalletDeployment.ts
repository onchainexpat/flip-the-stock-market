'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import { parseEther } from 'viem';
import { base } from 'viem/chains';
import {
  createBasePublicClient,
  createZeroDevKernelAccount,
  createZeroDevKernelClient,
  getZeroDevConfig,
} from '../utils/zerodev';
interface SmartWalletDeploymentState {
  account: any | null;
  client: any | null;
  isDeployed: boolean;
  isDeploying: boolean;
  deploymentTxHash: string | null;
  error: string | null;
}

export const useSmartWalletDeployment = () => {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [state, setState] = useState<SmartWalletDeploymentState>({
    account: null,
    client: null,
    isDeployed: false,
    isDeploying: false,
    deploymentTxHash: null,
    error: null,
  });

  // Check if user has a wallet and can deploy smart wallet
  const canDeploy = useCallback(() => {
    return (
      authenticated &&
      user &&
      wallets.length > 0 &&
      !state.isDeployed &&
      !state.isDeploying
    );
  }, [authenticated, user, wallets, state.isDeployed, state.isDeploying]);

  // Deploy smart wallet with gas sponsorship
  const deploySmartWallet = useCallback(async () => {
    if (!canDeploy()) {
      const error =
        'Cannot deploy: user not authenticated, no wallets available, or already deployed/deploying';
      setState((prev) => ({ ...prev, error }));
      return null;
    }

    setState((prev) => ({
      ...prev,
      isDeploying: true,
      error: null,
      deploymentTxHash: null,
    }));

    try {
      const wallet = wallets[0]; // Use the first available wallet as signer
      const config = getZeroDevConfig(base);

      console.log('🚀 Starting smart wallet deployment...');
      console.log('User address:', user?.wallet?.address);
      console.log('ZeroDev Project ID:', config.projectId);
      console.log('Chain:', base.name);

      // Create public client
      const publicClient = createBasePublicClient();
      console.log('✅ Public client created');

      // Create kernel account (this will generate the smart wallet address)
      console.log('🔧 Creating kernel account...');
      const kernelAccount = await createZeroDevKernelAccount(
        publicClient,
        wallet, // Use Privy wallet as signer
        base,
      );

      console.log('🎯 Smart wallet address generated:', kernelAccount.address);

      // Create kernel client with gas sponsorship
      console.log('💰 Setting up gas sponsorship...');
      const kernelClient = await createZeroDevKernelClient(kernelAccount, base);

      // Deploy the smart wallet by sending a small transaction
      // This will trigger the actual contract deployment on-chain
      console.log('📦 Deploying smart wallet on-chain...');
      console.log('⚡ Gas will be sponsored by ZeroDev paymaster');

      const deploymentTx = await kernelClient.sendTransaction({
        to: kernelAccount.address, // Send to self to trigger deployment
        value: parseEther('0'), // No value transfer needed
      });

      console.log('🎉 Smart wallet deployed successfully!');
      console.log('📋 Deployment transaction hash:', deploymentTx);
      console.log('🏠 Smart wallet address:', kernelAccount.address);
      console.log('💸 Gas was sponsored - user paid $0 in fees!');

      // Update state with successful deployment
      setState((prev) => ({
        ...prev,
        account: kernelAccount,
        client: kernelClient,
        isDeployed: true,
        isDeploying: false,
        deploymentTxHash: deploymentTx,
        error: null,
      }));

      return {
        account: kernelAccount,
        client: kernelClient,
        txHash: deploymentTx,
        address: kernelAccount.address,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to deploy smart wallet';
      console.error('❌ Smart wallet deployment failed:', err);

      setState((prev) => ({
        ...prev,
        isDeploying: false,
        error: errorMessage,
      }));

      return null;
    }
  }, [canDeploy, user, wallets]);

  // Send a sponsored transaction (after wallet is deployed)
  const sendSponsoredTransaction = useCallback(
    async (to: Address, value?: bigint, data?: string) => {
      if (!state.client || !state.isDeployed) {
        const error = 'Smart wallet not deployed yet';
        setState((prev) => ({ ...prev, error }));
        return null;
      }

      try {
        console.log('💰 Sending sponsored transaction...');
        console.log('To:', to);
        console.log('Value:', value?.toString() || '0');

        const txHash = await state.client.sendTransaction({
          to,
          value: value || parseEther('0'),
        });

        console.log('✅ Sponsored transaction sent:', txHash);
        console.log('💸 Gas was sponsored - user paid $0!');

        return txHash;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to send sponsored transaction';
        console.error('❌ Sponsored transaction failed:', err);
        setState((prev) => ({ ...prev, error: errorMessage }));
        return null;
      }
    },
    [state.client, state.isDeployed],
  );

  // Reset deployment state
  const reset = useCallback(() => {
    setState({
      account: null,
      client: null,
      isDeployed: false,
      isDeploying: false,
      deploymentTxHash: null,
      error: null,
    });
  }, []);

  return {
    // State
    account: state.account,
    client: state.client,
    isDeployed: state.isDeployed,
    isDeploying: state.isDeploying,
    deploymentTxHash: state.deploymentTxHash,
    error: state.error,

    // Actions
    deploySmartWallet,
    sendSponsoredTransaction,
    canDeploy,
    reset,

    // Wallet info
    smartWalletAddress: state.account?.address,
    userWalletAddress: user?.wallet?.address,
  };
};
