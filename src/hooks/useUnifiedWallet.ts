'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Address, Hex } from 'viem';
import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';
import { useAccount, useWalletClient } from 'wagmi';
import {
  type EIP7702DelegationInfo,
  eip7702Manager,
} from '../services/eip7702Manager';

export type WalletType =
  | 'privy_embedded' // Privy embedded wallet (EOA)
  | 'eip7702_delegated' // EOA with EIP-7702 delegation
  | 'external_eoa' // External EOA (MetaMask, etc.)
  | 'smart_contract' // Traditional smart contract wallet
  | 'coinbase_smart' // Coinbase Smart Wallet
  | 'unknown';

export interface UnifiedWalletInfo {
  address: Address;
  type: WalletType;
  isSmartWallet: boolean;
  hasGasSponsorship: boolean;
  hasSessionKeys: boolean;
  hasBatchTransactions: boolean;
  needsUpgrade: boolean;
  delegationInfo?: EIP7702DelegationInfo;
}

export interface UnifiedWalletActions {
  // Authentication
  signMessage: (message: string) => Promise<Hex>;

  // Transactions
  sendTransaction: (params: {
    to: Address;
    data?: Hex;
    value?: bigint;
  }) => Promise<Hex>;

  // Batch transactions (for smart wallets)
  sendBatchTransaction?: (
    calls: Array<{
      to: Address;
      data?: Hex;
      value?: bigint;
    }>,
  ) => Promise<Hex>;

  // EIP-7702 specific
  upgradeToDelegated?: () => Promise<void>;
}

