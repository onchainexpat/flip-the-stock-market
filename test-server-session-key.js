// Test the exact same session key pattern as the server-side code
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
import { http, createPublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

async function testServerSessionKey() {
  console.log('🧪 Testing server-side session key pattern...');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    const ownerSigner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');
    
    console.log('👤 Owner address:', ownerSigner.address);
    
    // Step 1: Create session key exactly like the working test
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });
    
    console.log('🔑 Session key address:', sessionKeyAccount.address);
    
    // Step 2: Create master account
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
    
    // Step 3: Create permission validator
    const permissionPlugin = await toPermissionValidator(publicClient, {
      entryPoint,
      signer: sessionKeySigner,
      policies: [toSudoPolicy({})],
      kernelVersion: KERNEL_V3_1,
    });
    
    // Step 4: Create session key account
    const sessionKeyAccount2 = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
        regular: permissionPlugin,
      },
      kernelVersion: KERNEL_V3_1,
    });
    
    console.log('🎯 Session key account address:', sessionKeyAccount2.address);
    
    // Step 5: Serialize (with private key embedded)
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );
    
    console.log('📦 Serialized session key length:', serializedSessionKey.length);
    
    // Step 6: Deserialize WITHOUT session signer (like server-side code)
    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      serializedSessionKey,
      // NO session signer parameter - private key is embedded
    );
    
    console.log('🔓 Deserialized account address:', deserializedAccount.address);
    console.log('   Address match:', deserializedAccount.address === sessionKeyAccount2.address);
    
    // Step 7: Create kernel client exactly like server-side
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
          console.log('🔍 UserOperation before sponsorship:', {
            sender: userOperation.sender,
            nonce: userOperation.nonce,
            callDataLength: userOperation.callData.length,
            maxFeePerGas: userOperation.maxFeePerGas,
            maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
          });
          
          const sponsorResult = await paymasterClient.sponsorUserOperation({ userOperation });
          console.log('✅ Sponsorship result:', {
            paymaster: sponsorResult.paymaster,
            paymasterDataLength: sponsorResult.paymasterData?.length,
          });
          return sponsorResult;
        },
      },
    });
    
    // Step 8: Test simple transaction (exactly like server-side code)
    console.log('🧪 Testing simple self-transaction...');
    
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
    console.log('🎉 Server-side session key pattern works!');
    
  } catch (error) {
    console.error('❌ Server-side session key test failed:', error.message);
    
    // Log specific error details
    if (error.message.includes('AA23')) {
      console.log('   🔍 This is an AA23 signature validation error');
      console.log('   The session key signature is not being validated correctly');
    }
    
    if (error.message.includes('simulation')) {
      console.log('   🔍 This is a simulation error');
      console.log('   The UserOperation failed during simulation');
    }
    
    console.error('   Stack:', error.stack);
  }
}

testServerSessionKey();