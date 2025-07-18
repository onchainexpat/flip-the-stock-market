// Test proper ZeroDev session key creation for existing smart wallet
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccount } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// The existing smart wallet that has USDC balance
const EXISTING_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// This is the private key that was originally used to create the smart wallet
// We need to use the same owner key to create session keys for the existing wallet
const ORIGINAL_OWNER_KEY =
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function testProperSessionKey() {
  console.log('🧪 Testing proper ZeroDev session key creation...');
  console.log('   Target smart wallet:', EXISTING_SMART_WALLET);
  console.log('   User wallet:', USER_WALLET);

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [EXISTING_SMART_WALLET],
    });

    console.log(
      '💰 Smart wallet USDC balance:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );

    const ownerSigner = privateKeyToAccount(ORIGINAL_OWNER_KEY);
    const entryPoint = getEntryPoint('0.7');

    console.log('👤 Owner address:', ownerSigner.address);

    // Generate new session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });

    console.log('🔑 Session key address:', sessionKeyAccount.address);

    // Create the master account with the original owner key
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
    console.log('   Expected existing wallet:', EXISTING_SMART_WALLET);
    console.log(
      '   Addresses match:',
      masterAccount.address.toLowerCase() ===
        EXISTING_SMART_WALLET.toLowerCase(),
    );

    if (
      masterAccount.address.toLowerCase() !==
      EXISTING_SMART_WALLET.toLowerCase()
    ) {
      console.log('❌ Master account does not match existing smart wallet');
      console.log(
        '   This means we need to use a different owner key or approach',
      );
      return;
    }

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
    console.log(
      '   Should match existing wallet:',
      sessionKeyAccount2.address.toLowerCase() ===
        EXISTING_SMART_WALLET.toLowerCase(),
    );

    // Serialize session key (with private key)
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );

    console.log(
      '📦 Serialized session key length:',
      serializedSessionKey.length,
    );

    // Test deserialization
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

    // Store the session key
    console.log('📝 Storing session key...');

    const storeResponse = await fetch(
      'http://localhost:3000/api/store-client-session-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: EXISTING_SMART_WALLET,
          sessionPrivateKey: sessionPrivateKey,
          sessionKeyApproval: serializedSessionKey,
          agentAddress: sessionKeyAccount.address,
        }),
      },
    );

    const storeResult = await storeResponse.json();

    if (storeResult.success) {
      console.log('✅ Session key stored successfully');
      console.log('   Agent key ID:', storeResult.agentKeyId);

      // Create DCA order
      console.log('📝 Creating DCA order...');

      const orderResponse = await fetch(
        'http://localhost:3000/api/dca-orders-v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: USER_WALLET,
            smartWalletAddress: EXISTING_SMART_WALLET,
            totalAmount: '1000000', // 1 USDC
            frequency: 'daily',
            duration: 1,
            agentKeyId: storeResult.agentKeyId,
          }),
        },
      );

      const orderResult = await orderResponse.json();

      if (orderResult.success) {
        const actualOrderId = orderResult.order?.id;
        console.log('✅ DCA order created successfully');
        console.log('   Order ID:', actualOrderId);

        // Test execution
        console.log('\\n🧪 Testing DCA execution...');

        const testResponse = await fetch(
          `http://localhost:3000/api/test-force-dca-execution?orderId=${actualOrderId}`,
        );

        if (testResponse.ok) {
          const testResult = await testResponse.json();
          console.log(
            '✅ DCA execution result:',
            testResult.success ? 'SUCCESS' : 'FAILED',
          );

          if (testResult.success) {
            console.log('🎉 Complete DCA execution successful!');
            console.log('   Transaction hash:', testResult.result?.txHash);
            console.log('   SPX received:', testResult.result?.spxReceived);
            console.log(
              '   All transactions:',
              testResult.result?.transactions,
            );
          } else {
            console.log(
              '❌ DCA execution failed:',
              testResult.result?.error?.substring(0, 500),
            );
          }
        } else {
          console.log('❌ DCA execution test failed:', testResponse.status);
        }
      } else {
        console.log('❌ Failed to create DCA order:', orderResult.error);
      }
    } else {
      console.log('❌ Failed to store session key:', storeResult.error);
    }
  } catch (error) {
    console.error('❌ Proper session key test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testProperSessionKey();
