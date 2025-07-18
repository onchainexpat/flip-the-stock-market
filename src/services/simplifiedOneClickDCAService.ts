'use client';

import type { Address, Hex } from 'viem';
import { SimplifiedZeroDevDCAService } from './simplifiedZeroDevDCAService';

export interface SimplifiedOneClickDCAParams {
  amount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: string;
  platformFeePercentage?: number;
}

export interface SimplifiedOneClickDCAResult {
  success: boolean;
  orderId?: string;
  smartWalletAddress?: Address;
  sessionKeyData?: string;
  txHash?: string;
  fundingInstructions?: {
    smartWalletAddress: string;
    requiredAmount: string;
    tokenAddress: string;
    network: string;
  };
  error?: string;
}

/**
 * Simplified One-Click DCA Service
 * Based on working ZeroDev examples with minimal complexity
 */
export class SimplifiedOneClickDCAService {
  /**
   * Execute complete one-click DCA setup using simplified ZeroDev approach
   * This follows the exact patterns from working examples with connected wallet
   */
  static async executeSimplifiedOneClickDCA(
    params: SimplifiedOneClickDCAParams,
    walletClient: any, // Connected wallet client from Wagmi/Privy
  ): Promise<SimplifiedOneClickDCAResult> {
    try {
      console.log('🚀 Starting simplified ZeroDev one-click DCA setup...');
      console.log('   Provider: ZeroDev (KERNEL_V3_1)');
      console.log('   Pattern: Based on 1-click-trading.ts example');

      const { amount, frequency, duration, platformFeePercentage = 0 } = params;

      // Step 1: Deploy smart wallet using connected wallet
      console.log('📦 Step 1: Deploying smart wallet...');
      const deployResult = await SimplifiedZeroDevDCAService.deploySmartWallet(
        walletClient,
      );

      if (!deployResult.success) {
        throw new Error(`Smart wallet deployment failed: ${deployResult.error}`);
      }

      console.log('✅ Smart wallet ready:', deployResult.smartWalletAddress);

      // Step 2: Create session key for automation
      console.log('🔑 Step 2: Creating DCA session key...');
      const sessionResult = await SimplifiedZeroDevDCAService.createDCASessionKey(
        walletClient,
        deployResult.smartWalletAddress,
      );

      if (!sessionResult.success) {
        throw new Error(`Session key creation failed: ${sessionResult.error}`);
      }

      console.log('✅ Session key created and serialized');

      // Step 3: Create DCA order in database
      console.log('📋 Step 3: Creating DCA order in database...');
      const response = await fetch(`${window.location.origin}/api/dca-orders-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: String(walletClient.account.address), // Ensure string
          smartWalletAddress: String(deployResult.smartWalletAddress), // Ensure string
          sessionKeyApproval: String(sessionResult.sessionKeyData), // Ensure string
          totalAmount: String(amount), // Ensure string
          frequency: String(frequency),
          duration: String(duration),
          platformFeePercentage: Number(platformFeePercentage),
          provider: 'zerodev-simplified',
        }),
      });

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

      console.log('🎉 Simplified ZeroDev one-click DCA setup complete!');
      console.log('   Order ID:', result.order.id);
      console.log('   Smart wallet:', result.order.smartWalletAddress);
      console.log('   Session key: CREATED');
      console.log('   Gasless execution: ENABLED (ZeroDev)');

      return {
        success: true,
        orderId: result.order.id,
        smartWalletAddress: deployResult.smartWalletAddress,
        sessionKeyData: sessionResult.sessionKeyData,
        txHash: result.txHash, // From immediate execution
        fundingInstructions: result.fundingInstructions,
      };
    } catch (error) {
      console.error('❌ Simplified ZeroDev one-click DCA failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * React hook for simplified ZeroDev one-click DCA functionality
 */
export function useSimplifiedOneClickDCA() {
  const executeSimplifiedOneClickDCA = async (
    params: SimplifiedOneClickDCAParams,
    walletClient: any | undefined,
  ): Promise<SimplifiedOneClickDCAResult> => {
    if (!walletClient) {
      return {
        success: false,
        error: 'Wallet client required - please connect your wallet',
      };
    }

    return SimplifiedOneClickDCAService.executeSimplifiedOneClickDCA(
      params,
      walletClient,
    );
  };

  return {
    executeSimplifiedOneClickDCA,
  };
}