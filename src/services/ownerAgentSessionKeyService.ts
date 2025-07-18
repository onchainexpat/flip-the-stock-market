import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import {
  ParamOperator,
  deserializeSessionKeyAccount,
  oneAddress,
  serializeSessionKeyAccount,
  signerToSessionKeyValidator,
} from '@zerodev/session-key';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  parseEther,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { NEXT_PUBLIC_URL } from '../config';
import { TOKENS } from '../utils/openOceanApi';

// Helper function to create empty account for agent-created flow
function createEmptyAccount(address: Address) {
  return {
    address,
    type: 'local' as const,
    source: 'address' as const,
    signMessage: () => Promise.resolve('0x' as Hex),
    signTransaction: () => Promise.resolve('0x' as Hex),
    signTypedData: () => Promise.resolve('0x' as Hex),
  };
}

// ZeroDev configuration - using v3 API consistently
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;
const BUNDLER_URL = `https://rpc.zerodev.app/api/v3/bundler/${ZERODEV_PROJECT_ID}`;
const PAYMASTER_URL = `https://rpc.zerodev.app/api/v3/paymaster/${ZERODEV_PROJECT_ID}`;

// OpenOcean router on Base
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface OwnerSmartWallet {
  address: Address;
  ownerAddress: Address;
  serializedAccount?: string;
}

export interface AgentSessionKey {
  agentPrivateKey: Hex;
  agentAddress: Address;
  serializedSessionKey: string;
  permissions: SessionKeyPermission[];
  userWalletAddress: Address;
  smartWalletAddress: Address;
  validAfter: number;
  validUntil: number;
}

export interface SessionKeyPermission {
  target: Address;
  valueLimit: bigint;
  functionSelectors: Hex[];
  validUntil: number;
  validAfter: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountOut?: string;
  gasUsed?: bigint;
}

