// Test simple transaction with the working session key
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

async function testSimpleSessionTransaction() {
  console.log('🧪 Testing simple session transaction...');
  
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
    
    // Test a very simple transaction
    console.log('🧪 Testing simple self-transaction...');
    
    try {
      const userOpHash = await kernelClient.sendUserOperation({
        callData: await deserializedAccount.encodeCalls([{
          to: deserializedAccount.address,
          value: BigInt(0),
          data: '0x',
        }]),
      });
      
      console.log('✅ UserOp hash:', userOpHash);
      
      // Wait for transaction to be mined
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      
      console.log('✅ Transaction mined:', receipt.receipt.transactionHash);
      console.log('🎉 Simple session transaction successful!');
      
    } catch (error) {
      console.error('❌ Simple transaction failed:', error.message);
      
      // Log the error details
      if (error.message.includes('AA23')) {
        console.log('   This is still an AA23 signature validation error');
      } else if (error.message.includes('simulation')) {
        console.log('   This is a simulation error');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testSimpleSessionTransaction();