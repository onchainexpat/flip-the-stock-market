// Test direct execution with a working session key
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
import { http, createPublicClient, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key (replace with actual if needed)
const PRIVATE_KEY =
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';

async function testDirectExecution() {
  console.log('🧪 Testing direct execution with working session key...');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const ownerSigner = privateKeyToAccount(PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');

    console.log('👤 Owner address:', ownerSigner.address);

    // Create session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });

    console.log('🔑 Session key address:', sessionKeyAccount.address);

    // Create master account
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      entryPoint,
      signer: ownerSigner,
      kernelVersion: KERNEL_V3_1,
    });

    const masterAccount = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
      },
      kernelVersion: KERNEL_V3_1,
    });

    console.log('🏠 Master account address:', masterAccount.address);

    // Create permission validator
    const permissionPlugin = await toPermissionValidator(publicClient, {
      entryPoint,
      signer: sessionKeySigner,
      policies: [toSudoPolicy({})],
      kernelVersion: KERNEL_V3_1,
    });

    // Create session key account
    const sessionKeyAccount2 = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
        regular: permissionPlugin,
      },
      kernelVersion: KERNEL_V3_1,
    });

    console.log('🎯 Session key account address:', sessionKeyAccount2.address);

    // Serialize and deserialize to test the exact pattern
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );

    console.log(
      '📦 Serialized session key length:',
      serializedSessionKey.length,
    );

    // Deserialize (this is what our server code does)
    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      serializedSessionKey,
    );

    console.log(
      '🔓 Deserialized account address:',
      deserializedAccount.address,
    );
    console.log(
      '   Address match:',
      deserializedAccount.address === sessionKeyAccount2.address,
    );

    // Check balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });

    console.log(
      '💰 USDC balance:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );

    if (usdcBalance < 1000000n) {
      console.log('❌ Insufficient USDC balance for test');
      return;
    }

    // Create kernel client for execution
    const kernelPaymaster = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const kernelClient = createKernelAccountClient({
      account: deserializedAccount,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC),
      paymaster: {
        getPaymasterData(userOperation) {
          return kernelPaymaster.sponsorUserOperation({ userOperation });
        },
      },
    });

    console.log('✅ Kernel client created');

    // Test a simple transaction first
    console.log('🧪 Testing simple transaction...');

    const testUserOpHash = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([
        {
          to: deserializedAccount.address,
          value: BigInt(0),
          data: '0x',
        },
      ]),
    });

    console.log('✅ Test UserOp hash:', testUserOpHash);

    // Wait for test to be mined
    const testReceipt = await kernelClient.waitForUserOperationReceipt({
      hash: testUserOpHash,
    });

    console.log('✅ Test tx mined:', testReceipt.receipt.transactionHash);
    console.log('🎉 Session key execution working! The fix is confirmed.');
  } catch (error) {
    console.error('❌ Direct execution test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testDirectExecution();
