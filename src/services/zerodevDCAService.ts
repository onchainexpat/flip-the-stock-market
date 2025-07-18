import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface DCAAgentConfig {
  privateKey: Hex;
  smartWalletAddress: Address;
  userWalletAddress: Address;
}

export interface DCAExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  swapAmount?: string;
  spxReceived?: string;
  gasSponsored?: boolean;
  transactions?: {
    approve?: string;
    swap?: string;
    transfer?: string;
  };
}

export interface SwapQuoteResult {
  success: boolean;
  transaction?: {
    to: Address;
    data: Hex;
    value: string;
  };
  expectedOutput?: string;
  error?: string;
}

export class ZeroDevDCAService {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });
  }

  /**
   * Generate a new agent private key
   */
  generateAgentPrivateKey(): Hex {
    return generatePrivateKey();
  }

  /**
   * Create a new smart wallet for DCA operations
   */
  async createSmartWallet(agentPrivateKey: Hex): Promise<{
    smartWalletAddress: Address;
    agentAddress: Address;
  }> {
    try {
      const agentAccount = privateKeyToAccount(agentPrivateKey);

      // Create ECDSA validator
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: agentAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      // Create kernel account
      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
      });

      return {
        smartWalletAddress: smartWallet.address,
        agentAddress: agentAccount.address,
      };
    } catch (error) {
      throw new Error(`Failed to create smart wallet: ${error}`);
    }
  }

  /**
   * Get USDC balance of a wallet
   */
  async getUSDCBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return balance;
    } catch (error) {
      throw new Error(`Failed to get USDC balance: ${error}`);
    }
  }

  /**
   * Get SPX balance of a wallet
   */
  async getSPXBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: TOKENS.SPX6900,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return balance;
    } catch (error) {
      throw new Error(`Failed to get SPX balance: ${error}`);
    }
  }

  /**
   * Get swap quote from OpenOcean
   */
  async getSwapQuote(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
      const requestBody = {
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: sellAmount.toString(),
        takerAddress,
        receiverAddress,
        slippagePercentage: 0.05,
        gasPrice: 'standard',
        complexityLevel: 0,
        disableEstimate: false,
        allowPartialFill: false,
        preferDirect: true,
        maxHops: 2,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/openocean-swap`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || 'Failed to get swap quote',
        };
      }

      const data = await response.json();
      return {
        success: true,
        transaction: {
          to: data.to,
          data: data.data,
          value: data.value,
        },
        expectedOutput: data.outAmount || data.buyAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get swap quote: ${error}`,
      };
    }
  }

  /**
   * Execute a complete DCA swap
   */
  async executeDCASwap(
    agentConfig: DCAAgentConfig,
    swapAmount: bigint,
  ): Promise<DCAExecutionResult> {
    try {
      // Create agent account and smart wallet
      const agentAccount = privateKeyToAccount(agentConfig.privateKey);

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: agentAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
      });

      // Verify smart wallet address matches
      if (smartWallet.address !== agentConfig.smartWalletAddress) {
        throw new Error('Smart wallet address mismatch');
      }

      // Check USDC balance
      const usdcBalance = await this.getUSDCBalance(smartWallet.address);
      if (usdcBalance < swapAmount) {
        throw new Error(
          `Insufficient USDC balance: ${usdcBalance} < ${swapAmount}`,
        );
      }

      // Get swap quote (use smart wallet as receiver for reliable execution)
      const swapQuote = await this.getSwapQuote(
        swapAmount,
        smartWallet.address,
        smartWallet.address, // Always receive in smart wallet first
      );

      if (!swapQuote.success) {
        throw new Error(swapQuote.error || 'Failed to get swap quote');
      }

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // Build all transactions for the complete DCA flow
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [OPENOCEAN_ROUTER, swapAmount],
      });

      // Step 1: Approve USDC spend
      console.log('📝 Step 1: Approving USDC spend...');
      const approveTxHash = await kernelClient.sendUserOperation({
        account: smartWallet,
        calls: [
          {
            to: TOKENS.USDC,
            value: 0n,
            data: approveData,
          },
        ],
      });

      console.log('✅ USDC approval transaction:', approveTxHash);
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Step 2: Execute swap
      console.log('📝 Step 2: Executing USDC → SPX swap...');
      const swapTxHash = await kernelClient.sendUserOperation({
        account: smartWallet,
        calls: [
          {
            to: swapQuote.transaction!.to,
            value: BigInt(swapQuote.transaction!.value || '0'),
            data: swapQuote.transaction!.data,
          },
        ],
      });

      console.log('✅ Swap transaction:', swapTxHash);
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 3: Check SPX balance and transfer to user wallet
      console.log('📝 Step 3: Transferring SPX to user wallet...');
      const smartWalletSPX = await this.getSPXBalance(smartWallet.address);

      if (smartWalletSPX === 0n) {
        throw new Error('No SPX tokens received from swap');
      }

      console.log(
        `📤 Transferring ${smartWalletSPX.toString()} SPX to user wallet...`,
      );

      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [agentConfig.userWalletAddress, smartWalletSPX],
      });

      const transferTxHash = await kernelClient.sendUserOperation({
        account: smartWallet,
        calls: [
          {
            to: TOKENS.SPX6900,
            value: 0n,
            data: transferData,
          },
        ],
      });

      console.log('✅ SPX transfer transaction:', transferTxHash);
      await new Promise((resolve) => setTimeout(resolve, 10000));

      return {
        success: true,
        transactionHash: transferTxHash, // Final transfer transaction
        swapAmount: swapAmount.toString(),
        spxReceived: smartWalletSPX.toString(),
        gasSponsored: true,
        transactions: {
          approve: approveTxHash,
          swap: swapTxHash,
          transfer: transferTxHash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `DCA execution failed: ${error}`,
      };
    }
  }
}

// Export singleton instance
export const zerodevDCAService = new ZeroDevDCAService();
