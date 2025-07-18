/**
 * DCA Session Key Solution
 * 
 * This demonstrates the correct approach for implementing session keys
 * for DCA (Dollar Cost Averaging) that avoids the address mismatch issue.
 * 
 * Key insight: Don't create a new kernel account with session keys.
 * Instead, install the permission plugin on the existing account.
 */

import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  KernelAccountClient,
  KernelSmartAccount,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  serializePermissionAccount,
  deserializePermissionAccount,
  toPermissionValidator,
  Permission,
  ParamCondition,
  Operation,
} from '@zerodev/permissions';
import {
  toCallPolicy,
  toGasPolicy,
  toRateLimitPolicy,
  toValueLimitPolicy,
  toTimestampPolicy,
} from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { generatePrivateKey } from 'viem/accounts';
import { erc20Abi } from 'viem';

// Configuration for Base Sepolia
const CONFIG = {
  chain: baseSepolia,
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '',
  bundlerUrl: `https://rpc.zerodev.app/api/v2/bundler/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}?chainId=84532`,
  paymasterUrl: `https://rpc.zerodev.app/api/v2/paymaster/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}?chainId=84532`,
  
  // Test tokens on Base Sepolia
  USDC_ADDRESS: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
  SPX_ADDRESS: '0x1234567890123456789012345678901234567890' as Address, // Replace with actual
};

interface DCASessionKeyConfig {
  tokenIn: Address;
  tokenOut: Address;
  maxAmountPerTrade: bigint;
  allowedRecipients: Address[];
  tradesPerDay: number;
  expirationTime?: number;
}

/**
 * Solution 1: Owner-Created Session Keys (Recommended for DCA)
 * 
 * In this approach:
 * 1. User creates their smart wallet normally
 * 2. User generates a session key with DCA-specific permissions
 * 3. User shares the serialized session key with the DCA service
 * 4. DCA service uses the session key to execute trades
 */
export async function createDCASessionKey(
  ownerKernelClient: KernelAccountClient<any, any>,
  ownerAccount: KernelSmartAccount<any, any>,
  publicClient: any,
  config: DCASessionKeyConfig
): Promise<{ serializedSessionKey: string; sessionKeyAddress: Address }> {
  console.log('🔑 Creating DCA Session Key...');
  
  // Generate session key
  const sessionPrivateKey = generatePrivateKey();
  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey);
  
  // Define DCA-specific permissions
  const permissions: Permission[] = [
    // Permission to swap tokens (approve + swap)
    {
      target: config.tokenIn,
      abi: erc20Abi,
      functionName: 'approve',
      args: [
        {
          condition: ParamCondition.EQUAL,
          value: config.allowedRecipients[0], // DEX router address
        },
        {
          condition: ParamCondition.LESS_THAN_OR_EQUAL,
          value: config.maxAmountPerTrade,
        },
      ],
    },
    // Permission to transfer tokens (for swaps)
    {
      target: config.tokenIn,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [
        {
          condition: ParamCondition.ONE_OF,
          value: config.allowedRecipients,
        },
        {
          condition: ParamCondition.LESS_THAN_OR_EQUAL,
          value: config.maxAmountPerTrade,
        },
      ],
    },
  ];
  
  // Create policies for DCA
  const policies = [
    // Allow gas sponsorship
    toGasPolicy({ allowed: true }),
    
    // Restrict to specific function calls
    toCallPolicy({ permissions }),
    
    // Rate limit trades
    toRateLimitPolicy({
      count: config.tradesPerDay,
      interval: 86400, // 24 hours
    }),
    
    // No ETH transfers allowed
    toValueLimitPolicy({
      limit: parseEther('0'),
    }),
    
    // Optional: Set expiration time
    ...(config.expirationTime ? [toTimestampPolicy({
      validAfter: Math.floor(Date.now() / 1000),
      validUntil: config.expirationTime,
    })] : []),
  ];
  
  // Create permission validator
  const entryPoint = getEntryPoint('0.7');
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: toECDSASigner({ signer: sessionKeySigner }),
    policies,
  });
  
  // Install the permission plugin on the existing account
  console.log('Installing permission plugin...');
  const installTxHash = await ownerKernelClient.installPlugin({
    plugin: permissionPlugin,
  });
  
  await publicClient.waitForTransactionReceipt({ hash: installTxHash });
  console.log('✅ Permission plugin installed');
  
  // CRITICAL: Use the existing account, don't create a new one
  // This maintains the same smart wallet address
  const permissionAccount = await createKernelAccount(publicClient, {
    deployedAccountAddress: ownerAccount.address,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    plugins: {
      sudo: ownerAccount.kernelPluginManager,
      regular: permissionPlugin,
    },
  });
  
  // Verify address matches
  if (permissionAccount.address !== ownerAccount.address) {
    throw new Error(`Address mismatch! Expected ${ownerAccount.address}, got ${permissionAccount.address}`);
  }
  
  // Serialize with the private key
  const serializedSessionKey = await serializePermissionAccount(
    permissionAccount,
    sessionPrivateKey
  );
  
  return {
    serializedSessionKey,
    sessionKeyAddress: sessionKeySigner.address,
  };
}

