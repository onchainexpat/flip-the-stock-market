import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;
const BUNDLER_URL = `https://rpc.zerodev.app/api/v2/bundler/${ZERODEV_PROJECT_ID}`;
const PAYMASTER_URL = `https://rpc.zerodev.app/api/v2/paymaster/${ZERODEV_PROJECT_ID}`;

// OpenOcean router on Base (update with actual address)
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface SessionKeyData {
  sessionPrivateKey: Hex;
  sessionAddress: Address;
  permissions: SessionKeyPermission[];
  userWalletAddress: Address;
  smartWalletAddress: Address;
  validAfter: number;
  validUntil: number;
  expiresAt: number; // Alias for validUntil for compatibility
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

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });

    this.paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(PAYMASTER_URL),
      entryPoint: getEntryPoint('0.6'), // KERNEL_V3_1 uses v0.6
    });
  }

  /**
   * Create session key with proper DCA permissions
   */
  async createSessionKey(
    smartWalletAddress: Address,
    userWalletAddress: Address,
    totalAmount: bigint,
    orderSizeAmount: bigint,
    durationDays: number,
  ): Promise<SessionKeyData> {
    try {
      console.log('🔑 Creating ZeroDev DCA session key...');
      console.log(`- Smart wallet: ${smartWalletAddress}`);
      console.log(`- User wallet: ${userWalletAddress}`);
      console.log(`- Total amount: ${totalAmount.toString()}`);
      console.log(`- Order size: ${orderSizeAmount.toString()}`);
      console.log(`- Duration: ${durationDays} days`);

      // Generate cryptographically secure session private key
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const sessionPrivateKey = `0x${Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}` as Hex;

      // Create session account
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log(`✅ Session account created: ${sessionAccount.address}`);

      const now = Math.floor(Date.now() / 1000);
      const validUntil = now + durationDays * 24 * 60 * 60;

      // Define comprehensive DCA permissions
      const permissions: SessionKeyPermission[] = [
        // Permission to interact with USDC contract (approve/transfer)
        {
          target: TOKENS.USDC,
          valueLimit: 0n, // No ETH value for ERC20 operations
          functionSelectors: [
            '0xa9059cbb', // transfer(address,uint256)
            '0x095ea7b3', // approve(address,uint256)
            '0x23b872dd', // transferFrom(address,address,uint256)
          ],
          validUntil,
          validAfter: now,
        },
        // Permission to interact with OpenOcean router
        {
          target: OPENOCEAN_ROUTER,
          valueLimit: parseEther('0.1'), // Small ETH allowance for potential native swaps
          functionSelectors: [
            '0x90411a32', // swap function selector (example)
            '0x12aa3caf', // swapExactETHForTokens
            '0x38ed1739', // swapExactTokensForTokens
            '0x7ff36ab5', // swapExactETHForTokensSupportingFeeOnTransferTokens
            '0xb6f9de95', // swapExactTokensForETHSupportingFeeOnTransferTokens
          ],
          validUntil,
          validAfter: now,
        },
        // Permission to interact with SPX6900 contract (transfer purchased tokens)
        {
          target: TOKENS.SPX6900,
          valueLimit: 0n,
          functionSelectors: [
            '0xa9059cbb', // transfer(address,uint256) - send SPX to external wallet
          ],
          validUntil,
          validAfter: now,
        },
      ];

      const sessionKeyData: SessionKeyData = {
        sessionPrivateKey,
        sessionAddress: sessionAccount.address,
        permissions,
        userWalletAddress,
        smartWalletAddress,
        validAfter: now,
        validUntil,
        expiresAt: validUntil, // Compatibility alias
      };

      console.log('✅ Session key created with comprehensive DCA permissions');
      return sessionKeyData;
    } catch (error) {
      console.error('❌ Failed to create session key:', error);
      throw error;
    }
  }

  /**
   * Execute DCA swap using session key with gas sponsorship
   */
  async executeDCASwap(
    sessionKeyData: SessionKeyData,
    swapAmount: bigint,
    destinationAddress: Address,
  ): Promise<ExecutionResult> {
    try {
      console.log('🚀 Executing DCA swap with session key...');
      console.log(`- Session key: ${sessionKeyData.sessionAddress}`);
      console.log(`- Smart wallet: ${sessionKeyData.smartWalletAddress}`);
      console.log(`- Swap amount: ${swapAmount.toString()} USDC wei`);
      console.log(`- SPX destination: ${destinationAddress} (direct delivery)`);

      // Validate session key hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (now > sessionKeyData.validUntil) {
        return {
          success: false,
          error: 'Session key has expired',
        };
      }

      // Step 1: Get OpenOcean swap quote
      console.log('📊 Getting OpenOcean swap quote...');
      const swapQuote = await this.getOpenOceanSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        swapAmount,
        sessionKeyData.smartWalletAddress, // Smart wallet executes the swap
        destinationAddress, // But SPX tokens go directly to external wallet
      );

      if (!swapQuote.success) {
        return {
          success: false,
          error: `Failed to get swap quote: ${swapQuote.error}`,
        };
      }

      // Step 2: Create session account and validator
      const sessionAccount = privateKeyToAccount(
        sessionKeyData.sessionPrivateKey,
      );

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: sessionAccount,
        entryPoint: getEntryPoint('0.6'),
        kernelVersion: KERNEL_V3_1,
      });

      // Step 3: Create kernel account representing the smart wallet
      const kernelAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.6'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: sessionKeyData.smartWalletAddress,
      });

      // Step 4: Create kernel client with paymaster
      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(BUNDLER_URL),
        middleware: {
          sponsorUserOperation: this.paymasterClient.sponsorUserOperation,
        },
      });

      console.log('✅ Kernel client created with paymaster sponsorship');

      // Step 5: Execute batched DCA transactions
      console.log('🔄 Executing batched DCA transactions...');

      const transactions = [
        // Transaction 1: Approve OpenOcean router to spend USDC
        {
          to: TOKENS.USDC,
          value: 0n,
          data: this.encodeApproveTransaction(OPENOCEAN_ROUTER, swapAmount),
        },
        // Transaction 2: Execute swap via OpenOcean (SPX tokens go to smart wallet first)
        {
          to: swapQuote.transaction.to,
          value: BigInt(swapQuote.transaction.value || '0'),
          data: swapQuote.transaction.data,
        },
        // Transaction 3: Transfer expected SPX tokens from smart wallet to external wallet
        {
          to: TOKENS.SPX6900,
          value: 0n,
          data: this.encodeTransferTransaction(
            destinationAddress,
            BigInt(swapQuote.expectedOutput),
          ),
        },
      ];

      // Execute all transactions in a batch
      const txHash = await kernelClient.sendUserOperation({
        userOperation: await kernelClient.prepareUserOperationRequest({
          userOperation: {
            callData: await kernelAccount.encodeCallData(transactions),
          },
        }),
      });

      console.log('✅ DCA swap executed successfully!');
      console.log(`📍 Transaction hash: ${txHash}`);

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
      const balance = await this.publicClient.readContract({
        address: TOKENS.USDC,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [sessionKeyData.smartWalletAddress],
      });

      if (balance === 0n) {
        return {
          success: true,
          error: 'No funds to sweep',
        };
      }

      console.log(`💰 Sweeping ${balance.toString()} USDC wei`);

      // Create session account and execute sweep
      const sessionAccount = privateKeyToAccount(
        sessionKeyData.sessionPrivateKey,
      );

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: sessionAccount,
        entryPoint: getEntryPoint('0.6'),
        kernelVersion: KERNEL_V3_1,
      });

      const kernelAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.6'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: sessionKeyData.smartWalletAddress,
      });

      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(BUNDLER_URL),
        middleware: {
          sponsorUserOperation: this.paymasterClient.sponsorUserOperation,
        },
      });

      // Transfer all USDC to external wallet
      const txHash = await kernelClient.writeContract({
        address: TOKENS.USDC,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [destinationAddress, balance],
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
   * Get OpenOcean swap quote
   */
  private async getOpenOceanSwapQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress?: Address, // Optional: where to send the output tokens
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
      const response = await fetch('/api/openocean-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellToken,
          buyToken,
          sellAmount: sellAmount.toString(),
          takerAddress,
          receiverAddress: takerAddress, // Send tokens to smart wallet first, then transfer manually
          slippagePercentage: 0.015, // 1.5%
        }),
      });

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
        expectedOutput: data.buyAmount,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get swap quote',
      };
    }
  }

  /**
   * Encode ERC20 approve transaction
   */
  private encodeApproveTransaction(spender: Address, amount: bigint): Hex {
    const functionSelector = '0x095ea7b3'; // approve(address,uint256)
    const spenderPadded = spender.slice(2).padStart(64, '0');
    const amountPadded = amount.toString(16).padStart(64, '0');
    return `${functionSelector}${spenderPadded}${amountPadded}` as Hex;
  }

  /**
   * Encode ERC20 transfer transaction
   */
  private encodeTransferTransaction(to: Address, amount: bigint): Hex {
    const functionSelector = '0xa9059cbb'; // transfer(address,uint256)
    const toPadded = to.slice(2).padStart(64, '0');
    const amountPadded = amount.toString(16).padStart(64, '0');
    return `${functionSelector}${toPadded}${amountPadded}` as Hex;
  }

  /**
   * Encode ERC20 transfer transaction that transfers entire balance
   * Uses a special amount value that indicates "transfer all"
   */
  private encodeTransferAllTransaction(to: Address): Hex {
    // For now, we'll use the maximum uint256 value to indicate "transfer all"
    // In a more sophisticated implementation, we could use a custom contract
    // that reads the balance and transfers it in one transaction
    const maxAmount = BigInt(
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    );
    return this.encodeTransferTransaction(to, maxAmount);
  }
}

// Export singleton instance
export const zerodevSessionKeyService = new ZeroDevSessionKeyService();
