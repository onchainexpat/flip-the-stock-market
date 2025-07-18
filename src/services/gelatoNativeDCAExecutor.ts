import type { Address } from 'viem';
import { openOceanApi, TOKENS } from '../utils/openOceanApi';
import { GelatoNativeSmartWalletService } from './gelatoNativeSmartWalletService';
import { serverAgentKeyService } from './serverAgentKeyService';

export interface GelatoNativeDCAResult {
  success: boolean;
  userOpHash?: string;
  txHash?: string;
  amountIn?: string;
  amountOut?: string;
  error?: string;
}

/**
 * Gelato Native DCA Executor
 * Much simpler than the previous Gelato + ZeroDev hybrid approach
 * Uses Gelato's native smart wallet infrastructure with EIP-7702
 */
export class GelatoNativeDCAExecutor {
  /**
   * Execute a DCA order using Gelato's native gasless infrastructure
   * This is dramatically simpler than the ZeroDev approach
   */
  static async executeDCAOrder(
    agentKeyId: string,
    smartWalletAddress: Address, // Still needed for interface compatibility
    amountUSDC: bigint,
    destinationAddress: Address,
  ): Promise<GelatoNativeDCAResult> {
    try {
      console.log('🚀 Executing DCA order via Gelato Native...');
      console.log('   Agent key ID:', agentKeyId);
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Amount:', (Number(amountUSDC) / 1e6).toFixed(2), 'USDC');
      console.log('   Destination:', destinationAddress);

      // Initialize Gelato Native service with API key
      const gelatoApiKey = process.env.GELATO_SPONSOR_API_KEY;
      console.log('🔧 Initializing Gelato service with API key...');
      console.log('   API key available:', !!gelatoApiKey);
      GelatoNativeSmartWalletService.initialize(gelatoApiKey);

      // Step 1: Verify agent key
      console.log('🔑 Verifying Gelato native agent key...');
      const agentKey = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKey) {
        throw new Error(`Agent key not found: ${agentKeyId}`);
      }

      if (agentKey.provider !== 'gelato-native') {
        throw new Error(`Agent key is not Gelato native: ${agentKey.provider}`);
      }

      console.log('✅ Gelato native agent key verified');
      console.log('   Agent address:', agentKey.agentAddress);
      console.log('   Smart wallet = EOA:', smartWalletAddress);

      // Step 2: Get swap data from OpenOcean
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

      // Step 3: Execute gasless DCA swap via Gelato Native
      console.log('🌐 Executing gasless swap via Gelato Native...');
      console.log('   Batch: USDC approval + swap execution');
      console.log('   Gas sponsorship: Gelato Native (EIP-7702)');

      const executionResult = await GelatoNativeSmartWalletService.executeDCASwap(
        agentKeyId,
        swapData.data as `0x${string}`,
        swapData.to as Address,
        amountUSDC,
      );

      if (!executionResult.success) {
        throw new Error(`Gasless execution failed: ${executionResult.error}`);
      }

      console.log('🎉 Gelato Native DCA order executed successfully!');
      console.log('   UserOp hash:', executionResult.userOpHash);
      console.log('   Transaction hash:', executionResult.txHash);
      console.log('   Gas cost: FREE (Gelato Native sponsorship)');

      // Step 4: Calculate amounts for reporting
      const amountInFormatted = (Number(amountUSDC) / 1e6).toFixed(6);

      return {
        success: true,
        userOpHash: executionResult.userOpHash,
        txHash: executionResult.txHash,
        amountIn: amountInFormatted,
        amountOut: 'Successfully swapped to SPX6900',
      };
    } catch (error) {
      console.error('❌ Gelato Native DCA execution failed:', error);
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
   * Get current gas estimation (should be 0 with Gelato sponsorship)
   */
  static async getGasEstimate(): Promise<{
    gasEstimate: string;
    gasCost: string;
    sponsored: boolean;
  }> {
    const estimation = await GelatoNativeSmartWalletService.getEstimatedGasCost();
    
    return {
      gasEstimate: '0',
      gasCost: estimation.gasCost,
      sponsored: estimation.sponsored,
    };
  }
}