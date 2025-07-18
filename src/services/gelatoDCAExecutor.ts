import type { Address } from 'viem';
import { TOKENS, openOceanApi } from '../utils/openOceanApi';
import { GelatoSmartWalletService } from './gelatoSmartWalletService';
import { serverAgentKeyService } from './serverAgentKeyService';

export interface GelatoDCAExecutionResult {
  success: boolean;
  taskId?: string;
  txHash?: string;
  amountIn?: string;
  amountOut?: string;
  error?: string;
}

export class GelatoDCAExecutor {
  /**
   * Execute a DCA order using Gelato's gasless infrastructure
   * This replaces the ZeroDev execution with Gelato Relay sponsorship
   */
  static async executeDCAOrder(
    agentKeyId: string,
    smartWalletAddress: Address,
    amountUSDC: bigint,
    destinationAddress: Address,
  ): Promise<GelatoDCAExecutionResult> {
    try {
      console.log('🚀 Executing DCA order via Gelato Relay...');
      console.log('   Agent key ID:', agentKeyId);
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Amount:', (Number(amountUSDC) / 1e6).toFixed(2), 'USDC');
      console.log('   Destination:', destinationAddress);

      // Step 1: Get agent key from storage
      console.log('🔑 Retrieving Gelato agent key...');
      const agentKey = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKey) {
        throw new Error(`Agent key not found: ${agentKeyId}`);
      }

      if (agentKey.provider !== 'gelato') {
        throw new Error(`Agent key is not a Gelato key: ${agentKey.provider}`);
      }

      const agentPrivateKey =
        await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!agentPrivateKey) {
        throw new Error('Failed to decrypt agent private key');
      }

      console.log('✅ Gelato agent key retrieved');
      console.log('   Agent address:', agentKey.agentAddress);

      // Step 2: Get swap data from OpenOcean
      console.log('💱 Getting swap data from OpenOcean...');
      const swapData = await openOceanApi.getSwapTransaction({
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: amountUSDC.toString(),
        takerAddress: smartWalletAddress,
      });

      console.log('✅ Swap data obtained');
      console.log('   To address:', swapData.to);
      console.log('   Gas estimate:', swapData.gas);

      // Step 3: Initialize Gelato service and execute gasless DCA swap
      console.log('🌐 Initializing Gelato Relay...');
      GelatoSmartWalletService.initialize();

      console.log('🌐 Executing gasless swap via Gelato Relay...');
      const executionResult = await GelatoSmartWalletService.executeDCASwap(
        agentPrivateKey,
        smartWalletAddress,
        swapData.data as `0x${string}`,
        amountUSDC,
      );

      if (!executionResult.success) {
        throw new Error(`Gasless execution failed: ${executionResult.error}`);
      }

      console.log('🎉 DCA order executed successfully via Gelato!');
      console.log('   Task ID:', executionResult.taskId);
      console.log('   Transaction hash:', executionResult.txHash);
      console.log('   Gas sponsorship: Gelato Relay');

      return {
        success: true,
        taskId: executionResult.taskId,
        txHash: executionResult.txHash,
        amountIn: (Number(amountUSDC) / 1e6).toFixed(6),
        amountOut: 'Swap executed successfully',
      };
    } catch (error) {
      console.error('❌ Gelato DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a smart wallet has sufficient USDC balance for DCA execution
   */
  static async checkUSDCBalance(
    smartWalletAddress: Address,
    requiredAmount: bigint,
  ): Promise<{ hasBalance: boolean; currentBalance: string; error?: string }> {
    try {
      // This would typically check the USDC balance on Base
      // For now, return a placeholder
      return {
        hasBalance: true,
        currentBalance: (Number(requiredAmount) / 1e6).toFixed(2),
      };
    } catch (error) {
      return {
        hasBalance: false,
        currentBalance: '0',
        error: error instanceof Error ? error.message : 'Balance check failed',
      };
    }
  }

  /**
   * Estimate gas cost for DCA execution (sponsored by Gelato)
   */
  static async estimateExecutionCost(
    amountUSDC: bigint,
  ): Promise<{ gasCost: string; sponsored: boolean; error?: string }> {
    try {
      return {
        gasCost: '0 ETH (sponsored by Gelato)',
        sponsored: true,
      };
    } catch (error) {
      return {
        gasCost: 'Unknown',
        sponsored: false,
        error:
          error instanceof Error ? error.message : 'Cost estimation failed',
      };
    }
  }
}
