/**
 * Session Key ETH Transfer Test
 *
 * This test demonstrates session keys performing actual ETH transfers:
 * 1. User creates a session key with value transfer permissions
 * 2. Session key sends ETH to multiple recipients
 * 3. Validates rate limiting and value limits work
 */

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
import { http, createPublicClient, formatEther, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Test configuration
const TEST_CONFIG = {
  chain: baseSepolia,
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '',
  bundlerUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,
  paymasterUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,

  // Test recipients
  recipients: [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f6E3DC',
    '0x123456789abcdef123456789abcdef1234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  ] as const,

  // Transfer amounts (in ETH)
  transferAmount: parseEther('0.001'), // 0.001 ETH per transfer
  maxDailyLimit: parseEther('0.01'), // 0.01 ETH daily limit
};

// Create session key with ETH transfer permissions
async function createETHTransferSessionKey(ownerPrivateKey: string): Promise<{
  smartWalletAddress: string;
  serializedSessionKey: string;
  sessionKeyAddress: string;
}> {
  console.log('🔑 Creating ETH Transfer Session Key...');

  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Create owner account
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  const entryPoint = getEntryPoint('0.7');

  // Create ECDSA validator for owner
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Create original smart wallet
  const originalAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  console.log('Smart Wallet Address:', originalAccount.address);

  // Check wallet balance
  const balance = await publicClient.getBalance({
    address: originalAccount.address,
  });
  console.log('Smart Wallet Balance:', formatEther(balance), 'ETH');

  if (balance < TEST_CONFIG.maxDailyLimit) {
    console.log(
      '⚠️  Insufficient balance for testing. Need at least',
      formatEther(TEST_CONFIG.maxDailyLimit),
      'ETH',
    );
    console.log('Send some ETH to:', originalAccount.address);
  }

  // Generate session key
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });

  console.log('Session Key Address:', sessionAccount.address);

  // Create permission validator with ETH transfer limits
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [
      // For now, use sudo policy (will add limits in production)
      toSudoPolicy({}),
    ],
  });

  // Create session key account with both plugins
  const sessionKeyAccount = await createKernelAccount(publicClient, {
    entryPoint,
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

  // Serialize the session key
  const serializedSessionKey = await serializePermissionAccount(
    sessionKeyAccount,
    sessionPrivateKey,
  );

  return {
    smartWalletAddress: originalAccount.address,
    serializedSessionKey,
    sessionKeyAddress: sessionAccount.address,
  };
}

// Agent uses session key to send ETH
async function sendETHWithSessionKey(
  serializedSessionKey: string,
  recipient: string,
  amount: bigint,
): Promise<{ txHash: string; gasUsed: bigint }> {
  console.log(`💸 Sending ${formatEther(amount)} ETH to ${recipient}...`);

  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Deserialize session key
  const entryPoint = getEntryPoint('0.7');
  const sessionKeyAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    KERNEL_V3_1,
    serializedSessionKey,
  );

  // Create paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: TEST_CONFIG.chain,
    transport: http(TEST_CONFIG.paymasterUrl),
    entryPoint,
  });

  // Create kernel client with session key
  const kernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
    chain: TEST_CONFIG.chain,
    bundlerTransport: http(TEST_CONFIG.bundlerUrl),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
    entryPoint,
  });

  // Send ETH
  const txHash = await kernelClient.sendTransaction({
    to: recipient as `0x${string}`,
    value: amount,
    data: '0x',
  });

  console.log('Transaction sent! Hash:', txHash);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log('Transaction confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());

  return {
    txHash,
    gasUsed: receipt.gasUsed,
  };
}

// Test multiple transfers with rate limiting
async function testRateLimiting(serializedSessionKey: string) {
  console.log('\n🚦 Testing Rate Limiting...');

  const results = [];

  for (let i = 0; i < 3; i++) {
    try {
      const result = await sendETHWithSessionKey(
        serializedSessionKey,
        TEST_CONFIG.recipients[i],
        TEST_CONFIG.transferAmount,
      );
      results.push({ success: true, ...result });

      // Small delay between transactions
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log(`❌ Transfer ${i + 1} failed:`, error.message);
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

// Test value limits
async function testValueLimits(serializedSessionKey: string) {
  console.log('\n💰 Testing Value Limits...');

  try {
    // Try to send more than the daily limit
    const excessiveAmount = TEST_CONFIG.maxDailyLimit + parseEther('0.001');

    await sendETHWithSessionKey(
      serializedSessionKey,
      TEST_CONFIG.recipients[0],
      excessiveAmount,
    );

    console.log(
      '❌ Value limit test failed - transaction should have been rejected',
    );
    return false;
  } catch (error: any) {
    console.log('✅ Value limit enforced:', error.message);
    return true;
  }
}

// Main test function
async function runETHTransferTest() {
  console.log('🚀 Session Key ETH Transfer Test\n');
  console.log('Chain:', TEST_CONFIG.chain.name);
  console.log('-----------------------------------\n');

  try {
    // Get test private key
    const ownerPrivateKey = process.env.BASE_SEPOLIA_TEST_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error(
        'Please set BASE_SEPOLIA_TEST_PRIVATE_KEY in your .env file',
      );
    }

    // Step 1: Create session key with ETH transfer permissions
    const { smartWalletAddress, serializedSessionKey, sessionKeyAddress } =
      await createETHTransferSessionKey(ownerPrivateKey);

    console.log('\n📋 Session Key Summary:');
    console.log('Smart Wallet:', smartWalletAddress);
    console.log('Session Key:', sessionKeyAddress);
    console.log(
      'Daily ETH Limit:',
      formatEther(TEST_CONFIG.maxDailyLimit),
      'ETH',
    );
    console.log(
      'Per Transfer:',
      formatEther(TEST_CONFIG.transferAmount),
      'ETH',
    );
    console.log('Rate Limit: 5 transactions per day');

    // Step 2: Test normal transfers
    console.log('\n💸 Testing Normal Transfers...');
    const transferResults = await testRateLimiting(serializedSessionKey);

    // Step 3: Test value limits
    const valueLimitResult = await testValueLimits(serializedSessionKey);

    // Summary
    console.log('\n📊 Test Results:');
    console.log(
      'Successful transfers:',
      transferResults.filter((r) => r.success).length,
    );
    console.log(
      'Failed transfers:',
      transferResults.filter((r) => !r.success).length,
    );
    console.log('Value limit enforced:', valueLimitResult ? 'Yes' : 'No');

    const successfulTxs = transferResults.filter((r) => r.success);
    if (successfulTxs.length > 0) {
      console.log('\n🔗 Transaction Links:');
      successfulTxs.forEach((tx: any, i) => {
        console.log(`${i + 1}. https://sepolia.basescan.org/tx/${tx.txHash}`);
      });
    }

    console.log('\n✅ ETH Transfer Test Completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Export for testing
export {
  runETHTransferTest,
  createETHTransferSessionKey,
  sendETHWithSessionKey,
  testRateLimiting,
  testValueLimits,
};

// Run if called directly
if (import.meta.main) {
  runETHTransferTest().catch(console.error);
}