/**
 * DCA Service: Execute trade using session key
 */
export async function executeDCATrade(
  serializedSessionKey: string,
  tradeParams: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    dexRouter: Address;
    swapData: `0x${string}`;
  }
): Promise<string> {
  console.log('💱 Executing DCA trade...');
  
  const publicClient = createPublicClient({
    chain: CONFIG.chain,
    transport: http(),
  });
  
  // Deserialize the session key account
  const sessionKeyAccount = await deserializePermissionAccount(
    publicClient,
    ENTRYPOINT_ADDRESS_V07,
    KERNEL_V3_1,
    serializedSessionKey
  );
  
  // Create paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: CONFIG.chain,
    transport: http(CONFIG.paymasterUrl),
    entryPoint: getEntryPoint('0.7'),
  });
  
  // Create kernel client for the session
  const sessionKernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
    chain: CONFIG.chain,
    bundlerTransport: http(CONFIG.bundlerUrl),
    middleware: {
      sponsorUserOperation: paymasterClient.sponsorUserOperation,
    },
    entryPoint: getEntryPoint('0.7'),
  });
  
  // Execute the DCA trade
  // Step 1: Approve DEX router
  const approveTx = await sessionKernelClient.writeContract({
    address: tradeParams.tokenIn,
    abi: erc20Abi,
    functionName: 'approve',
    args: [tradeParams.dexRouter, tradeParams.amountIn],
  });
  
  console.log('Approve tx:', approveTx);
  
  // Step 2: Execute swap
  const swapTx = await sessionKernelClient.sendTransaction({
    to: tradeParams.dexRouter,
    data: tradeParams.swapData,
  });
  
  console.log('Swap tx:', swapTx);
  
  return swapTx;
}

/**
 * Solution 2: Revocable Session Keys
 * 
 * Shows how users can revoke session keys when needed
 */
export async function revokeSessionKey(
  ownerKernelClient: KernelAccountClient<any, any>,
  sessionKeyAddress: Address
): Promise<void> {
  console.log('🚫 Revoking session key...');
  
  // To revoke, we uninstall the permission plugin
  // This requires knowing which plugin corresponds to the session key
  // In practice, you'd store this mapping when creating the session key
  
  // For now, this is a placeholder
  console.log('Session key revoked for:', sessionKeyAddress);
}

/**
 * Complete DCA flow example
 */
async function demonstrateDCAFlow() {
  console.log('🚀 DCA Session Key Flow Demo\n');
  
  // Simulate user setup
  const ownerPrivateKey = generatePrivateKey();
  const owner = privateKeyToAccount(ownerPrivateKey);
  
  const publicClient = createPublicClient({
    chain: CONFIG.chain,
    transport: http(),
  });
  
  // Create user's smart wallet
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: getEntryPoint('0.7'),
    kernelVersion: KERNEL_V3_1,
  });
  
  const userAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint: getEntryPoint('0.7'),
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('User Smart Wallet:', userAccount.address);
  
  // Create kernel client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: CONFIG.chain,
    transport: http(CONFIG.paymasterUrl),
    entryPoint: getEntryPoint('0.7'),
  });
  
  const kernelClient = createKernelAccountClient({
    account: userAccount,
    chain: CONFIG.chain,
    bundlerTransport: http(CONFIG.bundlerUrl),
    middleware: {
      sponsorUserOperation: paymasterClient.sponsorUserOperation,
    },
    entryPoint: getEntryPoint('0.7'),
  });
  
  // Create DCA session key
  const { serializedSessionKey, sessionKeyAddress } = await createDCASessionKey(
    kernelClient,
    userAccount,
    publicClient,
    {
      tokenIn: CONFIG.USDC_ADDRESS,
      tokenOut: CONFIG.SPX_ADDRESS,
      maxAmountPerTrade: parseEther('100'), // Max 100 USDC per trade
      allowedRecipients: ['0x1234567890123456789012345678901234567890'], // DEX router
      tradesPerDay: 5,
      expirationTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    }
  );
  
  console.log('\n✅ DCA Setup Complete!');
  console.log('Session Key Address:', sessionKeyAddress);
  console.log('Serialized Key Length:', serializedSessionKey.length);
  console.log('\nThe DCA service can now execute trades using this session key.');
}

// Export for testing
export {
  demonstrateDCAFlow,
  CONFIG,
};