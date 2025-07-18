// Create a working session key and store it directly in the database
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccount } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key (replace with actual if needed)
const PRIVATE_KEY =
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

async function createWorkingSessionKeyDirect() {
  console.log('🔑 Creating working session key and storing directly...');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const ownerSigner = privateKeyToAccount(PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');

    console.log('👤 Owner address:', ownerSigner.address);

    // Create session key (same as working standalone test)
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });

    console.log('🔑 Session key address:', sessionKeyAccount.address);

    // Create master account (owner account)
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

    // Serialize session key (with private key)
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );

    console.log(
      '📦 Serialized session key length:',
      serializedSessionKey.length,
    );

    // Create agent key and order via API calls
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agentKeyId = `agent_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📝 Creating agent key via API...');

    // First create the agent key
    const agentKeyResponse = await fetch(
      'http://localhost:3000/api/agent-keys',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: agentKeyId,
          agentAddress: sessionKeyAccount.address,
          smartWalletAddress: sessionKeyAccount2.address,
          userAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
          encryptedPrivateKey: sessionPrivateKey, // Will be encrypted by the service
          sessionKeyApproval: serializedSessionKey,
          isActive: true,
        }),
      },
    );

    const agentKeyResult = await agentKeyResponse.json();

    if (agentKeyResult.success) {
      console.log('✅ Agent key created successfully');

      // Now create the order
      console.log('📝 Creating DCA order...');

      const orderResponse = await fetch(
        'http://localhost:3000/api/dca-orders-v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
            smartWalletAddress: sessionKeyAccount2.address,
            totalAmount: '1000000', // 1 USDC
            frequency: 'daily',
            duration: 1,
            agentKeyId: agentKeyId,
          }),
        },
      );

      const orderResult = await orderResponse.json();

      if (orderResult.success) {
        console.log('✅ Order created successfully');
        console.log('   Order ID:', orderResult.orderId);

        // Test execution immediately
        console.log('\\n🧪 Testing execution with working session key...');
        const testResponse = await fetch(
          `http://localhost:3000/api/test-force-dca-execution?orderId=${orderResult.orderId}`,
        );

        if (testResponse.ok) {
          const testResult = await testResponse.json();
          console.log(
            '✅ Execution test result:',
            testResult.success ? 'SUCCESS' : 'FAILED',
          );
          if (testResult.success) {
            console.log('   Transaction hash:', testResult.result?.txHash);
          } else {
            console.log(
              '   Error:',
              testResult.result?.error?.substring(0, 500),
            );
          }
        } else {
          console.log('❌ Execution test failed:', testResponse.status);
        }
      } else {
        console.log('❌ Failed to create order:', orderResult.error);
      }
    } else {
      console.log('❌ Failed to create agent key:', agentKeyResult.error);
    }
  } catch (error) {
    console.error('❌ Working session key creation failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

createWorkingSessionKeyDirect();
