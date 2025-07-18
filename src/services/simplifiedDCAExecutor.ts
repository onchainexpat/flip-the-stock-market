import type { Address } from 'viem';
import { openOceanApi, TOKENS } from '../utils/openOceanApi';
import { SimplifiedZeroDevDCAService } from './simplifiedZeroDevDCAService';
import { serverAgentKeyService } from './serverAgentKeyService';

export interface SimplifiedDCAResult {
  success: boolean;
  userOpHash?: string;
  txHash?: string;
  amountIn?: string;
  amountOut?: string;
  error?: string;
}

/**
 * Simplified DCA Executor
 * Uses the working ZeroDev patterns from examples
 */
export class SimplifiedDCAExecutor {
  /**
   * Execute a DCA order using simplified ZeroDev session keys
   * Following the exact patterns that work in examples
   */
  static async executeDCAOrder(
    sessionKeyData: string,
    smartWalletAddress: Address,
    amountUSDC: bigint,
    destinationAddress: Address,
  ): Promise<SimplifiedDCAResult> {
    try {
      console.log('🚀 Executing DCA order via simplified ZeroDev...');
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Amount:', (Number(amountUSDC) / 1e6).toFixed(2), 'USDC');
      console.log('   Destination:', destinationAddress);
      console.log('   Session key length:', sessionKeyData.length);

      // Step 1: Get swap data from OpenOcean
      console.log('💱 Getting swap data from OpenOcean...');
      const swapData = await openOceanApi.getSwapTransaction({
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: amountUSDC.toString(),
        takerAddress: smartWalletAddress, // Smart wallet will execute the swap
      });

      console.log('✅ Swap data obtained');
      console.log('   To address:', swapData.to);
      console.log('   Gas estimate:', swapData.gas);
      console.log('   Value:', swapData.value);

      // Step 2: Execute gasless DCA swap via simplified ZeroDev
      console.log('🌐 Executing gasless swap via simplified ZeroDev...');
      console.log('   Using session key for automation');
      console.log('   Gas sponsorship: ZeroDev paymaster');

      const executionResult = await SimplifiedZeroDevDCAService.executeDCASwap(
        sessionKeyData,
        swapData.data as `0x${string}`,
        swapData.to as Address,
        amountUSDC,
      );

      if (!executionResult.success) {
        throw new Error(`Gasless execution failed: ${executionResult.error}`);
      }

      console.log('🎉 Simplified ZeroDev DCA order executed successfully!');
      console.log('   Transaction hash:', executionResult.txHash);
      console.log('   Gas cost: FREE (ZeroDev sponsorship)');

      // Step 3: Calculate amounts for reporting
      const amountInFormatted = (Number(amountUSDC) / 1e6).toFixed(6);

      return {
        success: true,
        userOpHash: executionResult.txHash, // Using tx hash as userOp hash
        txHash: executionResult.txHash,
        amountIn: amountInFormatted,
        amountOut: 'Successfully swapped to SPX6900',
      };
    } catch (error) {
      console.error('❌ Simplified ZeroDev DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if smart wallet has sufficient USDC balance for execution
   */
  static async checkBalance(
    smartWalletAddress: Address,
    requiredAmount: bigint,
  ): Promise<{ sufficient: boolean; currentBalance: bigint }> {
    try {
      const { createPublicClient, http } = await import('viem');
      const { erc20Abi } = await import('viem');
      const { base } = await import('viem/chains');

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const currentBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartWalletAddress],
      }) as bigint;

      return {
        sufficient: currentBalance >= requiredAmount,
        currentBalance,
      };
    } catch (error) {
      console.error('❌ Failed to check balance:', error);
      return {
        sufficient: false,
        currentBalance: 0n,
      };
    }
  }

  /**
   * Get current gas estimation (should be 0 with ZeroDev sponsorship)
   */
  static async getGasEstimate(): Promise<{
    gasEstimate: string;
    gasCost: string;
    sponsored: boolean;
  }> {
    return {
      gasEstimate: '0',
      gasCost: '0',
      sponsored: true, // ZeroDev paymaster handles sponsorship
    };
  }
}