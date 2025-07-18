import {
  GelatoRelay,
  type SponsoredCallRequest,
} from '@gelatonetwork/relay-sdk';
import { type Address, encodeFunctionData, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';

export interface GelatoSmartWalletResult {
  success: boolean;
  agentAddress?: Address;
  agentKeyId?: string;
  taskId?: string;
  error?: string;
}

export interface GelatoExecutionResult {
  success: boolean;
  taskId?: string;
  txHash?: string;
  error?: string;
}

export class GelatoSmartWalletService {
  private static relay: GelatoRelay;

  static initialize(apiKey?: string) {
    if (!this.relay) {
      // Initialize with API key if provided, otherwise use default mode
      this.relay = new GelatoRelay(apiKey);
    }
  }

  /**
   * Create gasless agent key for DCA automation using Gelato Relay
   * This replaces ZeroDev session keys with Gelato's native gasless infrastructure
   */
  static async createGaslessAgentKey(
    userWallet: any, // Privy wallet instance
    smartWalletAddress: Address,
    userAddress: Address,
  ): Promise<GelatoSmartWalletResult> {
    try {
      console.log('🔑 Creating Gelato gasless agent key...');
      console.log('   User address:', userAddress);
      console.log('   Smart wallet:', smartWalletAddress);

      this.initialize();

      // Generate agent key for automation
      const agentPrivateKey = generatePrivateKey();
      const agentAccount = privateKeyToAccount(agentPrivateKey);
      console.log('✅ Agent key generated:', agentAccount.address);

      // Store the agent key on server for automation
      console.log('💾 Storing Gelato agent key on server...');
      const storeResponse = await fetch(
        `${window.location.origin}/api/store-gelato-agent-key`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress,
            smartWalletAddress,
            agentPrivateKey,
            agentAddress: agentAccount.address,
            provider: 'gelato',
          }),
        },
      );

      if (!storeResponse.ok) {
        const error = await storeResponse.json();
        throw new Error(`Failed to store Gelato agent key: ${error.error}`);
      }

      const storeResult = await storeResponse.json();

      console.log('🎉 Gelato gasless agent key created successfully!');
      console.log('   Agent key ID:', storeResult.agentKeyId);
      console.log('   Agent address:', agentAccount.address);
      console.log('   Gas sponsorship: ENABLED (Gelato Relay)');

      return {
        success: true,
        agentAddress: agentAccount.address,
        agentKeyId: storeResult.agentKeyId,
      };
    } catch (error) {
      console.error('❌ Gelato gasless agent key creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute gasless transaction using Gelato Relay
   * This replaces ZeroDev's sponsored transaction execution
   */
  static async executeGaslessTransaction(
    agentPrivateKey: `0x${string}`,
    smartWalletAddress: Address,
    target: Address,
    data: `0x${string}`,
    value = 0n,
  ): Promise<GelatoExecutionResult> {
    try {
      console.log('🚀 Executing gasless transaction via Gelato Relay...');
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Target:', target);
      console.log('   Value:', value.toString());

      this.initialize();

      const agentAccount = privateKeyToAccount(agentPrivateKey);

      // Create sponsored call request for Gelato Relay
      const request: SponsoredCallRequest = {
        chainId: base.id,
        target,
        data,
        user: smartWalletAddress, // Smart wallet that will execute the transaction
      };

      console.log('📡 Submitting to Gelato Relay for gas sponsorship...');

      // Submit sponsored transaction via Gelato Relay
      const response = await this.relay.sponsoredCall(
        request,
        process.env.NEXT_PUBLIC_GELATO_API_KEY!,
      );

      if (!response || !response.taskId) {
        throw new Error('Failed to submit transaction to Gelato Relay');
      }

      console.log('✅ Transaction submitted to Gelato Relay');
      console.log('   Task ID:', response.taskId);

      // Poll for execution status
      console.log('⏳ Waiting for transaction execution...');
      const taskStatus = await this.waitForTaskExecution(response.taskId);

      if (taskStatus.success && taskStatus.txHash) {
        console.log('🎉 Gasless transaction executed successfully!');
        console.log('   Transaction hash:', taskStatus.txHash);

        return {
          success: true,
          taskId: response.taskId,
          txHash: taskStatus.txHash,
        };
      } else {
        throw new Error(`Transaction execution failed: ${taskStatus.error}`);
      }
    } catch (error) {
      console.error('❌ Gasless transaction execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute DCA swap transaction using Gelato's gasless infrastructure
   */
  static async executeDCASwap(
    agentPrivateKey: `0x${string}`,
    smartWalletAddress: Address,
    swapData: `0x${string}`,
    amount: bigint,
  ): Promise<GelatoExecutionResult> {
    try {
      console.log('💱 Executing DCA swap via Gelato Relay...');
      console.log('   Amount:', (Number(amount) / 1e6).toFixed(2), 'USDC');

      // First approve the router to spend USDC
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, amount],
      });

      console.log('🔐 Step 1: Approving USDC spend...');
      const approveResult = await this.executeGaslessTransaction(
        agentPrivateKey,
        smartWalletAddress,
        TOKENS.USDC,
        approveData,
        0n,
      );

      if (!approveResult.success) {
        throw new Error(`Approval failed: ${approveResult.error}`);
      }

      console.log('✅ USDC approval completed');

      // Wait a moment for approval to settle
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Execute the swap
      console.log('💱 Step 2: Executing swap...');
      const swapResult = await this.executeGaslessTransaction(
        agentPrivateKey,
        smartWalletAddress,
        '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, // OpenOcean router
        swapData,
        0n,
      );

      if (!swapResult.success) {
        throw new Error(`Swap failed: ${swapResult.error}`);
      }

      console.log('🎉 DCA swap completed successfully!');
      console.log('   Swap transaction:', swapResult.txHash);

      return swapResult;
    } catch (error) {
      console.error('❌ DCA swap execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for Gelato task execution and return the result
   */
  private static async waitForTaskExecution(
    taskId: string,
    maxWaitTime = 60000, // 1 minute timeout
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.relay.getTaskStatus(taskId);

        if (status?.taskState) {
          switch (status.taskState) {
            case 'ExecSuccess':
              return {
                success: true,
                txHash: status.transactionHash,
              };

            case 'ExecReverted':
            case 'Cancelled':
              return {
                success: false,
                error: `Task ${status.taskState}: ${status.lastCheck?.message || 'Unknown error'}`,
              };

            case 'WaitingForConfirmation':
            case 'Pending':
              // Continue waiting
              console.log(`   Task status: ${status.taskState}`);
              break;

            default:
              console.log(`   Unknown task state: ${status.taskState}`);
          }
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn('   Error checking task status:', error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return {
      success: false,
      error: 'Task execution timeout',
    };
  }

  /**
   * Get estimated gas cost for a transaction (for monitoring purposes)
   */
  static async getEstimatedGasCost(
    target: Address,
    data: `0x${string}`,
    value = 0n,
  ): Promise<{ gasEstimate?: string; error?: string }> {
    try {
      // This would typically call Gelato's gas estimation API
      // For now, return a placeholder
      return {
        gasEstimate: '0.001 ETH (sponsored by Gelato)',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Gas estimation failed',
      };
    }
  }
}

/**
 * React hook for Gelato Smart Wallet functionality
 */
export function useGelatoSmartWallet() {
  const createGaslessAgentKey = async (
    userWallet: any,
    smartWalletAddress: Address,
    userAddress: Address,
  ): Promise<GelatoSmartWalletResult> => {
    return GelatoSmartWalletService.createGaslessAgentKey(
      userWallet,
      smartWalletAddress,
      userAddress,
    );
  };

  return {
    createGaslessAgentKey,
    executeGaslessTransaction:
      GelatoSmartWalletService.executeGaslessTransaction,
    executeDCASwap: GelatoSmartWalletService.executeDCASwap,
    getEstimatedGasCost: GelatoSmartWalletService.getEstimatedGasCost,
  };
}
