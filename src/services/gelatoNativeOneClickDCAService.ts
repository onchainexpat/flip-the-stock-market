'use client';

import type { Address } from 'viem';
import { GelatoNativeSmartWalletService } from './gelatoNativeSmartWalletService';

export interface GelatoNativeOneClickDCAParams {
  amount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: string;
  platformFeePercentage?: number;
}

export interface GelatoNativeOneClickDCAResult {
  success: boolean;
  orderId?: string;
  smartWalletAddress?: Address;
  txHash?: string;
  error?: string;
}

export class GelatoNativeOneClickDCAService {
  /**
   * Execute complete one-click DCA setup using Gelato Native
   * This is dramatically simpler than ZeroDev approach:
   * - No complex session keys
   * - No separate smart wallet deployment  
   * - EOA becomes smart wallet (EIP-7702)
   * - Native gas sponsorship
   */
  static async executeGelatoNativeOneClickDCA(
    params: GelatoNativeOneClickDCAParams,
    userWalletAddress: Address,
    wallet: any, // Privy wallet instance
  ): Promise<GelatoNativeOneClickDCAResult> {
    try {
      console.log('🚀 Starting Gelato Native one-click DCA setup...');
      console.log('   Provider: Gelato Native (EIP-7702)');
      console.log('   User address:', userWalletAddress);

      const { amount, frequency, duration, platformFeePercentage = 0 } = params;

      // Step 1: Initialize Gelato Native service (client-side, no API key needed)
      console.log('📦 Initializing Gelato Native service...');
      console.log('   Note: Server will handle API key and gasless execution');
      GelatoNativeSmartWalletService.initialize();

      // Step 2: Handle EIP-7702 authorization (client-side only)
      console.log('📝 Setting up EIP-7702 smart wallet authorization...');
      
      if (wallet) {
        try {
          // Check if user's wallet supports EIP-7702
          if (typeof wallet.signAuthorization === 'function') {
            console.log('✅ Wallet supports EIP-7702, requesting authorization...');
            
            // Smart account implementation address (Gelato's example)
            const accountImplementation = "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9";
            
            const authorization = await wallet.signAuthorization({
              contractAddress: accountImplementation,
              executor: "self",
            });
            
            console.log('✅ EIP-7702 authorization signed');
            
            // Submit authorization transaction
            const authTxHash = await wallet.sendTransaction({
              authorizationList: [authorization],
              data: "0x",
              to: userWalletAddress,
            });
            
            console.log('✅ EIP-7702 authorization submitted:', authTxHash);
            
            // Wait for transaction confirmation
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } else {
            console.log('⚠️ Wallet does not support EIP-7702, proceeding without authorization');
          }
        } catch (authError) {
          console.error('❌ EIP-7702 authorization failed:', authError);
          console.log('   Proceeding without authorization - transactions may fail');
        }
      }

      // Step 3: Create DCA order with Gelato Native infrastructure
      console.log('📋 Creating DCA order with Gelato Native automation...');

      const response = await fetch(
        `${window.location.origin}/api/dca-orders-gelato-native`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: userWalletAddress,
            totalAmount: amount,
            frequency,
            duration,
            platformFeePercentage,
          }),
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to create DCA order';
        try {
          const errorData = await response.text();
          console.error('DCA order creation failed:', errorData);
          const error = JSON.parse(errorData);
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      console.log('🎉 Gelato Native one-click DCA setup complete!');
      console.log('   Order ID:', result.order.id);
      console.log('   Smart wallet:', result.order.smartWalletAddress);
      console.log('   EOA = Smart Wallet:', result.order.eip7702);
      console.log('   Gasless execution: ENABLED');

      return {
        success: true,
        orderId: result.order.id,
        smartWalletAddress: result.order.smartWalletAddress,
        txHash: result.txHash, // From immediate execution
      };
    } catch (error) {
      console.error('❌ Gelato Native one-click DCA failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * React hook for Gelato Native one-click DCA functionality
 * Much simpler than the ZeroDev version
 */
export function useGelatoNativeOneClickDCA() {
  const executeGelatoNativeOneClickDCA = async (
    params: GelatoNativeOneClickDCAParams,
    userAddress: Address | undefined,
    wallet: any | undefined
  ): Promise<GelatoNativeOneClickDCAResult> => {
    if (!userAddress || !wallet) {
      return {
        success: false,
        error: 'Wallet not connected',
      };
    }

    return GelatoNativeOneClickDCAService.executeGelatoNativeOneClickDCA(
      params,
      userAddress,
      wallet
    );
  };

  return {
    executeGelatoNativeOneClickDCA,
  };
}