'use client';

import { ethers } from 'ethers';
import { useCallback, useMemo } from 'react';
import { useEthersProvider } from '../lib/ethers';
import {
  type OpenOceanDCAOrder,
  type OpenOceanDCAOrderParams,
  OpenOceanDCAService,
} from '../services/openOceanDCAService';
import { useUnifiedSmartWallet } from './useUnifiedSmartWallet';

export type DCAProviderType = 'openocean' | 'smart_wallet';

export interface UnifiedDCACapabilities {
  supportsGasSponsorship: boolean;
  supportsSessionKeys: boolean;
  supportsAutomatedExecution: boolean;
  requiresUserGasPayment: boolean;
  minimumOrderAmount: number; // in USD
  minimumInterval: number; // in seconds
}

export interface DCAProviderRecommendation {
  recommended: DCAProviderType;
  reason: string;
  capabilities: Record<DCAProviderType, UnifiedDCACapabilities>;
}

/**
 * Hook for managing OpenOcean DCA provider integration
 * Provides unified access to OpenOcean DCA service with proper provider selection
 */
export function useOpenOceanDCAProvider() {
  const { activeWallet, walletType, isEmbedded } = useUnifiedSmartWallet();
  const ethersProvider = useEthersProvider({ chainId: 8453 });

  // Initialize OpenOcean DCA service
  const openOceanService = useMemo(() => new OpenOceanDCAService(), []);

  /**
   * Get the appropriate provider for OpenOcean DCA
   */
  const getOpenOceanProvider =
    useCallback(async (): Promise<ethers.BrowserProvider | null> => {
      try {
        // For OpenOcean DCA, we prefer external wallet providers
        if (
          activeWallet &&
          (walletType === 'external_wallet' || walletType === 'zerodev_smart')
        ) {
          const externalProvider = await activeWallet.getEthereumProvider();
          if (externalProvider) {
            return new ethers.BrowserProvider(externalProvider);
          }
        }

        // Fallback to ethers provider from wagmi
        return ethersProvider;
      } catch (error) {
        console.error('Error getting OpenOcean provider:', error);
        return ethersProvider;
      }
    }, [activeWallet, walletType, ethersProvider]);

  /**
   * Get DCA provider capabilities for comparison
   */
  const getDCACapabilities = useCallback((): Record<
    DCAProviderType,
    UnifiedDCACapabilities
  > => {
    return {
      openocean: {
        supportsGasSponsorship: false,
        supportsSessionKeys: false,
        supportsAutomatedExecution: true, // OpenOcean handles execution
        requiresUserGasPayment: true,
        minimumOrderAmount: 5, // $5 USD for Base
        minimumInterval: 60, // 60 seconds
      },
      smart_wallet: {
        supportsGasSponsorship: true,
        supportsSessionKeys: true,
        supportsAutomatedExecution: true,
        requiresUserGasPayment: false,
        minimumOrderAmount: 1, // No minimum for smart wallet
        minimumInterval: 3600, // 1 hour for current implementation
      },
    };
  }, []);

  /**
   * Get recommended DCA provider based on wallet type and capabilities
   */
  const getRecommendedProvider = useCallback((): DCAProviderRecommendation => {
    const capabilities = getDCACapabilities();

    // For embedded wallets, smart wallet DCA is better (gas sponsorship)
    if (
      isEmbedded ||
      walletType === 'embedded_privy' ||
      walletType === 'coinbase_smart'
    ) {
      return {
        recommended: 'smart_wallet',
        reason: 'Gas-free execution with embedded wallet',
        capabilities,
      };
    }

    // For external wallets, OpenOcean DCA is simpler (no smart wallet deployment needed)
    if (walletType === 'external_wallet') {
      return {
        recommended: 'openocean',
        reason: 'Simplified setup without smart wallet deployment',
        capabilities,
      };
    }

    // For ZeroDev smart wallets, both are viable - default to OpenOcean for simplicity
    return {
      recommended: 'openocean',
      reason: 'Simplified order management with OpenOcean infrastructure',
      capabilities,
    };
  }, [walletType, isEmbedded, getDCACapabilities]);

  /**
   * Create OpenOcean DCA order with proper provider
   */
  const createOpenOceanOrder = useCallback(
    async (params: OpenOceanDCAOrderParams): Promise<OpenOceanDCAOrder> => {
      const provider = await getOpenOceanProvider();
      if (!provider) {
        throw new Error('No suitable provider available for OpenOcean DCA');
      }

      // Update params to use the resolved provider
      const enhancedParams = {
        ...params,
        provider,
      };

      // Validate parameters
      const validation = openOceanService.validateOrderParams(enhancedParams);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      return openOceanService.createSPXDCAOrder(enhancedParams);
    },
    [getOpenOceanProvider, openOceanService],
  );

  /**
   * Cancel OpenOcean DCA order
   */
  const cancelOpenOceanOrder = useCallback(
    async (orderHash: string, orderData?: any) => {
      const provider = await getOpenOceanProvider();
      if (!provider) {
        throw new Error('No suitable provider available for OpenOcean DCA');
      }

      return openOceanService.cancelOrder(provider, orderHash, orderData);
    },
    [getOpenOceanProvider, openOceanService],
  );

  /**
   * Get orders by current wallet address
   */
  const getMyOrders = useCallback(async () => {
    if (!activeWallet) return [];

    const address = activeWallet.address;
    return openOceanService.getOrdersByAddress(address);
  }, [activeWallet, openOceanService]);

  /**
   * Get order status by hash
   */
  const getOrderStatus = useCallback(
    async (orderHash: string) => {
      return openOceanService.getOrderStatus(orderHash);
    },
    [openOceanService],
  );

  /**
   * Check if OpenOcean DCA is supported for current wallet
   */
  const isSupported = useMemo(() => {
    return !!(activeWallet && walletType !== 'unsupported');
  }, [activeWallet, walletType]);

  /**
   * Get user-friendly wallet status
   */
  const getWalletStatus = useCallback(() => {
    if (!activeWallet) return 'No wallet connected';

    const statusMap = {
      zerodev_smart: 'Smart Wallet (ZeroDev)',
      coinbase_smart: 'Coinbase Smart Wallet',
      embedded_privy: 'Embedded Wallet',
      external_wallet: 'External Wallet',
    };

    return statusMap[walletType] || 'Unknown Wallet';
  }, [activeWallet, walletType]);

  return {
    // Service methods
    createOpenOceanOrder,
    cancelOpenOceanOrder,
    getMyOrders,
    getOrderStatus,

    // Provider information
    isSupported,
    walletType,
    walletStatus: getWalletStatus(),

    // Capabilities and recommendations
    getRecommendedProvider,
    getDCACapabilities,

    // Direct service access for advanced use cases
    openOceanService,
    getOpenOceanProvider,
  };
}

/**
 * Hook for unified DCA provider selection
 * Helps users choose between OpenOcean DCA and Smart Wallet DCA
 */
export function useUnifiedDCAProvider() {
  const openOceanDCA = useOpenOceanDCAProvider();
  const recommendation = openOceanDCA.getRecommendedProvider();

  return {
    ...openOceanDCA,
    recommendation,

    // Unified interface methods
    createDCAOrder: async (providerType: DCAProviderType, params: any) => {
      if (providerType === 'openocean') {
        return openOceanDCA.createOpenOceanOrder(params);
      } else {
        // This would integrate with the existing smart wallet DCA service
        throw new Error(
          'Smart wallet DCA integration not yet implemented in unified interface',
        );
      }
    },

    cancelDCAOrder: async (
      providerType: DCAProviderType,
      orderHash: string,
      orderData?: any,
    ) => {
      if (providerType === 'openocean') {
        return openOceanDCA.cancelOpenOceanOrder(orderHash, orderData);
      } else {
        // This would integrate with the existing smart wallet DCA service
        throw new Error(
          'Smart wallet DCA cancellation not yet implemented in unified interface',
        );
      }
    },
  };
}