export function useUnifiedWallet() {
  const { ready: privyReady, authenticated, user } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [walletInfo, setWalletInfo] = useState<UnifiedWalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [delegationInfo, setDelegationInfo] =
    useState<EIP7702DelegationInfo | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(),
      }),
    [],
  );

  // Determine active wallet and address
  const { activeWallet, activeAddress, activeClient } = useMemo(() => {
    // Priority: Privy embedded wallet > External wallets
    const embeddedWallet = privyWallets.find(
      (w) => w.walletClientType === 'privy',
    );

    if (embeddedWallet && authenticated) {
      return {
        activeWallet: embeddedWallet,
        activeAddress: embeddedWallet.address as Address,
        activeClient: null, // Privy handles signing
      };
    }

    if (wagmiAddress && isConnected && walletClient) {
      return {
        activeWallet: null,
        activeAddress: wagmiAddress,
        activeClient: walletClient,
      };
    }

    return {
      activeWallet: null,
      activeAddress: null,
      activeClient: null,
    };
  }, [privyWallets, authenticated, wagmiAddress, isConnected, walletClient]);

  // Detect wallet type and capabilities
  const detectWalletInfo = useCallback(
    async (address: Address): Promise<UnifiedWalletInfo> => {
      try {
        // Check for EIP-7702 delegation first
        const [hasActiveDelegation, code] = await Promise.all([
          eip7702Manager.hasActiveDelegation(address),
          publicClient.getBytecode({ address }),
        ]);

        let delegationInfo: EIP7702DelegationInfo | null = null;
        if (hasActiveDelegation) {
          delegationInfo = await eip7702Manager.getDelegationInfo(address);
        }

        const isSmartContract = !!code && code !== '0x';
        const isPrivyEmbedded =
          !!activeWallet && activeWallet.walletClientType === 'privy';

        // Determine wallet type
        let type: WalletType = 'unknown';
        let hasGasSponsorship = false;
        let hasSessionKeys = false;
        let hasBatchTransactions = false;
        let needsUpgrade = false;

        if (hasActiveDelegation) {
          type = 'eip7702_delegated';
          hasGasSponsorship = true;
          hasSessionKeys = true;
          hasBatchTransactions = true;
        } else if (isPrivyEmbedded) {
          type = 'privy_embedded';
          needsUpgrade = true; // Can be upgraded with EIP-7702
        } else if (isSmartContract) {
          // Check if it's a Coinbase Smart Wallet
          if (activeWallet?.walletClientType === 'coinbase_smart_wallet') {
            type = 'coinbase_smart';
            hasGasSponsorship = true;
            hasSessionKeys = true;
            hasBatchTransactions = true;
          } else {
            type = 'smart_contract';
            // May have these features, would need deeper inspection
          }
        } else {
          type = 'external_eoa';
          needsUpgrade = true; // Can be upgraded with EIP-7702
        }

        return {
          address,
          type,
          isSmartWallet: hasActiveDelegation || isSmartContract,
          hasGasSponsorship,
          hasSessionKeys,
          hasBatchTransactions,
          needsUpgrade,
          delegationInfo: delegationInfo || undefined,
        };
      } catch (error) {
        console.error('Error detecting wallet info:', error);

        // Fallback based on available information
        const isPrivyEmbedded =
          !!activeWallet && activeWallet.walletClientType === 'privy';

        return {
          address,
          type: isPrivyEmbedded ? 'privy_embedded' : 'external_eoa',
          isSmartWallet: false,
          hasGasSponsorship: false,
          hasSessionKeys: false,
          hasBatchTransactions: false,
          needsUpgrade: !isPrivyEmbedded, // Only offer upgrade to non-Privy wallets initially
        };
      }
    },
    [activeWallet, publicClient],
  );

  // Auto-detect wallet when address changes
  useEffect(() => {
    if (activeAddress && (privyReady || isConnected)) {
      setIsLoading(true);
      detectWalletInfo(activeAddress)
        .then((info) => {
          setWalletInfo(info);
          if (info.delegationInfo) {
            setDelegationInfo(info.delegationInfo);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setWalletInfo(null);
      setDelegationInfo(null);
    }
  }, [activeAddress, privyReady, isConnected, detectWalletInfo]);

  // Wallet actions
  const actions: UnifiedWalletActions = useMemo(() => {
    const signMessage = async (message: string): Promise<Hex> => {
      if (!activeAddress) throw new Error('No active wallet');

      if (activeWallet) {
        // Use Privy wallet signing
        if (typeof activeWallet.signMessage === 'function') {
          return await activeWallet.signMessage(message);
        }
        throw new Error('Privy wallet does not support message signing');
      }

      if (activeClient) {
        // Use wagmi wallet client
        return await activeClient.signMessage({
          account: activeAddress,
          message,
        });
      }

      throw new Error('No signing method available');
    };

    const sendTransaction = async (params: {
      to: Address;
      data?: Hex;
      value?: bigint;
    }): Promise<Hex> => {
      if (!activeAddress) throw new Error('No active wallet');

      // For EIP-7702 delegated wallets, use the manager
      if (walletInfo?.type === 'eip7702_delegated' && activeClient) {
        return await eip7702Manager.executeTransaction(
          activeClient,
          activeAddress,
          params.to,
          params.value || 0n,
          params.data || '0x',
        );
      }

      // For other wallets, use standard transaction
      if (activeClient) {
        return await activeClient.sendTransaction({
          account: activeAddress,
          to: params.to,
          data: params.data,
          value: params.value,
        });
      }

      throw new Error('No transaction method available');
    };

    const sendBatchTransaction = walletInfo?.hasBatchTransactions
      ? async (
          calls: Array<{
            to: Address;
            data?: Hex;
            value?: bigint;
          }>,
        ): Promise<Hex> => {
          if (!activeAddress || !activeClient)
            throw new Error('No active wallet');

          if (walletInfo?.type === 'eip7702_delegated') {
            const formattedCalls = calls.map((call) => ({
              to: call.to,
              value: call.value || 0n,
              data: call.data || ('0x' as Hex),
            }));

            return await eip7702Manager.executeBatchTransaction(
              activeClient,
              activeAddress,
              formattedCalls,
            );
          }

          throw new Error(
            'Batch transactions not supported for this wallet type',
          );
        }
      : undefined;

    const upgradeToDelegated =
      walletInfo?.needsUpgrade && activeClient
        ? async (): Promise<void> => {
            if (!activeAddress || !activeClient)
              throw new Error('External wallet required for EIP-7702 upgrade');

            // Generate authorization request
            const authRequest =
              await eip7702Manager.generateAuthorizationRequest(activeAddress);

            // Create message for signing
            const message =
              eip7702Manager.createAuthorizationMessage(authRequest);

            // Sign the message
            const signature = await signMessage(message);

            // Parse authorization
            const authorization =
              eip7702Manager.parseAuthorizationFromSignature(
                signature,
                authRequest,
              );

            // Submit delegation transaction
            await eip7702Manager.submitDelegation(
              activeClient,
              activeAddress,
              authorization,
            );

            // Refresh wallet info
            const updatedInfo = await detectWalletInfo(activeAddress);
            setWalletInfo(updatedInfo);
          }
        : undefined;

    return {
      signMessage,
      sendTransaction,
      sendBatchTransaction,
      upgradeToDelegated,
    };
  }, [activeAddress, activeWallet, activeClient, walletInfo, detectWalletInfo]);

  return {
    // State
    isReady: privyReady || isConnected,
    isConnected: !!activeAddress,
    isLoading,

    // Wallet info
    address: activeAddress,
    walletInfo,
    delegationInfo,

    // Actions
    ...actions,

    // Utils
    detectWalletInfo,
    refreshWalletInfo: () => {
      if (activeAddress) {
        return detectWalletInfo(activeAddress).then(setWalletInfo);
      }
    },
  };
}