export class OwnerAgentSessionKeyService {
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
      entryPoint: getEntryPoint('0.7'), // Use v0.7 consistently with KERNEL_V3_2
    });
  }

  /**
   * STEP 1: Owner creates smart wallet
   * This is done once by the owner and creates the master smart wallet
   */
  async createOwnerSmartWallet(
    ownerPrivateKey: Hex,
  ): Promise<OwnerSmartWallet> {
    try {
      console.log('🏠 Creating owner smart wallet...');

      // Create owner account
      const ownerAccount = privateKeyToAccount(ownerPrivateKey);
      console.log(`👤 Owner address: ${ownerAccount.address}`);

      // Create ECDSA validator for owner
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: ownerAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
      });

      // Create kernel account (smart wallet)
      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
      });

      console.log(`🏠 Smart wallet created: ${smartWallet.address}`);

      return {
        address: smartWallet.address,
        ownerAddress: ownerAccount.address,
      };
    } catch (error) {
      console.error('❌ Failed to create owner smart wallet:', error);
      throw error;
    }
  }

  /**
   * STEP 2: Agent creates key pair and shares public key with owner
   * This implements the secure agent-created flow
   */
  async createAgentKeyPair(): Promise<{
    agentPrivateKey: Hex;
    agentAddress: Address;
  }> {
    try {
      console.log('🤖 Agent creating key pair...');

      // Agent generates cryptographically secure key pair
      const agentPrivateKey = generatePrivateKey();
      const agentAccount = privateKeyToAccount(agentPrivateKey);

      console.log(`🔑 Agent public key: ${agentAccount.address}`);

      return {
        agentPrivateKey,
        agentAddress: agentAccount.address,
      };
    } catch (error) {
      console.error('❌ Failed to create agent key pair:', error);
      throw error;
    }
  }

  /**
   * STEP 3: Owner authorizes agent's public key as session key
   * This creates the session key permissions and shares with agent
   */
  async authorizeAgentSessionKey(
    ownerPrivateKey: Hex,
    smartWalletAddress: Address,
    agentAddress: Address,
    userWalletAddress: Address,
    totalAmount: bigint,
    durationDays: number,
  ): Promise<string> {
    try {
      console.log('✅ Owner authorizing agent session key...');
      console.log(`🏠 Smart wallet: ${smartWalletAddress}`);
      console.log(`🤖 Agent address: ${agentAddress}`);
      console.log(`👤 User wallet: ${userWalletAddress}`);

      // Create owner account
      const ownerAccount = privateKeyToAccount(ownerPrivateKey);

      // Create owner's ECDSA validator
      const ownerEcdsaValidator = await signerToEcdsaValidator(
        this.publicClient,
        {
          signer: ownerAccount,
          entryPoint: getEntryPoint('0.7'), // Use v0.7 for KERNEL_V3_2
          kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
        },
      );

      // Create empty signer for agent's address (agent-created flow)
      const emptyAgentSigner = createEmptyAccount(agentAddress);

      const now = Math.floor(Date.now() / 1000);
      const validUntil = now + durationDays * 24 * 60 * 60;

      // Create session key validator with DCA permissions
      // Note: Use v0.7 EntryPoint consistently with KERNEL_V3_2
      const sessionKeyValidator = await signerToSessionKeyValidator(
        this.publicClient,
        {
          signer: emptyAgentSigner,
          entryPoint: getEntryPoint('0.7'), // Use v0.7 consistently with KERNEL_V3_2
          kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
          validatorData: {
            validUntil,
            validAfter: now,
            paymaster: oneAddress, // Require any paymaster for security
            permissions: [
              // Permission 1: Approve USDC for OpenOcean router
              {
                target: TOKENS.USDC,
                valueLimit: 0n,
                abi: [
                  {
                    name: 'approve',
                    type: 'function',
                    inputs: [
                      { name: 'spender', type: 'address' },
                      { name: 'amount', type: 'uint256' },
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                    stateMutability: 'nonpayable',
                  },
                ],
                functionName: 'approve',
                args: [
                  {
                    operator: ParamOperator.EQUAL,
                    value: OPENOCEAN_ROUTER,
                  },
                  null, // Allow any amount up to total DCA amount
                ],
              },
              // Permission 2: Execute swaps on OpenOcean router
              {
                target: OPENOCEAN_ROUTER,
                valueLimit: parseEther('0.01'), // Small ETH allowance for native swaps
                abi: [
                  {
                    name: 'swap',
                    type: 'function',
                    inputs: [
                      { name: 'executor', type: 'address' },
                      { name: 'desc', type: 'tuple' },
                      { name: 'permit', type: 'bytes' },
                      { name: 'data', type: 'bytes' },
                    ],
                    outputs: [],
                    stateMutability: 'payable',
                  },
                ],
                functionName: 'swap',
                args: [null, null, null, null], // Allow any swap parameters
              },
              // Permission 3: Transfer SPX tokens to user's wallet
              {
                target: TOKENS.SPX6900,
                valueLimit: 0n,
                abi: [
                  {
                    name: 'transfer',
                    type: 'function',
                    inputs: [
                      { name: 'to', type: 'address' },
                      { name: 'amount', type: 'uint256' },
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                    stateMutability: 'nonpayable',
                  },
                ],
                functionName: 'transfer',
                args: [
                  {
                    operator: ParamOperator.EQUAL,
                    value: userWalletAddress, // Only allow transfers to user's wallet
                  },
                  null, // Allow any amount
                ],
              },
              // Permission 4: Transfer USDC back to user (for sweeping)
              {
                target: TOKENS.USDC,
                valueLimit: 0n,
                abi: [
                  {
                    name: 'transfer',
                    type: 'function',
                    inputs: [
                      { name: 'to', type: 'address' },
                      { name: 'amount', type: 'uint256' },
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                    stateMutability: 'nonpayable',
                  },
                ],
                functionName: 'transfer',
                args: [
                  {
                    operator: ParamOperator.EQUAL,
                    value: userWalletAddress, // Only allow transfers to user's wallet
                  },
                  null, // Allow any amount
                ],
              },
            ],
          },
        },
      );

      // Create kernel account with both sudo and session key validators
      const sessionKeyAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'), // Use v0.7 consistently with KERNEL_V3_2
        plugins: {
          sudo: ownerEcdsaValidator,
          regular: sessionKeyValidator,
        },
        kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
        deployedAccountAddress: smartWalletAddress, // Use existing smart wallet
      });

      // Serialize the session key account for sharing with agent
      const serializedSessionKey =
        await serializeSessionKeyAccount(sessionKeyAccount);

      console.log('✅ Agent session key authorized and serialized');
      return serializedSessionKey;
    } catch (error) {
      console.error('❌ Failed to authorize agent session key:', error);
      throw error;
    }
  }

  /**
   * STEP 4: Agent combines private key with authorized session key
   * This creates the full session key that agent can use
   */
  async createAgentSessionKey(
    serializedSessionKey: string,
    agentPrivateKey: Hex,
    userWalletAddress: Address,
    smartWalletAddress: Address,
    validAfter: number,
    validUntil: number,
  ): Promise<AgentSessionKey> {
    try {
      console.log('🤖 Agent creating full session key...');

      // Create agent account from private key
      const agentAccount = privateKeyToAccount(agentPrivateKey);

      // Deserialize session key with agent's private key
      const sessionKeyAccount = await deserializeSessionKeyAccount(
        this.publicClient,
        serializedSessionKey,
        agentAccount, // Agent's private key
      );

      console.log(
        `✅ Agent session key created for smart wallet: ${sessionKeyAccount.address}`,
      );

      return {
        agentPrivateKey,
        agentAddress: agentAccount.address,
        serializedSessionKey,
        permissions: [], // Will be reconstructed from validator
        userWalletAddress,
        smartWalletAddress,
        validAfter,
        validUntil,
      };
    } catch (error) {
      console.error('❌ Failed to create agent session key:', error);
      throw error;
    }
  }

  /**
   * Execute DCA swap using agent session key
   */
  async executeDCASwap(
    agentSessionKey: AgentSessionKey,
    swapAmount: bigint,
    destinationAddress: Address,
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
      console.log('🚀 Executing DCA swap with agent session key...');
      console.log(`🤖 Agent address: ${agentSessionKey.agentAddress}`);
      console.log(`🏠 Smart wallet: ${agentSessionKey.smartWalletAddress}`);
      console.log(`💰 Swap amount: ${swapAmount.toString()} USDC wei`);

      // Validate session key hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (now > agentSessionKey.validUntil) {
        return {
          success: false,
          error: 'Session key has expired',
        };
      }

      // Create agent account
      const agentAccount = privateKeyToAccount(agentSessionKey.agentPrivateKey);

      // Deserialize session key account
      const sessionKeyAccount = await deserializeSessionKeyAccount(
        this.publicClient,
        agentSessionKey.serializedSessionKey,
        agentAccount,
      );

      // Create kernel client with session key
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // Get swap quote
      const swapQuote = await this.getOpenOceanSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        swapAmount,
        agentSessionKey.smartWalletAddress,
        destinationAddress,
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
        args: [agentSessionKey.smartWalletAddress],
      });

      if (currentBalance < swapAmount) {
        return {
          success: false,
          error: `Insufficient USDC balance. Have: ${(Number(currentBalance) / 1e6).toFixed(6)} USDC, Need: ${(Number(swapAmount) / 1e6).toFixed(6)} USDC`,
        };
      }

      // Build transactions
      const approveData = this.encodeApproveTransaction(
        OPENOCEAN_ROUTER,
        swapAmount,
      );

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
      ];

      // Execute batched transactions
      const txHash = await kernelClient.sendUserOperation({
        account: sessionKeyAccount,
        calls: transactions.map((tx) => ({
          to: tx.to,
          value: tx.value || 0n,
          data: tx.data,
        })),
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
   * Revoke session key (owner only)
   */
  async revokeSessionKey(
    ownerPrivateKey: Hex,
    smartWalletAddress: Address,
    agentAddress?: Address,
  ): Promise<ExecutionResult> {
    try {
      console.log('🚫 Revoking session key...');

      const ownerAccount = privateKeyToAccount(ownerPrivateKey);

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: ownerAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
      });

      const kernelAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2, // Use v3.2 for chain abstraction
        deployedAccountAddress: smartWalletAddress,
      });

      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // Import revokeSessionKey function
      const { revokeSessionKey } = await import('@zerodev/session-key');

      // Revoke specific session key or all session keys
      const txHash = agentAddress
        ? await revokeSessionKey(kernelClient, agentAddress)
        : await revokeSessionKey(kernelClient);

      console.log('✅ Session key revoked successfully!');

      return {
        success: true,
        txHash,
      };
    } catch (error) {
      console.error('❌ Failed to revoke session key:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to revoke session key',
      };
    }
  }
}

// Export singleton instance
export const ownerAgentSessionKeyService = new OwnerAgentSessionKeyService();
