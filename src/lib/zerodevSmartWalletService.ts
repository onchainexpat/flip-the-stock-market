import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, type Address, type Hex, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type {
  ExecutionResult,
  TransactionRequest,
} from './coinbaseSmartWalletService';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;
const BUNDLER_URL = `https://rpc.zerodev.app/api/v1/bundler/${ZERODEV_PROJECT_ID}`;
const PAYMASTER_URL = `https://rpc.zerodev.app/api/v1/paymaster/${ZERODEV_PROJECT_ID}`;

/**
 * Service for executing transactions through ZeroDev smart wallets with gas sponsorship
 * This allows DCA orders to execute automatically without requiring ETH for gas
 */
export class ZeroDevSmartWalletService {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });
  }

  /**
   * Execute a transaction using session key with ZeroDev paymaster
   * This uses the user's session key to execute from their existing smart wallet
   */
  async executeWithSessionKey(
    sessionKeyData: any,
    transaction: TransactionRequest,
  ): Promise<ExecutionResult> {
    try {
      const smartWalletAddress = sessionKeyData.userWalletAddress;
      console.log('🚀 ZeroDev Session Key Execution Started');
      console.log('📍 Smart wallet:', smartWalletAddress);
      console.log('🔑 Session key:', sessionKeyData.sessionAddress);
      console.log('📄 Transaction:', {
        to: transaction.to,
        value: transaction.value?.toString() || '0',
        dataPreview: transaction.data?.slice(0, 10),
      });

      // Validate session key data
      if (
        !sessionKeyData.sessionPrivateKey ||
        !sessionKeyData.userWalletAddress
      ) {
        return {
          success: false,
          error:
            'Invalid session key data - missing private key or wallet address',
        };
      }

      // Create session account from the user's session key
      const sessionAccount = privateKeyToAccount(
        sessionKeyData.sessionPrivateKey as Hex,
      );
      console.log('✅ Session account created:', sessionAccount.address);

      // Verify session account matches stored address
      if (
        sessionAccount.address.toLowerCase() !==
        sessionKeyData.sessionAddress.toLowerCase()
      ) {
        return {
          success: false,
          error:
            'Session key mismatch - private key does not match stored address',
        };
      }

      // Create ECDSA validator for the session key
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: sessionAccount,
        entryPoint: getEntryPoint('0.6'),
        kernelVersion: KERNEL_V3_1,
      });

      // Create kernel account that represents the existing smart wallet
      // This connects to the user's existing smart wallet using their session key
      const kernelAccount = await createKernelAccount(this.publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint: getEntryPoint('0.6'),
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: smartWalletAddress, // Use existing smart wallet
      });

      console.log('📱 Kernel account address:', kernelAccount.address);
      console.log('✅ Connected to existing smart wallet');

      // Create paymaster client for gas sponsorship
      const paymasterClient = createZeroDevPaymasterClient({
        chain: base,
        transport: http(PAYMASTER_URL),
        entryPoint: getEntryPoint('0.7'),
      });

      // Create kernel account client with paymaster
      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(BUNDLER_URL),
        middleware: {
          sponsorUserOperation: paymasterClient.sponsorUserOperation,
        },
      });

      console.log('💰 ZeroDev paymaster configured for gas sponsorship');

      // Send the user operation (will be gas sponsored)
      const userOpHash = await kernelClient.sendUserOperation({
        userOperation: {
          callData: await kernelAccount.encodeCallData({
            to: transaction.to,
            value: transaction.value || 0n,
            data: transaction.data || '0x',
          }),
        },
      });

      console.log('📤 UserOperation sent:', userOpHash);

      // Wait for transaction receipt
      const bundlerClient = kernelClient.extend(() => ({
        waitForUserOperationReceipt: async (hash: any) => {
          return await kernelClient.waitForUserOperationReceipt({ hash });
        },
      }));

      const receipt =
        await bundlerClient.waitForUserOperationReceipt(userOpHash);
      const txHash = receipt.receipt.transactionHash;

      console.log('✅ Transaction confirmed:', txHash);
      console.log('🎉 Gas sponsored by ZeroDev paymaster!');

      return {
        success: true,
        txHash,
        gasUsed: receipt.receipt.gasUsed,
      };
    } catch (error) {
      console.error('❌ ZeroDev execution failed:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('paymaster')) {
          return {
            success: false,
            error:
              'Gas sponsorship failed. Check ZeroDev project configuration.',
          };
        }
        if (error.message.includes('insufficient funds')) {
          return {
            success: false,
            error:
              'Smart wallet has insufficient funds for the transaction value.',
          };
        }
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'ZeroDev execution failed',
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   * Redirects to session key execution
   */
  async executeOnBehalfOf(
    smartWalletAddress: Address,
    transaction: TransactionRequest,
  ): Promise<ExecutionResult> {
    return {
      success: false,
      error:
        'executeOnBehalfOf requires session key data. Use executeWithSessionKey instead.',
    };
  }

  /**
   * Execute a swap transaction through the smart wallet using session key
   * This wraps the swap in a smart wallet transaction with gas sponsorship
   */
  async executeSwapTransaction(
    sessionKeyData: any,
    swapData: {
      to: Address;
      data: Hex;
      value: bigint;
    },
  ): Promise<ExecutionResult> {
    console.log('🔄 Executing swap through smart wallet...');
    console.log('💱 Swap details:', {
      router: swapData.to,
      value: swapData.value.toString(),
      dataLength: swapData.data.length,
    });

    // Execute the swap using session key with gas sponsorship
    return this.executeWithSessionKey(sessionKeyData, {
      to: swapData.to,
      data: swapData.data,
      value: swapData.value,
    });
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      (
        process.env.DCA_EXECUTION_PRIVATE_KEY &&
        ZERODEV_PROJECT_ID &&
        ZERODEV_PROJECT_ID !== '485df233-2a0d-4aee-b94a-b266be42ea55'
      ) // Not the example ID
    );
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus() {
    return {
      hasExecutionKey: !!process.env.DCA_EXECUTION_PRIVATE_KEY,
      hasProjectId: !!ZERODEV_PROJECT_ID,
      isExampleProjectId:
        ZERODEV_PROJECT_ID === '485df233-2a0d-4aee-b94a-b266be42ea55',
      bundlerUrl: BUNDLER_URL,
      paymasterUrl: PAYMASTER_URL,
    };
  }
}

// Export singleton instance
export const zerodevSmartWalletService = new ZeroDevSmartWalletService();
