'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  parseEther,
  parseUnits,
} from 'viem';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';
import {
  createBasePublicClient,
  createZeroDevKernelAccount,
  createZeroDevKernelClient,
} from '../utils/zerodev';
import { GelatoSmartWalletService } from './gelatoSmartWalletService';

export interface GelatoOneClickDCAParams {
  amount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: string;
  platformFeePercentage?: number;
}

export interface GelatoOneClickDCAResult {
  success: boolean;
  orderId?: string;
  smartWalletAddress?: Address;
  txHash?: string;
  error?: string;
}

export class GelatoOneClickDCAService {
  /**
   * Execute complete one-click DCA setup using Gelato's gasless infrastructure
   * This handles: smart wallet deployment + USDC transfer + approvals + DCA creation
   */
  static async executeGelatoOneClickDCA(
    params: GelatoOneClickDCAParams,
    userWalletAddress: Address,
    wallet: any, // Privy wallet instance
  ): Promise<GelatoOneClickDCAResult> {
    try {
      console.log('🚀 Starting Gelato one-click DCA setup...');

      const { amount, frequency, duration, platformFeePercentage = 0 } = params;
      const totalAmountWei = parseUnits(amount, 6); // USDC has 6 decimals

      // Step 1: Deploy smart wallet if needed (keeping ZeroDev for now - can be migrated later)
      console.log('📦 Setting up smart wallet...');
      const publicClient = createBasePublicClient();

      const kernelAccount = await createZeroDevKernelAccount(
        publicClient,
        wallet,
        base,
      );

      const kernelClient = await createZeroDevKernelClient(kernelAccount, base);
      console.log('✅ Smart wallet ready:', kernelAccount.address);

      // Step 2: Create Gelato gasless agent key for automation
      console.log('🔑 Creating Gelato gasless agent key...');

      let agentKeyResult = null;
      let agentKeyId = null;

      try {
        agentKeyResult = await GelatoSmartWalletService.createGaslessAgentKey(
          wallet,
          kernelAccount.address,
          userWalletAddress,
        );

        if (agentKeyResult.success) {
          agentKeyId = agentKeyResult.agentKeyId;
          console.log('✅ Gelato gasless agent key created successfully!');
          console.log('   Agent key ID:', agentKeyId);
          console.log('   Agent address:', agentKeyResult.agentAddress);
          console.log('   Gas sponsorship: ENABLED (Gelato Relay)');
        } else {
          console.error(
            '❌ Gelato agent key creation failed:',
            agentKeyResult.error,
          );
          throw new Error(`Agent key creation failed: ${agentKeyResult.error}`);
        }
      } catch (error) {
        console.error('❌ Gelato agent key creation failed:', error);
        throw new Error(
          `Agent key creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Step 3: Gas sponsorship enabled - no ETH funding needed
      console.log('✅ Gas sponsorship enabled via Gelato Relay');
      console.log('   Transactions will be sponsored by Gelato infrastructure');

      // Step 4: Create batched transaction for USDC transfer + approvals
      console.log('💰 Preparing batched transaction...');

      // Encode USDC transfer from user wallet to smart wallet
      const transferCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [kernelAccount.address, totalAmountWei],
      });

      // Encode USDC approval for OpenOcean router
      const approveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64', totalAmountWei],
      });

      // Step 5: Execute the batched transaction via user's wallet
      console.log('🔄 Requesting user signature for batched transaction...');

      // Get ethereum provider from wallet
      const provider = await wallet.getEthereumProvider();

      // Transfer USDC to smart wallet
      const transferTxHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: userWalletAddress,
            to: TOKENS.USDC,
            data: transferCalldata,
          },
        ],
      });

      console.log('✅ USDC transferred to smart wallet:', transferTxHash);

      // Step 6: Set up approvals on the smart wallet (gas-sponsored via ZeroDev for now)
      console.log('🔐 Setting up smart wallet approvals...');

      const approveTxHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        data: approveCalldata,
        value: parseEther('0'),
      });

      console.log('✅ Smart wallet approvals set:', approveTxHash);

      // Step 7: Create DCA order server-side with Gelato agent key
      console.log('📋 Creating DCA order with Gelato automation...');

      const response = await fetch(
        `${window.location.origin}/api/dca-orders-gelato`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: userWalletAddress,
            smartWalletAddress: kernelAccount.address,
            totalAmount: amount,
            frequency,
            duration,
            platformFeePercentage,
            agentKeyId: agentKeyId, // Use Gelato agent key
            provider: 'gelato',
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

      console.log('🎉 Gelato one-click DCA setup complete!');
      console.log('   Order ID:', result.order.id);
      console.log('   Smart wallet:', kernelAccount.address);
      console.log('   Gasless execution: ENABLED');

      return {
        success: true,
        orderId: result.order.id,
        smartWalletAddress: kernelAccount.address,
        txHash: transferTxHash,
      };
    } catch (error) {
      console.error('❌ Gelato one-click DCA failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * React hook for Gelato one-click DCA functionality
 */
export function useGelatoOneClickDCA() {
  // Remove the direct use of Privy hooks here since they need to be inside PrivyProvider
  // Instead, accept user and wallet as parameters to executeGelatoOneClickDCA
  
  const executeGelatoOneClickDCA = async (
    params: GelatoOneClickDCAParams,
    userAddress: Address | undefined,
    wallet: any | undefined
  ): Promise<GelatoOneClickDCAResult> => {
    if (!userAddress || !wallet) {
      return {
        success: false,
        error: 'Wallet not connected',
      };
    }

    return GelatoOneClickDCAService.executeGelatoOneClickDCA(
      params,
      userAddress,
      wallet
    );
  };

  return {
    executeGelatoOneClickDCA,
  };
}
