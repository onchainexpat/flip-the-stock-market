#!/usr/bin/env bun

/**
 * Test DCA with deterministic wallet for consistent testing
 */

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
import { privateKeyToAccount } from 'viem/accounts';
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

// Test configuration
const TEST_CONFIG = {
  // Use a deterministic private key for testing (DO NOT USE IN PRODUCTION!)
  AGENT_PRIVATE_KEY:
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex,
  USER_WALLET: '0x742f96b3e80a4b3633c7f3ec5bd1b5f9b6b0123e' as Address,
  TEST_AMOUNT: 10000n, // 0.01 USDC
};

async function setupDeterministicWallet() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(ZERODEV_RPC_URL),
  });

  const agentAccount = privateKeyToAccount(TEST_CONFIG.AGENT_PRIVATE_KEY);
  console.log('🤖 Agent address:', agentAccount.address);

  // Create ECDSA validator
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: agentAccount,
    entryPoint: getEntryPoint('0.7'),
    kernelVersion: KERNEL_V3_2,
  });

  // Create kernel account
  const smartWallet = await createKernelAccount(publicClient, {
    entryPoint: getEntryPoint('0.7'),
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion: KERNEL_V3_2,
  });

  console.log('🏠 Smart wallet address:', smartWallet.address);
  console.log('');
  console.log('💡 This address will be the same every time you run this test.');
  console.log('💰 Fund this wallet with 0.01 USDC to test the DCA flow.');

  return {
    publicClient,
    smartWallet,
    agentAccount,
  };
}

async function checkBalance(publicClient: any, address: Address) {
  const balance = await publicClient.readContract({
    address: TOKENS.USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });
  return balance;
}

async function executeDCASwap(
  publicClient: any,
  smartWallet: any,
  agentAccount: any,
) {
  console.log('🚀 Executing DCA swap...');

  // Create kernel client
  const kernelClient = createKernelAccountClient({
    account: smartWallet,
    chain: base,
    bundlerTransport: http(ZERODEV_RPC_URL),
  });

  // Get swap quote
  const swapQuote = await getOpenOceanSwapQuote(
    TOKENS.USDC,
    TOKENS.SPX6900,
    TEST_CONFIG.TEST_AMOUNT,
    smartWallet.address,
    TEST_CONFIG.USER_WALLET,
  );

  if (!swapQuote.success) {
    throw new Error(`Failed to get swap quote: ${swapQuote.error}`);
  }

  console.log('💱 Swap quote received');
  console.log(`   Expected SPX output: ${swapQuote.expectedOutput}`);

  // Build transactions
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [OPENOCEAN_ROUTER, TEST_CONFIG.TEST_AMOUNT],
  });

  const transactions = [
    // Approve USDC
    {
      to: TOKENS.USDC,
      value: 0n,
      data: approveData,
    },
    // Execute swap
    {
      to: swapQuote.transaction!.to,
      value: BigInt(swapQuote.transaction!.value || '0'),
      data: swapQuote.transaction!.data,
    },
  ];

  console.log('📝 Executing batched transactions...');
  const txHash = await kernelClient.sendUserOperation({
    account: smartWallet,
    calls: transactions.map((tx) => ({
      to: tx.to,
      value: tx.value || 0n,
      data: tx.data,
    })),
  });

  console.log('✅ Transaction submitted:', txHash);
  return txHash;
}

async function getOpenOceanSwapQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address,
  receiverAddress: Address,
): Promise<any> {
  const requestBody = {
    sellToken,
    buyToken,
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
}

async function main() {
  console.log('🧪 DCA Test with Deterministic Wallet\n');

  try {
    // Setup wallet
    const { publicClient, smartWallet, agentAccount } =
      await setupDeterministicWallet();

    // Check balance
    const balance = await checkBalance(publicClient, smartWallet.address);
    console.log(`💰 USDC Balance: ${(Number(balance) / 1e6).toFixed(6)} USDC`);

    if (balance < TEST_CONFIG.TEST_AMOUNT) {
      console.log('\n⚠️ Insufficient balance for testing');
      console.log('📝 Please fund the smart wallet with at least 0.01 USDC');
      return;
    }

    console.log('\n✅ Sufficient balance found. Proceeding with DCA swap...\n');

    // Execute swap
    const txHash = await executeDCASwap(
      publicClient,
      smartWallet,
      agentAccount,
    );

    console.log('\n📊 Transaction Details:');
    console.log(`   Network: Base`);
    console.log(`   Transaction: ${txHash}`);
    console.log(`   View on Basescan: https://basescan.org/tx/${txHash}`);

    // Wait and check results
    console.log('\n⏳ Waiting for transaction confirmation...');
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const finalBalance = await checkBalance(publicClient, smartWallet.address);
    console.log(
      `\n💰 Final USDC Balance: ${(Number(finalBalance) / 1e6).toFixed(6)} USDC`,
    );
    console.log(
      `📉 USDC Spent: ${(Number(balance - finalBalance) / 1e6).toFixed(6)} USDC`,
    );

    console.log('\n✅ DCA swap completed successfully!');
    console.log(
      '📤 SPX tokens should now be in the user wallet:',
      TEST_CONFIG.USER_WALLET,
    );
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

main();
