'use client';

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  deserializePermissionAccount,
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
  erc20Abi,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
// Use ZeroDev's entry point instead of viem's
import { TOKENS } from '../utils/openOceanApi';

const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!;
const ZERODEV_RPC_URL = `https://rpc.zerodev.app/api/v2/bundler/${ZERODEV_PROJECT_ID}`;

export interface SimplifiedDCAResult {
  success: boolean;
  smartWalletAddress?: Address;
  sessionKeyData?: string;
  txHash?: string;
  error?: string;
}

/**
 * Simplified ZeroDev DCA Service
 * Based on the working 1-click-trading.ts example
 * Uses KERNEL_V3_1 consistently and simple sudo policy
 */
export class SimplifiedZeroDevDCAService {
  /**
   * Step 1: Deploy smart wallet for user using connected wallet
   * Following the exact pattern from examples but with wallet signer
   */
  static async deploySmartWallet(
    walletClient: any, // Connected wallet client from Wagmi/Privy
  ): Promise<{
    smartWalletAddress: Address;
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🚀 Deploying ZeroDev smart wallet (KERNEL_V3_1)...');
      console.log('   Wallet client type:', typeof walletClient);
      console.log('   Wallet client keys:', Object.keys(walletClient || {}));

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Extract the provider from the wallet client
      console.log('🔍 Transport details:', walletClient.transport);
      console.log(
        '🔍 Transport keys:',
        Object.keys(walletClient.transport || {}),
      );
      console.log('🔍 Transport type:', walletClient.transport?.type);
      console.log('🔍 Transport config:', walletClient.transport?.config);

      // For Wagmi wallet clients, the provider is usually in the transport
      let provider;
      if (walletClient.transport && walletClient.transport.provider) {
        provider = walletClient.transport.provider;
      } else if (walletClient.provider) {
        provider = walletClient.provider;
      } else if (
        walletClient.transport &&
        walletClient.transport.config &&
        walletClient.transport.config.provider
      ) {
        provider = walletClient.transport.config.provider;
      } else if (
        walletClient.transport &&
        walletClient.transport.value &&
        walletClient.transport.value.provider
      ) {
        provider = walletClient.transport.value.provider;
      } else {
        // Try to use the wallet client directly as it has signing methods
        console.log(
          '⚠️ No provider found, trying to use wallet client directly...',
        );
        provider = {
          request: async (args: any) => {
            if (args.method === 'personal_sign') {
              return await walletClient.signMessage({
                account: walletClient.account.address,
                message: args.params[0],
              });
            } else if (args.method === 'eth_signTypedData_v4') {
              const typedData = JSON.parse(args.params[1]);
              return await walletClient.signTypedData({
                account: walletClient.account.address,
                ...typedData,
              });
            } else if (args.method === 'eth_accounts') {
              return [walletClient.account.address];
            } else if (args.method === 'eth_requestAccounts') {
              return [walletClient.account.address];
            } else {
              throw new Error(`Unsupported method: ${args.method}`);
            }
          },
        };
      }

      console.log('   Provider found:', !!provider);
      console.log('   Provider type:', typeof provider);

      // Use the clientSessionKeyService pattern to create wallet client
      const vWalletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // Get user's account
      const [userAddress] = await vWalletClient.getAddresses();
      console.log('   User address:', userAddress);

      if (!userAddress) {
        throw new Error('No user address found');
      }

      // Create a temporary private key just for the account structure
      // The actual signing will be handled by the wallet client
      const tempPrivateKey = generatePrivateKey();
      const tempAccount = privateKeyToAccount(tempPrivateKey);

      // Override the account's signing methods to use the wallet client
      const walletAccount = {
        ...tempAccount,
        address: userAddress as `0x${string}`,
        signMessage: async ({ message }: { message: any }) => {
          return await vWalletClient.signMessage({
            account: userAddress,
            message,
          });
        },
        signTransaction: async (transaction: any) => {
          return await vWalletClient.signTransaction({
            account: userAddress,
            ...transaction,
          });
        },
        signTypedData: async (typedData: any) => {
          return await vWalletClient.signTypedData({
            account: userAddress,
            ...typedData,
          });
        },
      };

      console.log('🔍 Created wallet account:', walletAccount);
      console.log('🔍 Account address:', walletAccount.address);
      console.log('🔍 Account type:', walletAccount.type);

      // Use the wallet account (compatible with ZeroDev's expectations)
      const userSigner = await signerToEcdsaValidator(publicClient, {
        signer: walletAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      // Create kernel account (smart wallet)
      const kernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: userSigner,
        },
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      console.log('✅ Smart wallet deployed:', kernelAccount.address);
      return {
        success: true,
        smartWalletAddress: kernelAccount.address,
      };
    } catch (error) {
      console.error('❌ Smart wallet deployment failed:', error);
      return {
        success: false,
        smartWalletAddress: '0x0000000000000000000000000000000000000000',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 2: Create session key for DCA automation
   * Following the exact pattern from 1-click-trading.ts but with wallet signer
   */
  static async createDCASessionKey(
    walletClient: any, // Connected wallet client
    smartWalletAddress: Address,
  ): Promise<SimplifiedDCAResult> {
    try {
      console.log('🔑 Creating DCA session key (simplified approach)...');

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Extract the provider from the wallet client
      console.log('🔍 Transport details:', walletClient.transport);
      console.log(
        '🔍 Transport keys:',
        Object.keys(walletClient.transport || {}),
      );
      console.log('🔍 Transport type:', walletClient.transport?.type);
      console.log('🔍 Transport config:', walletClient.transport?.config);

      // For Wagmi wallet clients, the provider is usually in the transport
      let provider;
      if (walletClient.transport && walletClient.transport.provider) {
        provider = walletClient.transport.provider;
      } else if (walletClient.provider) {
        provider = walletClient.provider;
      } else if (
        walletClient.transport &&
        walletClient.transport.config &&
        walletClient.transport.config.provider
      ) {
        provider = walletClient.transport.config.provider;
      } else if (
        walletClient.transport &&
        walletClient.transport.value &&
        walletClient.transport.value.provider
      ) {
        provider = walletClient.transport.value.provider;
      } else {
        // Try to use the wallet client directly as it has signing methods
        console.log(
          '⚠️ No provider found, trying to use wallet client directly...',
        );
        provider = {
          request: async (args: any) => {
            if (args.method === 'personal_sign') {
              return await walletClient.signMessage({
                account: walletClient.account.address,
                message: args.params[0],
              });
            } else if (args.method === 'eth_signTypedData_v4') {
              const typedData = JSON.parse(args.params[1]);
              return await walletClient.signTypedData({
                account: walletClient.account.address,
                ...typedData,
              });
            } else if (args.method === 'eth_accounts') {
              return [walletClient.account.address];
            } else if (args.method === 'eth_requestAccounts') {
              return [walletClient.account.address];
            } else {
              throw new Error(`Unsupported method: ${args.method}`);
            }
          },
        };
      }

      console.log('   Provider found:', !!provider);
      console.log('   Provider type:', typeof provider);

      // Use the clientSessionKeyService pattern to create wallet client
      const vWalletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // Get user's account
      const [userAddress] = await vWalletClient.getAddresses();
      console.log('   User address:', userAddress);

      if (!userAddress) {
        throw new Error('No user address found');
      }

      // Create a temporary private key just for the account structure
      // The actual signing will be handled by the wallet client
      const tempPrivateKey = generatePrivateKey();
      const tempAccount = privateKeyToAccount(tempPrivateKey);

      // Override the account's signing methods to use the wallet client
      const walletAccount = {
        ...tempAccount,
        address: userAddress as `0x${string}`,
        signMessage: async ({ message }: { message: any }) => {
          return await vWalletClient.signMessage({
            account: userAddress,
            message,
          });
        },
        signTransaction: async (transaction: any) => {
          return await vWalletClient.signTransaction({
            account: userAddress,
            ...transaction,
          });
        },
        signTypedData: async (typedData: any) => {
          return await vWalletClient.signTypedData({
            account: userAddress,
            ...typedData,
          });
        },
      };

      // Use connected wallet as owner signer
      const userSigner = await signerToEcdsaValidator(publicClient, {
        signer: walletAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      // Create kernel account (smart wallet)
      const kernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: userSigner,
        },
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      console.log('📋 Smart wallet address:', kernelAccount.address);
      console.log('📋 Expected address:', smartWalletAddress);

      // Generate session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('🔑 Session key account:', sessionKeyAccount.address);

      // Create session key signer using the proper method from examples
      const sessionKeySigner = await toECDSASigner({
        signer: sessionKeyAccount,
      });

      // Create permission validator with simple sudo policy (like examples)
      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: sessionKeySigner,
        policies: [toSudoPolicy({})], // Simple policy that works
        kernelVersion: KERNEL_V3_1,
      });

      // Create session key account with permissions
      const sessionKeyKernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: userSigner,
          regular: permissionPlugin,
        },
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      console.log(
        '🔑 Session key kernel account:',
        sessionKeyKernelAccount.address,
      );

      // Create paymaster (using ZeroDev's built-in approach)
      const kernelPaymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Create kernel client with session key
      const kernelClient = createKernelAccountClient({
        account: sessionKeyKernelAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        paymaster: {
          getPaymasterData(userOperation) {
            return kernelPaymaster.sponsorUserOperation({ userOperation });
          },
        },
      });

      // Serialize session key for storage (only session key, not user key)
      const serializedSessionKey = await serializePermissionAccount(
        sessionKeyKernelAccount,
        sessionPrivateKey, // Only the session private key (not user's)
      );

      console.log('✅ Session key created and serialized');
      console.log('📦 Serialized length:', serializedSessionKey.length);

      return {
        success: true,
        smartWalletAddress: kernelAccount.address,
        sessionKeyData: serializedSessionKey,
      };
    } catch (error) {
      console.error('❌ Session key creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Step 3: Execute DCA swap using session key
   * Following the exact pattern from transaction-automation.ts
   */
  static async executeDCASwap(
    serializedSessionKey: string,
    swapCallData: Hex,
    swapTarget: Address,
    amountUSDC: bigint,
  ): Promise<SimplifiedDCAResult> {
    try {
      console.log('💱 Executing DCA swap with session key...');

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Deserialize session key (following examples)
      const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        serializedSessionKey,
      );

      console.log(
        '🔑 Deserialized session key account:',
        sessionKeyAccount.address,
      );

      // Create paymaster
      const kernelPaymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        paymaster: {
          getPaymasterData(userOperation) {
            return kernelPaymaster.sponsorUserOperation({ userOperation });
          },
        },
      });

      // Check USDC allowance
      const currentAllowance = (await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [sessionKeyAccount.address, swapTarget],
      })) as bigint;

      console.log('💰 Current USDC allowance:', currentAllowance.toString());
      console.log('💰 Required amount:', amountUSDC.toString());

      let userOpHash: Hex;

      if (currentAllowance < amountUSDC) {
        // Need approval first
        console.log('📝 Setting USDC allowance...');

        const maxUint256 = BigInt(
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        );

        const approveHash = await kernelClient.writeContract({
          address: TOKENS.USDC,
          abi: erc20Abi,
          functionName: 'approve',
          args: [swapTarget, maxUint256],
        });

        console.log('✅ Approval UserOp sent:', approveHash);

        // Wait for approval confirmation
        const approveReceipt = await kernelClient.waitForUserOperationReceipt({
          hash: approveHash,
        });

        console.log(
          '✅ Approval confirmed:',
          approveReceipt.receipt.transactionHash,
        );
      }

      // Execute swap
      console.log('🔄 Executing swap...');
      userOpHash = await kernelClient.sendTransaction({
        to: swapTarget,
        data: swapCallData,
      });

      console.log('✅ Swap UserOp sent:', userOpHash);

      // Wait for confirmation
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      console.log('🎉 DCA swap completed successfully!');
      console.log('   Transaction hash:', receipt.receipt.transactionHash);
      console.log('   Gas used:', receipt.receipt.gasUsed?.toString());

      return {
        success: true,
        txHash: receipt.receipt.transactionHash,
      };
    } catch (error) {
      console.error('❌ DCA swap execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
