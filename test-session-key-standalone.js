// Test session key creation and usage directly based on 1-click-trading.ts example
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
import { http, createPublicClient, zeroAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key (replace with actual if needed)
const PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

async function testSessionKeyStandalone() {
  console.log('🧪 Testing session key creation and usage (standalone)...');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    const ownerSigner = privateKeyToAccount(PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');
    
    console.log('👤 Owner address:', ownerSigner.address);
    
    // Step 1: Create session key (same as 1-click-trading.ts)
    console.log('🔑 Step 1: Creating session key...');
    
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });
    
    console.log('   Session key address:', sessionKeyAccount.address);
    
    // Step 2: Create master account (owner account)
    console.log('🏠 Step 2: Creating master account...');
    
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
    
    console.log('   Master account address:', masterAccount.address);
    
    // Step 3: Create permission validator
    console.log('🔐 Step 3: Creating permission validator...');
    
    const permissionPlugin = await toPermissionValidator(publicClient, {
      entryPoint,
      signer: sessionKeySigner,
      policies: [toSudoPolicy({})],
      kernelVersion: KERNEL_V3_1,
    });
    
    // Step 4: Create session key account
    console.log('🎯 Step 4: Creating session key account...');
    
    const sessionKeyAccount2 = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
        regular: permissionPlugin,
      },
      kernelVersion: KERNEL_V3_1,
    });
    
    console.log('   Session key account address:', sessionKeyAccount2.address);
    
    // Step 5: Serialize session key (with private key)
    console.log('📦 Step 5: Serializing session key...');
    
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );
    
    console.log('   Serialized length:', serializedSessionKey.length);
    
    // Step 6: Deserialize session key (without signer parameter)
    console.log('🔓 Step 6: Deserializing session key...');
    
    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      serializedSessionKey,
    );
    
    console.log('   Deserialized account address:', deserializedAccount.address);
    console.log('   Address match:', deserializedAccount.address === sessionKeyAccount2.address);
    
    // Step 7: Test transaction
    console.log('💸 Step 7: Testing transaction...');
    
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
    
    const userOpHash = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([
        {
          to: zeroAddress,
          value: BigInt(0),
          data: '0x',
        },
      ]),
    });
    
    console.log('✅ UserOp hash:', userOpHash);
    
    await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('🎉 Transaction completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testSessionKeyStandalone();