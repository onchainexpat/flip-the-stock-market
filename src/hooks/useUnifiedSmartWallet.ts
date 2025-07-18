'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import { useAccount } from 'wagmi';

// Import existing services
import { coinbaseSmartWalletService } from '../lib/coinbaseSmartWalletService';
import { clientSessionKeyService } from '../services/clientSessionKeyService';
import {
  createBasePublicClient,
  createZeroDevKernelAccount,
  createZeroDevKernelClient,
} from '../utils/zerodev';

interface SmartWalletState {
  isReady: boolean;
  isLoading: boolean;
  address: Address | null;
  walletType:
    | 'embedded_privy'
    | 'external_wallet'
    | 'coinbase_smart'
    | 'zerodev_smart'
    | null;
  hasGasSponsorship: boolean;
  needsDeployment: boolean;
  sessionKeySupported: boolean;
  error: string | null;
}

interface SessionKeyData {
  sessionAddress: Address;
  permissions: Array<{
    target: Address;
    valueLimit: bigint;
    functionSelectors: string[];
  }>;
  validUntil: number;
  validAfter: number;
}

export function useUnifiedSmartWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();

  const [state, setState] = useState<SmartWalletState>({
    isReady: false,
    isLoading: false,
    address: null,
    walletType: null,
    hasGasSponsorship: false,
    needsDeployment: false,
    sessionKeySupported: false,
    error: null,
  });

  const [smartWalletAccount, setSmartWalletAccount] = useState<any>(null);
  const [smartWalletClient, setSmartWalletClient] = useState<any>(null);

  // Get active wallet from Privy
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );
  const externalWallet = wallets.find(
    (wallet) => wallet.walletClientType !== 'privy',
  );
  const activeWallet = embeddedWallet || externalWallet || null;

  // Determine wallet configuration
  const detectWalletConfiguration = useCallback(async () => {
    if (!ready || !authenticated) {
      setState((prev) => ({ ...prev, isReady: false, walletType: null }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      let walletType: SmartWalletState['walletType'] = null;
      let address: Address | null = null;
      let hasGasSponsorship = false;
      let sessionKeySupported = false;
      let needsDeployment = false;

      // Priority 1: External wallet with ZeroDev (from Privy or Wagmi)
      if (externalWallet || (isConnected && wagmiAddress)) {
        const wallet = externalWallet || activeWallet;
        const walletAddress = externalWallet?.address || wagmiAddress;

        console.log(
          '🔗 External wallet detected, configuring ZeroDev smart wallet...',
        );
        console.log(
          '🔍 Wallet source:',
          externalWallet ? 'Privy external' : 'Wagmi direct',
        );
        console.log('🔍 Wallet address:', walletAddress);

        try {
          const publicClient = createBasePublicClient();

          // Create ZeroDev kernel account
          const kernelAccount = await createZeroDevKernelAccount(
            publicClient,
            wallet,
            base,
          );

          // Check if smart wallet is already deployed
          const code = await publicClient.getBytecode({
            address: kernelAccount.address,
          });
          const isDeployed = code && code !== '0x' && code.length > 2;

          setSmartWalletAccount(kernelAccount);

          if (isDeployed) {
            // Create kernel client for deployed smart wallet
            const kernelClient = await createZeroDevKernelClient(
              kernelAccount,
              base,
            );
            setSmartWalletClient(kernelClient);
          }

          walletType = 'zerodev_smart';
          address = kernelAccount.address;
          hasGasSponsorship = true; // ZeroDev provides gas sponsorship
          sessionKeySupported = true; // ZeroDev supports session keys
          needsDeployment = !isDeployed;

          console.log('✅ ZeroDev smart wallet configured:', {
            address,
            isDeployed,
            hasGasSponsorship,
            walletSource: externalWallet ? 'Privy external' : 'Wagmi direct',
          });
        } catch (error) {
          console.error('❌ ZeroDev configuration failed:', error);

          // Fallback to regular external wallet
          walletType = 'external_wallet';
          address = walletAddress as Address;
          hasGasSponsorship = false;
          sessionKeySupported = false;
          needsDeployment = false;
        }
      }

      // Priority 2: Privy embedded wallet (currently having issues)
      else if (embeddedWallet) {
        console.log('📧 Privy embedded wallet detected...');

        // Check if Privy smart wallet is configured
        const smartWallet = user?.linkedAccounts?.find(
          (account: any) => account.type === 'smart_wallet',
        );

        if (smartWallet) {
          walletType = 'coinbase_smart';
          address = smartWallet.address;
          hasGasSponsorship = true;
          sessionKeySupported = true;
          needsDeployment = false;
        } else {
          walletType = 'embedded_privy';
          address = embeddedWallet.address as Address;
          hasGasSponsorship = false;
          sessionKeySupported = false;
          needsDeployment = true; // Would need smart wallet deployment
        }

        console.log('📧 Privy wallet status:', {
          address,
          hasSmartWallet: !!smartWallet,
          walletType,
        });
      }

      setState((prev) => ({
        ...prev,
        isReady: true,
        isLoading: false,
        address,
        walletType,
        hasGasSponsorship,
        sessionKeySupported,
        needsDeployment,
        error: null,
      }));
    } catch (error) {
      console.error('❌ Wallet detection failed:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Wallet detection failed',
      }));
    }
  }, [
    ready,
    authenticated,
    externalWallet,
    embeddedWallet,
    isConnected,
    wagmiAddress,
    user,
  ]);

  // Auto-detect wallet configuration when dependencies change
  useEffect(() => {
    console.log('🔄 Wallet configuration changed, re-detecting...');
    console.log('🔍 Ready:', ready);
    console.log('🔍 Authenticated:', authenticated);
    console.log('🔍 Wallets:', wallets.length);
    console.log('🔍 External wallet:', !!externalWallet);
    console.log('🔍 Embedded wallet:', !!embeddedWallet);
    console.log('🔍 Wagmi connected:', isConnected);
    console.log('🔍 Wagmi address:', wagmiAddress);

    detectWalletConfiguration();
  }, [detectWalletConfiguration]);

  // Deploy smart wallet (for ZeroDev)
  const deploySmartWallet = useCallback(async (): Promise<string | null> => {
    if (!smartWalletAccount || state.walletType !== 'zerodev_smart') {
      throw new Error(
        'Smart wallet deployment not available for this wallet type',
      );
    }

    if (!state.needsDeployment) {
      console.log('✅ Smart wallet already deployed');
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      console.log('🚀 Deploying ZeroDev smart wallet...');

      const kernelClient = await createZeroDevKernelClient(
        smartWalletAccount,
        base,
      );
      setSmartWalletClient(kernelClient);

      // Deploy by sending a transaction to self
      const deployTx = await kernelClient.sendTransaction({
        account: smartWalletAccount,
        to: smartWalletAccount.address,
        value: 0n,
      });

      console.log('✅ Smart wallet deployed!', deployTx);
      toast.success('Smart wallet deployed with gas sponsorship!');

      // Update state to reflect deployment
      setState((prev) => ({
        ...prev,
        needsDeployment: false,
        isLoading: false,
      }));

      return deployTx;
    } catch (error) {
      console.error('❌ Smart wallet deployment failed:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
      }));
      throw error;
    }
  }, [smartWalletAccount, state.walletType, state.needsDeployment]);

  // Generate session key for automated DCA
  const generateSessionKey = useCallback(
    async (
      permissions: Array<{
        target: Address;
        valueLimit: bigint;
        functionSelectors: string[];
      }>,
      dcaParams?: {
        userWalletAddress: Address;
        totalAmount: bigint;
        orderSizeAmount: bigint;
        durationDays: number;
      },
    ): Promise<SessionKeyData> => {
      if (!state.sessionKeySupported || !state.address) {
        throw new Error('Session keys not supported for this wallet type');
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        if (state.walletType === 'coinbase_smart') {
          // Use existing Coinbase smart wallet service
          const sessionData =
            await coinbaseSmartWalletService.generateSessionKey(
              state.address,
              permissions,
            );

          setState((prev) => ({ ...prev, isLoading: false }));
          return sessionData;
        } else if (state.walletType === 'zerodev_smart') {
          // Use proper ZeroDev session key service
          console.log('🔑 Creating ZeroDev session key with private key...');

          if (!dcaParams) {
            throw new Error(
              'DCA parameters required for ZeroDev session key creation',
            );
          }

          // Use the client-side session key service
          // Get the user's wallet provider
          const wallet = externalWallet || activeWallet;
          if (!wallet) {
            throw new Error('No wallet provider available');
          }

          const sessionData = await clientSessionKeyService.createSessionKey(
            wallet.provider,
            dcaParams.totalAmount,
            dcaParams.durationDays,
          );

          console.log(
            '✅ ZeroDev session key with private key created successfully',
          );
          setState((prev) => ({ ...prev, isLoading: false }));
          return sessionData;
        }

        throw new Error('Unsupported wallet type for session keys');
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Session key generation failed',
        }));
        throw error;
      }
    },
    [state.sessionKeySupported, state.address, state.walletType],
  );

  // Send transaction through smart wallet
  const sendTransaction = useCallback(
    async (transaction: {
      to: Address;
      value?: bigint;
      data?: string;
    }): Promise<string> => {
      if (!state.address || !state.hasGasSponsorship) {
        throw new Error('Smart wallet not ready for transactions');
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        if (state.walletType === 'zerodev_smart' && smartWalletClient) {
          console.log('🔍 PREPARING SMART WALLET TRANSACTION:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📄 WHAT YOU ARE SIGNING:');
          console.log('   📍 Target Contract:', transaction.to);
          console.log(
            '   💰 Value (ETH):',
            transaction.value
              ? (Number(transaction.value) / 1e18).toFixed(6)
              : '0',
          );
          console.log('   📊 Gas Limit:', transaction.gas || 'Auto-estimated');
          console.log(
            '   🎯 Transaction Type: Smart Wallet UserOperation (ERC-4337)',
          );
          console.log(
            '   🔐 Signature Purpose: Authorize smart wallet to execute this transaction',
          );
          console.log(
            '   ⛽ Gas Sponsorship: ZeroDev paymaster (transaction is FREE)',
          );

          if (transaction.data && transaction.data !== '0x') {
            console.log(
              '   📝 Transaction Data Present: Yes (contract interaction)',
            );
            console.log(
              '   📝 Data Length:',
              transaction.data.length,
              'characters',
            );

            // Decode common function signatures
            const functionSignature = transaction.data.slice(0, 10);
            let functionDescription = 'Unknown function call';

            switch (functionSignature) {
              case '0xa9059cbb':
                functionDescription = 'ERC-20 Token Transfer';
                break;
              case '0x095ea7b3':
                functionDescription = 'ERC-20 Approve (set spending allowance)';
                break;
              case '0x1fff991f':
                functionDescription = '0x Protocol Token Swap';
                break;
              case '0x6352211e':
                functionDescription = 'NFT Owner Query';
                break;
              case '0x23b872dd':
                functionDescription = 'ERC-20 Transfer From';
                break;
              default:
                functionDescription = `Contract Interaction (${functionSignature})`;
            }

            console.log('   📝 Function Call:', functionDescription);
            console.log('   📝 Function Signature:', functionSignature);
          } else {
            console.log('   📝 Transaction Data: Simple ETH transfer');
          }

          console.log('');
          console.log('🔒 SECURITY SUMMARY:');
          console.log(
            '   ✅ This signature authorizes your smart wallet to execute ONE specific transaction',
          );
          console.log(
            '   ✅ The signature cannot be reused for other transactions',
          );
          console.log('   ✅ Gas fees are sponsored - you pay nothing');
          console.log(
            '   ✅ You can revoke smart wallet permissions at any time',
          );
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Add debugging for smart wallet state
          console.log('🔍 SMART WALLET DEBUG INFO:');
          console.log(
            '   📍 Smart Wallet Address:',
            smartWalletAccount?.address,
          );
          console.log(
            '   ⛽ Gas Sponsorship Available:',
            state.hasGasSponsorship,
          );
          console.log('   🔧 Smart Wallet Client:', !!smartWalletClient);
          console.log('   📊 Transaction Gas:', transaction.gas);

          // Prepare transaction parameters for ZeroDev
          const txParams = {
            account: smartWalletAccount,
            to: transaction.to,
            value: transaction.value || 0n,
            data: transaction.data || '0x',
          };

          console.log('🚀 Sending transaction with params:', {
            to: txParams.to,
            value: txParams.value?.toString() || '0',
            hasData: !!txParams.data,
            dataLength: txParams.data?.length || 0,
          });

          console.log(
            '⛽ Letting ZeroDev estimate gas and handle paymaster...',
          );

          try {
            // Add a pre-signing message to explain the second signature
            console.log(
              '📝 You will now see a signature request from your wallet.',
            );
            console.log('   This is the smart wallet authorization signature.');
            console.log('   It allows your smart wallet to execute the swap.');

            console.log('🚀 Sending UserOperation...');
            const userOpHash = await smartWalletClient.sendUserOperation({
              account: smartWalletAccount,
              calls: [
                {
                  to: txParams.to,
                  value: txParams.value || 0n,
                  data: txParams.data || '0x',
                },
              ],
            });

            console.log('📝 UserOperation sent:', userOpHash);
            console.log(
              '⏳ Waiting for UserOperation to be included in block...',
            );

            const receipt = await smartWalletClient.waitForUserOperationReceipt(
              {
                hash: userOpHash,
              },
            );

            const actualTxHash = receipt.receipt.transactionHash;
            console.log('✅ TRANSACTION SENT:', actualTxHash);
            return actualTxHash;
          } catch (error: any) {
            console.error('❌ TRANSACTION FAILED:', error);
            console.error('❌ Error details:', {
              message: error.message,
              cause: error.cause,
              details: error.details,
              code: error.code,
            });

            // Check if it's a specific error we can handle
            if (error.message?.includes('insufficient funds')) {
              console.error(
                '💰 INSUFFICIENT FUNDS ERROR - Check smart wallet balance',
              );
            } else if (error.message?.includes('allowance')) {
              console.error(
                '🔐 ALLOWANCE ERROR - USDC approval might be needed',
              );
            } else if (error.message?.includes('simulation')) {
              console.error(
                '⚠️ SIMULATION ERROR - Transaction would fail on-chain',
              );
              console.error(
                '💡 Common causes: insufficient balance, missing approval, or contract error',
              );
            }

            throw error;
          }
        } else if (state.walletType === 'coinbase_smart') {
          // Use Coinbase smart wallet service
          throw new Error(
            'Coinbase smart wallet transactions not yet implemented in this hook',
          );
        }

        throw new Error('Unsupported wallet type for transactions');
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        }));
        throw error;
      }
    },
    [
      state.address,
      state.hasGasSponsorship,
      state.walletType,
      smartWalletClient,
      smartWalletAccount,
    ],
  );

  // Send batch of transactions (for DCA setup, swaps, cleanup)
  const sendBatchTransactions = useCallback(
    async (
      transactions: Array<{
        to: Address;
        value?: bigint;
        data?: string;
        description?: string;
        executeFrom?: 'external_wallet' | 'smart_wallet';
      }>,
    ): Promise<string[]> => {
      if (!state.address) {
        throw new Error('Wallet not ready for transactions');
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const txHashes: string[] = [];

        // Separate transactions by executor
        const externalWalletTxs = transactions.filter(
          (tx) => tx.executeFrom !== 'smart_wallet',
        );
        const smartWalletTxs = transactions.filter(
          (tx) => tx.executeFrom === 'smart_wallet',
        );

        // Execute external wallet transactions first (e.g., USDC transfer to smart wallet)
        if (externalWalletTxs.length > 0 && activeWallet) {
          console.log(
            '🔗 Executing',
            externalWalletTxs.length,
            'transactions from external wallet...',
          );

          for (const tx of externalWalletTxs) {
            console.log('📤', tx.description || 'External wallet transaction');

            // Use external wallet provider to send transaction
            const provider = await activeWallet.getEthereumProvider();
            const txHash = await provider.request({
              method: 'eth_sendTransaction',
              params: [
                {
                  from: activeWallet.address,
                  to: tx.to,
                  value: tx.value ? `0x${tx.value.toString(16)}` : '0x0',
                  data: tx.data || '0x',
                },
              ],
            });

            txHashes.push(txHash);
            console.log('✅ External wallet tx:', txHash);
          }
        }

        // Execute smart wallet transactions (e.g., approvals, swaps)
        if (
          smartWalletTxs.length > 0 &&
          smartWalletClient &&
          smartWalletAccount
        ) {
          console.log(
            '🤖 Executing',
            smartWalletTxs.length,
            'transactions from smart wallet...',
          );

          // Check if we have multiple transactions that can be batched
          if (smartWalletTxs.length > 1) {
            console.log(
              '📦 Batching',
              smartWalletTxs.length,
              'transactions into single UserOperation...',
            );

            // Prepare batch calls
            const calls = smartWalletTxs.map((tx) => ({
              to: tx.to,
              value: tx.value || 0n,
              data: tx.data || '0x',
            }));

            try {
              // Execute batch transaction - ZeroDev will create a single UserOperation
              console.log('🚀 Sending UserOperation batch...');
              const userOpHash = await smartWalletClient.sendUserOperation({
                account: smartWalletAccount,
                calls,
              });

              console.log('📝 UserOperation sent:', userOpHash);
              console.log(
                '⏳ Waiting for UserOperation to be included in block...',
              );

              // Wait for the UserOperation to be included in a block and get the actual transaction hash
              const receipt =
                await smartWalletClient.waitForUserOperationReceipt({
                  hash: userOpHash,
                });

              const actualTxHash = receipt.receipt.transactionHash;
              txHashes.push(actualTxHash);

              console.log('✅ UserOperation included in block!');
              console.log('📍 Actual transaction hash:', actualTxHash);
              console.log('📝 Included operations:');
              smartWalletTxs.forEach((tx) =>
                console.log('  -', tx.description || 'Transaction'),
              );
            } catch (error) {
              console.error(
                '❌ Batch execution failed, falling back to individual transactions:',
                error,
              );

              // Fallback to individual transactions if batch fails
              for (const tx of smartWalletTxs) {
                console.log('🔄', tx.description || 'Smart wallet transaction');

                const userOpHash = await smartWalletClient.sendUserOperation({
                  account: smartWalletAccount,
                  calls: [
                    {
                      to: tx.to,
                      value: tx.value || 0n,
                      data: tx.data || '0x',
                    },
                  ],
                });

                console.log('📝 Individual UserOperation sent:', userOpHash);
                console.log('⏳ Waiting for UserOperation to be included...');

                const receipt =
                  await smartWalletClient.waitForUserOperationReceipt({
                    hash: userOpHash,
                  });

                const actualTxHash = receipt.receipt.transactionHash;
                txHashes.push(actualTxHash);
                console.log('✅ Individual tx hash:', actualTxHash);
              }
            }
          } else {
            // Single transaction - execute normally
            const tx = smartWalletTxs[0];
            console.log('🔄', tx.description || 'Smart wallet transaction');

            const userOpHash = await smartWalletClient.sendUserOperation({
              account: smartWalletAccount,
              calls: [
                {
                  to: tx.to,
                  value: tx.value || 0n,
                  data: tx.data || '0x',
                },
              ],
            });

            console.log('📝 Single UserOperation sent:', userOpHash);
            console.log('⏳ Waiting for UserOperation to be included...');

            const receipt = await smartWalletClient.waitForUserOperationReceipt(
              {
                hash: userOpHash,
              },
            );

            const actualTxHash = receipt.receipt.transactionHash;
            txHashes.push(actualTxHash);
            console.log('✅ Single tx hash:', actualTxHash);
          }
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return txHashes;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : 'Batch transaction failed',
        }));
        throw error;
      }
    },
    [state.address, activeWallet, smartWalletClient, smartWalletAccount],
  );

  return {
    // State
    ...state,

    // Data
    activeWallet,
    smartWalletAccount,
    smartWalletClient,

    // Actions
    deploySmartWallet,
    generateSessionKey,
    sendTransaction,
    sendBatchTransactions,
    refreshWalletState: detectWalletConfiguration,

    // Utility
    isExternalWallet:
      state.walletType === 'external_wallet' ||
      state.walletType === 'zerodev_smart',
    isPrivyWallet:
      state.walletType === 'embedded_privy' ||
      state.walletType === 'coinbase_smart',
    canCreateDCAOrders: state.sessionKeySupported && !state.needsDeployment,
  };
}
