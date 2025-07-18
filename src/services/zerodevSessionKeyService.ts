import { deserializePermissionAccount } from '@zerodev/permissions';
import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getContract,
} from 'viem';
import { erc20Abi } from 'viem';
import { base } from 'viem/chains';
import { NEXT_PUBLIC_URL } from '../config';
import { TOKENS } from '../utils/openOceanApi';

// ZeroDev configuration for Base mainnet
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;
const ZERODEV_BUNDLER_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;
const ZERODEV_PAYMASTER_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router on Base mainnet
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface SessionKeyData {
  sessionPrivateKey: Hex;
  serializedSessionKey: string;
  sessionAddress: Address;
  smartWalletAddress: Address;
  userWalletAddress: Address;
  validAfter: number;
  validUntil: number;
  expiresAt: number;
}

export interface SessionKeyPermission {
  target: Address;
  valueLimit: bigint;
  functionSelectors: Hex[];
  validUntil: number;
  validAfter: number;
}

export interface TransactionRequest {
  to: Address;
  data: Hex;
  value?: bigint;
  gas?: bigint;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountOut?: string;
  gasUsed?: bigint;
}

export class ZeroDevSessionKeyService {
  private publicClient;
  private paymasterClient;
  private entryPoint;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    this.entryPoint = getEntryPoint('0.7');

