import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
} from 'viem';
import {
  generatePrivateKey,
  privateKeyToAccount,
} from 'viem/accounts';
import { base } from 'viem/chains';
import { NEXT_PUBLIC_URL } from '../config';
import { TOKENS } from '../utils/openOceanApi';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router on Base
const OPENOCEAN_ROUTER = '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface SimpleSmartWallet {
  address: Address;
  agentPrivateKey: Hex;
  agentAddress: Address;
  userWalletAddress: Address;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountOut?: string;
}

/**
 * Simplified DCA Service using KERNEL_V3_2 without complex permissions
 * 
 * This bypasses the permissions API issues by using the agent's key directly
 * as the smart wallet owner. While not as secure as the owner/agent model,
 * it allows testing the DCA flow with KERNEL_V3_2 and chain abstraction.
 * 
 * Security Note: In this model, the agent has full control of the smart wallet.
 * This is acceptable for testing but should be enhanced with permissions for production.
 */
export class SimpleDCAService {
  private publicClient;
  private paymasterClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });

    this.paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
      entryPoint: getEntryPoint('0.7'),
    });
  }

  /**
   * Create a simple smart wallet controlled by the agent
   * This is for testing purposes - bypasses the complex permissions system
   */
  async createSimpleSmartWallet(
    userWalletAddress: Address,
  ): Promise<SimpleSmartWallet> {
    try {
      console.log('🏠 Creating simple smart wallet for DCA testing...');

      // Agent generates their own private key and controls the smart wallet directly
      const agentPrivateKey = generatePrivateKey();
      const agentAccount = privateKeyToAccount(agentPrivateKey);
      
      console.log(`🤖 Agent address: ${agentAccount.address}`);

      // Create ECDSA validator for agent using KERNEL_V3_2
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: agentAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      // Create kernel account with KERNEL_V3_2 (agent as owner)
      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
      });

      console.log(`🏠 Smart wallet created: ${smartWallet.address}`);
      console.log('⚠️ Note: Agent has full control (simplified for testing)');

      return {
        address: smartWallet.address,
        agentPrivateKey,
        agentAddress: agentAccount.address,
        userWalletAddress,
      };
    } catch (error) {
      console.error('❌ Failed to create simple smart wallet:', error);
      throw error;
    }
  }

  /**
   * Execute DCA swap using the simple smart wallet
   */
  async executeDCASwap(
    wallet: SimpleSmartWallet,
    swapAmount: bigint,
  ): Promise<ExecutionResult> {
    const MINIMUM_SWAP_AMOUNT = 1000n; // $0.001 USD minimum

    if (swapAmount < MINIMUM_SWAP_AMOUNT) {
      console.log(
        `⏭️ Swap amount ${swapAmount.toString()} USDC wei is below minimum. Skipping.`,
      );
      return {
        success: true,
        txHash: 'skipped_small_amount',
        amountOut: '0',
        error: 'Amount too small - accumulating for batch execution',
      };
    }

    try {
      console.log('🚀 Executing DCA swap with simple smart wallet...');
      console.log(`🤖 Agent address: ${wallet.agentAddress}`);
      console.log(`🏠 Smart wallet: ${wallet.address}`);
      console.log(`💰 Swap amount: ${swapAmount.toString()} USDC wei`);

      const agentAccount = privateKeyToAccount(wallet.agentPrivateKey);

      // Create ECDSA validator for the agent
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: agentAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      // Create kernel account
      const kernelAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
        deployedAccountAddress: wallet.address,
      });

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // Get swap quote
      const swapQuote = await this.getOpenOceanSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        swapAmount,
        wallet.address,
        wallet.userWalletAddress,
      );

      if (!swapQuote.success) {
        return {
          success: false,
          error: `Failed to get swap quote: ${swapQuote.error}`,
        };
      }

      // Check USDC balance
      const currentBalance = await this.publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet.address],
      });

      console.log(`💰 Current USDC balance: ${(Number(currentBalance) / 1e6).toFixed(6)} USDC`);

      if (currentBalance < swapAmount) {
        return {
          success: false,
          error: `Insufficient USDC balance. Have: ${(Number(currentBalance) / 1e6).toFixed(6)} USDC, Need: ${(Number(swapAmount) / 1e6).toFixed(6)} USDC`,
        };
      }

      // Build transactions
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [OPENOCEAN_ROUTER, swapAmount],
      });

      const transactions = [
        // Transaction 1: Approve OpenOcean router
        {
          to: TOKENS.USDC,
          value: 0n,
          data: approveData,
        },
        // Transaction 2: Execute swap
        {
          to: swapQuote.transaction!.to,
          value: BigInt(swapQuote.transaction!.value || '0'),
          data: swapQuote.transaction!.data,
        },
        // Transaction 3: Transfer SPX to user wallet
        {
          to: TOKENS.SPX6900,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [wallet.userWalletAddress, BigInt(swapQuote.expectedOutput || '0')],
          }),
        },
      ];

      console.log('📝 Executing batched transactions:');
      console.log('  1. Approve USDC for OpenOcean router');
      console.log('  2. Execute USDC → SPX swap');
      console.log('  3. Transfer SPX to user wallet');

      // Execute batched transactions
      const txHash = await kernelClient.sendUserOperation({
        account: kernelAccount,
        calls: transactions.map((tx) => ({
          to: tx.to,
          value: tx.value || 0n,
          data: tx.data,
        })),
      });

      console.log('✅ DCA swap executed successfully!');
      console.log(`📍 Transaction hash: ${txHash}`);
      console.log(`📤 SPX tokens sent to: ${wallet.userWalletAddress}`);

      return {
        success: true,
        txHash,
        amountOut: swapQuote.expectedOutput,
      };
    } catch (error) {
      console.error('❌ DCA swap execution failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'DCA swap execution failed',
      };
    }
  }

  /**
   * Get USDC balance of smart wallet
   */
  async getUSDCBalance(walletAddress: Address): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    return balance;
  }

  /**
   * Get SPX balance of an address
   */
  async getSPXBalance(address: Address): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: TOKENS.SPX6900,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance;
  }

  /**
   * Get OpenOcean swap quote
   */
  private async getOpenOceanSwapQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress?: Address,
  ): Promise<{
    success: boolean;
    transaction?: {
      to: Address;
      data: Hex;
      value?: string;
    };
    expectedOutput?: string;
    error?: string;
  }> {
    try {
      const requestBody = {
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        takerAddress,
        receiverAddress: receiverAddress || takerAddress,
        slippagePercentage: 0.05,
        gasPrice: 'standard',
        complexityLevel: 0,
        disableEstimate: false,
        allowPartialFill: false,
        preferDirect: true,
        maxHops: 2,
      };

      const response = await fetch(`${NEXT_PUBLIC_URL}/api/openocean-swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || 'Failed to get swap quote',
        };
      }

      const data = await response.json();
      const expectedOutput = data.outAmount || data.buyAmount;

      return {
        success: true,
        transaction: {
          to: data.to,
          data: data.data,
          value: data.value,
        },
        expectedOutput,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get swap quote',
      };
    }
  }
}

// Export singleton instance
export const simpleDCAService = new SimpleDCAService();