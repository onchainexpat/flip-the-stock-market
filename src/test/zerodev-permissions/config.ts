import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  ParamOperator,
  deserializePermissionAccount,
  serializePermissionAccount,
  toCallPolicy,
  toPermissionValidator,
} from '@zerodev/permissions';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, erc20Abi } from 'viem';
import { encodeFunctionData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Test configuration for Base mainnet (using small amounts for testing)
export const TEST_CONFIG = {
  // ZeroDev configuration
  ZERODEV_PROJECT_ID: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
  ZERODEV_RPC_URL: process.env.NEXT_PUBLIC_ZERODEV_RPC_URL!, // Use mainnet for testing

  // Test tokens on Base mainnet
  TOKENS: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const, // Base mainnet USDC
    SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as const, // Base mainnet SPX6900
  },

  // OpenOcean router on Base mainnet
  OPENOCEAN_ROUTER: '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as const,

  // Test amounts (very small for safety)
  TEST_USDC_AMOUNT: 1000n, // 0.001 USDC in wei (6 decimals)
  MIN_BALANCE_REQUIRED: 10000n, // 0.01 USDC minimum for tests
};

// Create public client for Base mainnet (use ZeroDev RPC URL for compatibility)
export const publicClient = createPublicClient({
  chain: base,
  transport: http(TEST_CONFIG.ZERODEV_RPC_URL),
});

// Create ZeroDev paymaster client
export const paymasterClient = createZeroDevPaymasterClient({
  chain: base,
  transport: http(TEST_CONFIG.ZERODEV_RPC_URL),
  entryPoint: getEntryPoint('0.7'),
});

// Export commonly used functions
export {
  generatePrivateKey,
  privateKeyToAccount,
  signerToEcdsaValidator,
  createKernelAccount,
  createKernelAccountClient,
  toPermissionValidator,
  toCallPolicy,
  serializePermissionAccount,
  deserializePermissionAccount,
  ParamOperator,
  getEntryPoint,
  KERNEL_V3_1,
  erc20Abi,
  encodeFunctionData,
};

// Utility function for logging with timestamps
export function log(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Utility function for checking USDC balance
export async function checkUSDCBalance(address: string): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: TEST_CONFIG.TOKENS.USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });

  log(
    `💰 USDC balance for ${address}: ${(Number(balance) / 1e6).toFixed(6)} USDC`,
  );
  return balance;
}