    this.paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_PAYMASTER_URL),
    });
  }

  /**
   * Note: Session key creation is now handled client-side by ClientSessionKeyService
   * This service only handles server-side execution using pre-created session keys
   */

  /**
   * Execute DCA swap using session key with gas sponsorship
   */
  async executeDCASwap(
    sessionKeyData: SessionKeyData,
    swapAmount: bigint,
    destinationAddress: Address,
  ): Promise<ExecutionResult> {
    // Minimum swap amount: $1 USD (1,000,000 USDC wei) - reasonable minimum for mainnet
    const MINIMUM_SWAP_AMOUNT = BigInt(1000000);

    // If swap amount is too small, skip this execution
    if (swapAmount < MINIMUM_SWAP_AMOUNT) {
      console.log(
        `⏭️ Swap amount ${formatUnits(swapAmount, 6)} USDC is below minimum $1. Skipping execution.`,
      );
      return {
        success: true,
        txHash: 'skipped_small_amount',
        amountOut: '0',
        error: 'Amount too small - accumulating for batch execution',
      };
    }

    try {
      console.log('🚀 Executing DCA swap with session key...');
      console.log(`- Smart wallet: ${sessionKeyData.smartWalletAddress}`);
      console.log(`- Swap amount: ${formatUnits(swapAmount, 6)} USDC`);
      console.log(`- SPX destination: ${destinationAddress}`);

      // Validate session key hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (now > sessionKeyData.validUntil) {
        return {
          success: false,
          error: 'Session key has expired',
        };
      }

      // Step 1: Check current USDC balance
      const currentBalance = await this.getUSDCBalance(
        sessionKeyData.smartWalletAddress,
      );
      console.log(
        `💰 Current USDC balance: ${formatUnits(currentBalance, 6)} USDC`,
      );

      if (currentBalance < swapAmount) {
        return {
          success: false,
          error: `Insufficient USDC balance. Have: ${formatUnits(currentBalance, 6)} USDC, Need: ${formatUnits(swapAmount, 6)} USDC`,
        };
      }

      // Step 2: Get OpenOcean swap quote
      console.log('📊 Getting OpenOcean swap quote...');
      const swapQuote = await this.getOpenOceanSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        swapAmount,
        sessionKeyData.smartWalletAddress,
        destinationAddress,
      );

      if (!swapQuote.success) {
        return {
          success: false,
          error: `Failed to get swap quote: ${swapQuote.error}`,
        };
      }

      // Step 3: Deserialize session key
      const sessionKeyAccount = await deserializePermissionAccount(
        this.publicClient,
        this.entryPoint,
        KERNEL_V3_1,
        sessionKeyData.serializedSessionKey,
      );

      // Step 4: Create kernel client with session key
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_BUNDLER_URL),
        paymaster: {
          getPaymasterData: (userOperation) => {
            return this.paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      // Step 5: Build transaction batch
      const transactions = [];

      // Transaction 1: Approve USDC spending
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [OPENOCEAN_ROUTER, swapAmount],
      });

      transactions.push({
        to: TOKENS.USDC,
        value: BigInt(0),
        data: approveData,
      });

      // Transaction 2: Execute swap
      transactions.push({
        to: swapQuote.transaction!.to,
        value: BigInt(swapQuote.transaction!.value || '0'),
        data: swapQuote.transaction!.data,
      });

      console.log('🔄 Executing batched DCA transactions...');

      // Execute all transactions in a batch
      const txHash = await kernelClient.sendUserOperation({
        calls: transactions,
      });

      console.log('✅ DCA swap executed successfully!');
      console.log(`📍 Transaction hash: ${txHash}`);
      console.log(`🎯 Expected SPX output: ${swapQuote.expectedOutput}`);

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
   * Sweep remaining USDC from smart wallet back to external wallet
   */
  async sweepRemainingFunds(
    sessionKeyData: SessionKeyData,
    destinationAddress: Address,
  ): Promise<ExecutionResult> {
    try {
      console.log('🧹 Sweeping remaining funds...');
      console.log(`- Smart wallet: ${sessionKeyData.smartWalletAddress}`);
      console.log(`- Destination: ${destinationAddress}`);

      // Check USDC balance in smart wallet
      const balance = await this.getUSDCBalance(
        sessionKeyData.smartWalletAddress,
      );

      if (balance === BigInt(0)) {
        return {
          success: true,
          error: 'No funds to sweep',
        };
      }

      console.log(`💰 Sweeping ${formatUnits(balance, 6)} USDC`);

      // Deserialize session key
      const sessionKeyAccount = await deserializePermissionAccount(
        this.publicClient,
        this.entryPoint,
        KERNEL_V3_1,
        sessionKeyData.serializedSessionKey,
      );

      // Create kernel client with session key
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_BUNDLER_URL),
        paymaster: {
          getPaymasterData: (userOperation) => {
            return this.paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      // Transfer all USDC to external wallet
      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [destinationAddress, balance],
      });

      const txHash = await kernelClient.sendUserOperation({
        calls: [
          {
            to: TOKENS.USDC,
            value: BigInt(0),
            data: transferData,
          },
        ],
      });

      console.log('✅ Funds swept successfully!');
      console.log(`📍 Transaction hash: ${txHash}`);

      return {
        success: true,
        txHash,
        amountOut: balance.toString(),
      };
    } catch (error) {
      console.error('❌ Fund sweep failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fund sweep failed',
      };
    }
  }

  /**
   * Get USDC balance for an address
   */
  private async getUSDCBalance(address: Address): Promise<bigint> {
    const contract = getContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      client: this.publicClient,
    });

    return await contract.read.balanceOf([address]);
  }

  /**
   * Get OpenOcean swap quote for Base mainnet
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
        slippagePercentage: 0.02, // 2% slippage for mainnet
        gasPrice: 'standard',
        complexityLevel: 0,
        disableEstimate: false,
        allowPartialFill: false,
      };

      console.log('🔍 Requesting swap quote from OpenOcean...');
      console.log(`- Sell: ${formatUnits(sellAmount, 6)} USDC`);
      console.log(`- Buy: SPX6900`);
      console.log(`- Receiver: ${receiverAddress || takerAddress}`);

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

      console.log('✅ Swap quote received');
      console.log(`- Expected SPX output: ${expectedOutput}`);

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
export const zerodevSessionKeyService = new ZeroDevSessionKeyService();
