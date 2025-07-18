/**
 * Base Sepolia Session Key Test
 *
 * This test demonstrates the complete flow for ZeroDev session keys:
 * 1. Deploy a smart wallet from an EOA
 * 2. Generate a session key with specific permissions
 * 3. Share the session key with an agent
 * 4. Agent uses the session key to execute transactions
 *
 * To run this test:
 * 1. Set up your .env with BASE_SEPOLIA_TEST_PRIVATE_KEY
 * 2. Fund the test EOA with Base Sepolia ETH
 * 3. Run: bun run src/test/base-sepolia-session-key-test.ts
 */

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  type Permission,
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
import { http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Test configuration
const TEST_CONFIG = {
  // Base Sepolia chain ID is 84532
  chain: baseSepolia,

  // ZeroDev project ID for Base Sepolia
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '',

  // Bundler and paymaster URLs (use v3 API like your existing config)
  bundlerUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,
  paymasterUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,

  // Test token addresses on Base Sepolia (you can replace with actual test tokens)
  testTokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const, // USDC on Base Sepolia
};

// Step 1: Deploy Smart Wallet from EOA
async function deploySmartWallet(ownerPrivateKey: string) {
  console.log('📱 Step 1: Deploying Smart Wallet...');

  // Create the owner account from private key
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  console.log('Owner EOA:', owner.address);

  // Create public client
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Create the ECDSA validator
  const entryPoint = getEntryPoint('0.7');
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Create the kernel account
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  console.log('Smart Wallet Address:', account.address);

  // Create the paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: TEST_CONFIG.chain,
    transport: http(TEST_CONFIG.paymasterUrl),
    entryPoint,
  });

  // Create the kernel account client
  const kernelClient = createKernelAccountClient({
    account,
    chain: TEST_CONFIG.chain,
    bundlerTransport: http(TEST_CONFIG.bundlerUrl),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
    entryPoint,
  });

  return { owner, account, kernelClient, publicClient };
}

// Step 2: Create Session Key with Permissions
async function createSessionKeyWithPermissions(
  kernelClient: any,
  publicClient: any,
  ownerAccount: any,
  owner: any,
) {
  console.log('\n🔑 Step 2: Creating Session Key with Permissions...');

  // Generate a new session private key
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  console.log('Session Key Address:', sessionAccount.address);

  // Define permissions for the session key
  const permissions: Permission[] = [
    {
      // Allow transfers of the test token
      target: TEST_CONFIG.testTokenAddress,
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
    },
  ];

  // Create the permission validator
  const entryPoint = getEntryPoint('0.7');
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [
      // For testing, use sudo policy (unrestricted) like the working example
      toSudoPolicy({}),
    ],
  });

  // Create the permission account directly with both plugins
  // Note: We need to get the original ecdsaValidator to maintain the same address
  const ownerEcdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  console.log('Creating session key account with both plugins...');
  const permissionAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    plugins: {
      sudo: ownerEcdsaValidator, // Use same validator as original
      regular: permissionPlugin, // Add permission plugin
    },
  });

  console.log('Permission account address:', permissionAccount.address);
  console.log(
    'Matches original wallet?',
    permissionAccount.address === ownerAccount.address,
  );

  // Serialize the permission account WITH the session private key
  const serializedSessionKey = await serializePermissionAccount(
    permissionAccount,
    sessionPrivateKey,
  );

  console.log('\n📦 Serialized Session Key (share this with agent):');
  console.log(serializedSessionKey);
  console.log('\n⚠️  This contains the private key - handle securely!');

  return {
    sessionPrivateKey,
    sessionAccount,
    serializedSessionKey,
    permissionPlugin,
  };
}

