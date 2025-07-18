// Test different transaction targets to see what works
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

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

async function testTransactionTargets() {
  console.log('🧪 Testing different transaction targets...');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    const ownerSigner = privateKeyToAccount(OWNER_PRIVATE_KEY);
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
    
    console.log('🏠 Smart wallet address:', masterAccount.address);
    
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
    
    // Serialize and deserialize
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );
    
    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      serializedSessionKey,
    );
    
    console.log('🔓 Deserialized account address:', deserializedAccount.address);
    
    // Create kernel client
    const paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    const kernelClient = createKernelAccountClient({
      account: deserializedAccount,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC),
      paymaster: {
        getPaymasterData: async (userOperation) => {
          return await paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });
    
    // Test 1: Transaction to zeroAddress (working pattern from standalone test)
    console.log('\\n🧪 Test 1: Transaction to zeroAddress...');
    try {
      const userOpHash1 = await kernelClient.sendUserOperation({
        callData: await deserializedAccount.encodeCalls([{
          to: zeroAddress,
          value: BigInt(0),
          data: '0x',
        }]),
      });
      
      console.log('✅ Test 1 SUCCESS - UserOp hash:', userOpHash1);
      
      await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash1,
      });
      
      console.log('✅ Test 1 transaction mined successfully!');
      
    } catch (error) {
      console.log('❌ Test 1 FAILED:', error.message.substring(0, 100));
    }
    
    // Test 2: Transaction to self (failing pattern from server-side)
    console.log('\\n🧪 Test 2: Transaction to self...');
    try {
      const userOpHash2 = await kernelClient.sendUserOperation({
        callData: await deserializedAccount.encodeCalls([{
          to: deserializedAccount.address,
          value: BigInt(0),
          data: '0x',
        }]),
      });
      
      console.log('✅ Test 2 SUCCESS - UserOp hash:', userOpHash2);
      
      await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash2,
      });
      
      console.log('✅ Test 2 transaction mined successfully!');
      
    } catch (error) {
      console.log('❌ Test 2 FAILED:', error.message.substring(0, 100));
    }
    
    // Test 3: Let's try a different pattern - no transaction at all
    console.log('\\n🧪 Test 3: Empty callData...');
    try {
      const userOpHash3 = await kernelClient.sendUserOperation({
        callData: '0x',
      });
      
      console.log('✅ Test 3 SUCCESS - UserOp hash:', userOpHash3);
      
      await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash3,
      });
      
      console.log('✅ Test 3 transaction mined successfully!');
      
    } catch (error) {
      console.log('❌ Test 3 FAILED:', error.message.substring(0, 100));
    }
    
  } catch (error) {
    console.error('❌ Transaction target test failed:', error.message);
  }
}

testTransactionTargets();