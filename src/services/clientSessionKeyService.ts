/**
 * Client-side Session Key Service for ZeroDev
 *
 * This service handles session key creation on the client side, where the user's
 * wallet signs the permission delegation. The session key is then serialized
 * and can be used server-side for automated DCA execution.
 */

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
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
  createWalletClient,
  custom,
  formatUnits,
  getContract,
} from 'viem';
import { erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';

// ZeroDev configuration for Base mainnet
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_PAYMASTER_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

export interface ClientSessionKeyData {
  sessionPrivateKey: Hex;
  serializedSessionKey: string;
  sessionAddress: Address;
  smartWalletAddress: Address;
  userWalletAddress: Address;
  validAfter: number;
  validUntil: number;
  expiresAt: number;
}

export class ClientSessionKeyService {
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
   * Create session key using user's connected wallet
   * This is called client-side where the user can sign the permission delegation
   */
  async createSessionKey(
    userWalletProvider: any, // EIP-1193 provider from user's wallet
    totalAmount: bigint,
    durationDays: number,
  ): Promise<ClientSessionKeyData> {
    try {
      console.log('🔑 Creating DCA Session Key for Base mainnet...');
      console.log(`- Total amount: ${formatUnits(totalAmount, 6)} USDC`);
      console.log(`- Duration: ${durationDays} days`);

      // Create wallet client from user's provider
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(userWalletProvider),
      });

      // Get user's account and create proper account object
      const [userAddress] = await walletClient.getAddresses();
      console.log('User address:', userAddress);

      // ✅ Validate address exists
      if (!userAddress) {
        throw new Error('No wallet address found');
      }

      // Create a proper account object that viem expects
      const account = {
        address: userAddress as Address,
        type: 'local' as const,
        source: 'custom' as const,
        signMessage: async ({ message }: { message: any }) => {
          return await walletClient.signMessage({
            account: userAddress,
            message,
          });
        },
        signTransaction: async (transaction: any) => {
          return await walletClient.signTransaction({
            account: userAddress,
            ...transaction,
          });
        },
        signTypedData: async (typedData: any) => {
          return await walletClient.signTypedData({
            account: userAddress,
            ...typedData,
          });
        },
      };

      console.log('🔍 Account object address:', account.address);
      console.log('🔍 Entry point:', this.entryPoint);
      console.log('🔍 KERNEL_V3_1:', KERNEL_V3_1);
      
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: account,
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
      });

      // Create original smart wallet
      const originalAccount = await createKernelAccount(this.publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
      });

      console.log('Smart Wallet Address:', originalAccount.address);

      // Check wallet balance
      const balance = await this.getUSDCBalance(originalAccount.address);
      console.log(
        'Smart Wallet USDC Balance:',
        formatUnits(balance, 6),
        'USDC',
      );

      if (balance < totalAmount) {
        throw new Error(
          `Insufficient USDC balance. Have: ${formatUnits(balance, 6)} USDC, Need: ${formatUnits(totalAmount, 6)} USDC`,
        );
      }

      // Generate session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });

      console.log('Session Key Address:', sessionAccount.address);

      // Create permission validator with DCA permissions
      const permissionPlugin = await toPermissionValidator(this.publicClient, {
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
        signer: sessionKeySigner,
        policies: [
          // For DCA, we use sudo policy to allow full token operations
          // In production, you'd use more specific policies with spending limits
          toSudoPolicy({}),
        ],
      });

      // Create session key account with both plugins (this preserves the address)
      const sessionKeyAccount = await createKernelAccount(this.publicClient, {
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
        plugins: {
          sudo: ecdsaValidator,
          regular: permissionPlugin,
        },
      });

      console.log(
        'Session key account created. Address matches:',
        sessionKeyAccount.address === originalAccount.address,
      );

      if (sessionKeyAccount.address !== originalAccount.address) {
        throw new Error(
          `Session key address mismatch! Expected: ${originalAccount.address}, Got: ${sessionKeyAccount.address}`,
        );
      }

      // Serialize the session key
      const serializedSessionKey = await serializePermissionAccount(
        sessionKeyAccount,
        sessionPrivateKey,
      );

      const now = Math.floor(Date.now() / 1000);
      const validUntil = now + durationDays * 24 * 60 * 60;

      const sessionKeyData: ClientSessionKeyData = {
        sessionPrivateKey,
        serializedSessionKey,
        sessionAddress: sessionAccount.address,
        smartWalletAddress: originalAccount.address,
        userWalletAddress: userAddress,
        validAfter: now,
        validUntil,
        expiresAt: validUntil,
      };

      console.log('✅ Session key created successfully');
      return sessionKeyData;
    } catch (error) {
      console.error('❌ Failed to create session key:', error);
      throw error;
    }
  }

  /**
   * Test session key by executing a small transaction
   */
  async testSessionKey(
    sessionKeyData: ClientSessionKeyData,
    testAmount: bigint = BigInt(1000000), // 1 USDC
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      console.log('🧪 Testing session key...');
      console.log(`- Test amount: ${formatUnits(testAmount, 6)} USDC`);

      // Import the server session key service for testing
      const { zerodevSessionKeyService } = await import(
        './zerodevSessionKeyService'
      );

      // Execute a small test swap
      const result = await zerodevSessionKeyService.executeDCASwap(
        sessionKeyData,
        testAmount,
        sessionKeyData.userWalletAddress, // Send back to user for testing
      );

      return {
        success: result.success,
        txHash: result.txHash,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
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
   * Deploy smart wallet if needed
   */
  async deploySmartWallet(userWalletProvider: any): Promise<{
    success: boolean;
    smartWalletAddress?: Address;
    txHash?: string;
    error?: string;
  }> {
    try {
      console.log('🚀 Deploying smart wallet...');

      // Create wallet client from user's provider
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(userWalletProvider),
      });

      // Get user's account
      const [userAddress] = await walletClient.getAddresses();
      console.log('User address:', userAddress);

      // Create ECDSA validator for user's wallet
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: {
          address: userAddress,
          signMessage: async ({ message }) => {
            return await walletClient.signMessage({
              account: userAddress,
              message,
            });
          },
          signTransaction: async (transaction) => {
            return await walletClient.signTransaction({
              account: userAddress,
              ...transaction,
            });
          },
          signTypedData: async (typedData) => {
            return await walletClient.signTypedData({
              account: userAddress,
              ...typedData,
            });
          },
        },
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
      });

      // Create smart wallet account
      const smartWalletAccount = await createKernelAccount(this.publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint: this.entryPoint,
        kernelVersion: KERNEL_V3_1,
      });

      console.log('Smart Wallet Address:', smartWalletAccount.address);

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: smartWalletAccount,
        chain: base,
        bundlerTransport: http(
          `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`,
        ),
        paymaster: {
          getPaymasterData: (userOperation) => {
            return this.paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      // Deploy with a dummy transaction
      const txHash = await kernelClient.sendUserOperation({
        calls: [
          {
            to: smartWalletAccount.address,
            value: BigInt(0),
            data: '0x',
          },
        ],
      });

      console.log('✅ Smart wallet deployed');
      console.log(`📍 Transaction hash: ${txHash}`);

      return {
        success: true,
        smartWalletAddress: smartWalletAccount.address,
        txHash,
      };
    } catch (error) {
      console.error('❌ Failed to deploy smart wallet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
      };
    }
  }
}

// Export singleton instance
export const clientSessionKeyService = new ClientSessionKeyService();
