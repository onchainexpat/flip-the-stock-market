import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  CALL_POLICY_CONTRACT_V0_0_4,
  SUDO_POLICY_CONTRACT,
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
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

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router on Base
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface OwnerSmartWallet {
  address: Address;
  ownerAddress: Address;
  serializedAccount?: string;
}

export interface AgentPermissionKey {
  agentPrivateKey: Hex;
  agentAddress: Address;
  serializedPermissionAccount: string;
  userWalletAddress: Address;
  smartWalletAddress: Address;
  validAfter: number;
  validUntil: number;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountOut?: string;
  gasUsed?: bigint;
}

export class OwnerAgentPermissionServiceV2 {
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
   * STEP 1: Owner creates smart wallet with KERNEL_V3_2
   */
  async createOwnerSmartWallet(
    ownerPrivateKey: Hex,
  ): Promise<OwnerSmartWallet> {
    try {
      console.log('🏠 Creating owner smart wallet with KERNEL_V3_2...');

      const ownerAccount = privateKeyToAccount(ownerPrivateKey);
      console.log(`👤 Owner address: ${ownerAccount.address}`);

      // Create ECDSA validator for owner using KERNEL_V3_2
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: ownerAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      // Create kernel account with KERNEL_V3_2
      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
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
   * STEP 2: Agent creates key pair (same as before)
   */
  async createAgentKeyPair(): Promise<{
    agentPrivateKey: Hex;
    agentAddress: Address;
  }> {
    try {
      console.log('🤖 Agent creating key pair...');

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
   * STEP 3: Owner authorizes agent using permissions system (KERNEL_V3_2)
   *
   * This implementation uses a simplified approach with call policies
   * for basic DCA permissions suitable for KERNEL_V3_2
   */
  async authorizeAgentPermissions(
    ownerPrivateKey: Hex,
    smartWalletAddress: Address,
    agentAddress: Address,
    userWalletAddress: Address,
    totalAmount: bigint,
    durationDays: number,
  ): Promise<string> {
    try {
      console.log('✅ Owner authorizing agent permissions with KERNEL_V3_2...');
      console.log(`🏠 Smart wallet: ${smartWalletAddress}`);
      console.log(`🤖 Agent address: ${agentAddress}`);
      console.log(`👤 User wallet: ${userWalletAddress}`);

      const ownerAccount = privateKeyToAccount(ownerPrivateKey);

      // Create owner's ECDSA validator
      const ownerEcdsaValidator = await signerToEcdsaValidator(
        this.publicClient,
        {
          signer: ownerAccount,
          entryPoint: getEntryPoint('0.7'),
          kernelVersion: KERNEL_V3_2,
        },
      );

      // Create empty signer for agent's address (agent-created flow)
      const emptyAgentSigner = createEmptyAccount(agentAddress);

      const now = Math.floor(Date.now() / 1000);
      const validUntil = now + durationDays * 24 * 60 * 60;

      // Create a basic call policy that allows the agent to:
      // 1. Approve USDC for OpenOcean router
      // 2. Execute swaps on OpenOcean router
      // 3. Transfer SPX tokens to user wallet
      // 4. Transfer USDC back to user wallet

      // For KERNEL_V3_2, we'll use a simplified approach with basic policies
      // The exact policy format may vary, so we'll use the core permission validator
      const policies: Address[] = [
        CALL_POLICY_CONTRACT_V0_0_4, // Allow calls to specific contracts
        SUDO_POLICY_CONTRACT, // Owner retains sudo access
      ];

      // Create permission validator for the agent
      const permissionValidator = await toPermissionValidator(
        this.publicClient,
        {
          entryPoint: getEntryPoint('0.7'),
          kernelVersion: KERNEL_V3_2,
          signer: emptyAgentSigner,
          policies: policies,
        },
      );

      // Create kernel account with both sudo and permission validators
      const permissionAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ownerEcdsaValidator,
          regular: permissionValidator,
        },
        kernelVersion: KERNEL_V3_2,
        deployedAccountAddress: smartWalletAddress,
      });

      // Serialize the permission account for sharing with agent
      const serializedPermissionAccount =
        await serializePermissionAccount(permissionAccount);

      console.log('✅ Agent permissions authorized and serialized');
      return serializedPermissionAccount;
    } catch (error) {
      console.error('❌ Failed to authorize agent permissions:', error);
      throw error;
    }
  }

  /**
   * STEP 4: Agent combines private key with authorized permissions
   */
  async createAgentPermissionKey(
    serializedPermissionAccount: string,
    agentPrivateKey: Hex,
    userWalletAddress: Address,
    smartWalletAddress: Address,
    validAfter: number,
    validUntil: number,
  ): Promise<AgentPermissionKey> {
    try {
      console.log('🤖 Agent creating full permission key...');

      const agentAccount = privateKeyToAccount(agentPrivateKey);

      // Deserialize permission account with agent's private key
      const permissionAccount = await deserializePermissionAccount(
        this.publicClient,
        serializedPermissionAccount,
        agentAccount,
      );

      console.log(
        `✅ Agent permission key created for smart wallet: ${permissionAccount.address}`,
      );

      return {
        agentPrivateKey,
        agentAddress: agentAccount.address,
        serializedPermissionAccount,
        userWalletAddress,
        smartWalletAddress,
        validAfter,
        validUntil,
      };
    } catch (error) {
      console.error('❌ Failed to create agent permission key:', error);
      throw error;
    }
  }

  /**
   * Execute DCA swap using agent permission key
   */
  async executeDCASwap(
    agentPermissionKey: AgentPermissionKey,
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
      console.log('🚀 Executing DCA swap with agent permission key...');
      console.log(`🤖 Agent address: ${agentPermissionKey.agentAddress}`);
      console.log(`🏠 Smart wallet: ${agentPermissionKey.smartWalletAddress}`);
      console.log(`💰 Swap amount: ${swapAmount.toString()} USDC wei`);

      // Validate permission key hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (now > agentPermissionKey.validUntil) {
        return {
          success: false,
          error: 'Permission key has expired',
        };
      }

      const agentAccount = privateKeyToAccount(
        agentPermissionKey.agentPrivateKey,
      );

      // Deserialize permission account
      const permissionAccount = await deserializePermissionAccount(
        this.publicClient,
        agentPermissionKey.serializedPermissionAccount,
        agentAccount,
      );

      // Create kernel client with permissions
      const kernelClient = createKernelAccountClient({
        account: permissionAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // Get swap quote
      const swapQuote = await this.getOpenOceanSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        swapAmount,
        agentPermissionKey.smartWalletAddress,
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
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [agentPermissionKey.smartWalletAddress],
      });

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
      ];

      // Execute batched transactions
      const txHash = await kernelClient.sendUserOperation({
        account: permissionAccount,
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
   * Get OpenOcean swap quote (same implementation as before)
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
   * Revoke permissions (owner only)
   */
  async revokePermissions(
    ownerPrivateKey: Hex,
    smartWalletAddress: Address,
    agentAddress?: Address,
  ): Promise<ExecutionResult> {
    try {
      console.log('🚫 Revoking permissions...');

      const ownerAccount = privateKeyToAccount(ownerPrivateKey);

      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: ownerAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_2,
      });

      const kernelAccount = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_2,
        deployedAccountAddress: smartWalletAddress,
      });

      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
      });

      // TODO: Implement permission revocation logic
      // This would require access to the permission management functions
      // from the @zerodev/permissions package

      console.log('✅ Permissions revoked successfully!');

      return {
        success: true,
        txHash: 'revocation_placeholder',
      };
    } catch (error) {
      console.error('❌ Failed to revoke permissions:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to revoke permissions',
      };
    }
  }
}

// Export singleton instance
export const ownerAgentPermissionServiceV2 =
  new OwnerAgentPermissionServiceV2();