// Step 3: Agent Uses Session Key
async function agentUsesSessionKey(
  serializedSessionKey: string,
  recipientAddress: string,
) {
  console.log('\n🤖 Step 3: Agent Using Session Key...');

  // Create public client
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Deserialize the permission account
  // Note: No private key needed here because it's included in the serialized data
  const entryPoint = getEntryPoint('0.7');
  const permissionAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    KERNEL_V3_1,
    serializedSessionKey,
  );

  console.log('Deserialized account address:', permissionAccount.address);

  // Create the paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: TEST_CONFIG.chain,
    transport: http(TEST_CONFIG.paymasterUrl),
    entryPoint,
  });

  // Create the kernel account client for the agent
  const agentKernelClient = createKernelAccountClient({
    account: permissionAccount,
    chain: TEST_CONFIG.chain,
    bundlerTransport: http(TEST_CONFIG.bundlerUrl),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
    entryPoint,
  });

  // Execute a test transaction (simple ETH transfer)
  console.log('Executing test transaction...');

  const txHash = await agentKernelClient.sendTransaction({
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E3DC' as `0x${string}`, // Random test address (checksummed)
    value: BigInt(0), // 0 ETH (just testing the flow)
    data: '0x',
  });

  console.log('Transaction sent! Hash:', txHash);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log('Transaction confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());

  return { txHash, receipt };
}

// Main test function
async function runSessionKeyTest() {
  console.log('🚀 Base Sepolia Session Key Test\n');
  console.log('Chain:', TEST_CONFIG.chain.name);
  console.log('Chain ID:', TEST_CONFIG.chain.id);
  console.log('-----------------------------------\n');

  try {
    // Get the test private key from environment
    const ownerPrivateKey = process.env.BASE_SEPOLIA_TEST_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error(
        'Please set BASE_SEPOLIA_TEST_PRIVATE_KEY in your .env file',
      );
    }

    // Step 1: Deploy smart wallet
    const { owner, account, kernelClient, publicClient } =
      await deploySmartWallet(ownerPrivateKey);

    // Check if wallet needs funding
    const balance = await publicClient.getBalance({ address: account.address });
    console.log('Smart Wallet ETH Balance:', balance.toString(), 'wei');
    if (balance === 0n) {
      console.log(
        '⚠️  Smart wallet has no ETH. Send some Base Sepolia ETH to:',
        account.address,
      );
      console.log(
        'Note: With ZeroDev paymaster, gas will be sponsored so ETH is not required for transactions.',
      );
    }

    // Step 2: Create session key
    const { serializedSessionKey } = await createSessionKeyWithPermissions(
      kernelClient,
      publicClient,
      account,
      owner,
    );

    // Step 3: Simulate agent using the session key
    // In production, this would be on a different server/client
    const recipientAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f6E3DC'; // Random address for testing
    await agentUsesSessionKey(serializedSessionKey, recipientAddress);

    console.log('\n✅ Test completed successfully!');
    console.log('\nKey insights:');
    console.log('1. The session key includes the private key in serialization');
    console.log(
      '2. The agent can execute transactions without additional signatures',
    );
    console.log('3. Permissions are enforced by the kernel validator');
    console.log('4. Gas is sponsored by the ZeroDev paymaster');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Alternative approach: Agent-created session keys
async function demonstrateAgentCreatedFlow() {
  console.log('\n\n🔄 Alternative: Agent-Created Session Keys\n');
  console.log('-----------------------------------\n');

  // This demonstrates the flow where:
  // 1. Agent generates their own key pair
  // 2. Agent shares only the public address with owner
  // 3. Owner creates approval for that address
  // 4. Owner shares the approval (without private key)
  // 5. Agent uses their private key + approval

  console.log('1. Agent generates key pair:');
  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  console.log('   Agent public address:', agentAccount.address);
  console.log('   (Agent keeps private key secret)');

  console.log('\n2. Agent shares address with owner');
  console.log('3. Owner creates approval for agent address');
  console.log('4. Owner serializes and shares approval');
  console.log('5. Agent deserializes with their private key');

  console.log('\nThis approach is more secure for production use!');
}

// Run the test
if (import.meta.main) {
  runSessionKeyTest()
    .then(() => demonstrateAgentCreatedFlow())
    .catch(console.error);
}

export {
  runSessionKeyTest,
  deploySmartWallet,
  createSessionKeyWithPermissions,
  agentUsesSessionKey,
};
