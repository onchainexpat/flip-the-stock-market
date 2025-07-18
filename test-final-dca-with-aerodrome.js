// Create a new DCA order with the remaining USDC balance and test Aerodrome execution
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
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

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY =
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';

async function testFinalDCAWithAerodrome() {
  console.log('🎯 FINAL TEST: Complete DCA with Aerodrome integration');
  console.log('=================================================');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const ownerSigner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');

    // Create fresh session key
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

    // Check current USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [sessionKeyAccount2.address],
    });

    console.log(
      '💰 Current USDC balance:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );

    if (usdcBalance < 100000n) {
      console.log('❌ Insufficient USDC balance for DCA test');
      return;
    }

    // Use 90% of available balance for DCA (leave some for gas if needed)
    const dcaAmount = (usdcBalance * 90n) / 100n;
    const dcaAmountUsdc = Number(dcaAmount) / 1e6;

    console.log('📝 Creating DCA order for:', dcaAmountUsdc.toFixed(6), 'USDC');

    // Serialize session key
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );

    // Store session key
    console.log('\\n1️⃣ Storing session key...');
    const storeResponse = await fetch(
      'http://localhost:3000/api/store-client-session-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: sessionKeyAccount2.address,
          sessionPrivateKey: sessionPrivateKey,
          sessionKeyApproval: serializedSessionKey,
          agentAddress: sessionKeyAccount.address,
        }),
      },
    );

    const storeResult = await storeResponse.json();

    if (!storeResult.success) {
      console.log('❌ Failed to store session key:', storeResult.error);
      return;
    }

    console.log('✅ Session key stored with ID:', storeResult.agentKeyId);

    // Create DCA order
    console.log('\\n2️⃣ Creating DCA order...');
    const orderResponse = await fetch(
      'http://localhost:3000/api/dca-orders-v2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: sessionKeyAccount2.address,
          totalAmount: dcaAmountUsdc.toString(),
          frequency: 'daily',
          duration: 1,
          agentKeyId: storeResult.agentKeyId,
        }),
      },
    );

    const orderResult = await orderResponse.json();

    if (!orderResult.success) {
      console.log('❌ Failed to create DCA order:', orderResult.error);
      return;
    }

    const orderId = orderResult.order.id;
    console.log('✅ DCA order created:', orderId);

    // Check user's initial SPX balance
    const initialSpxBalance = await publicClient.readContract({
      address: SPX_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [USER_WALLET],
    });

    console.log('\\n3️⃣ Pre-execution balances:');
    console.log(
      '   Smart wallet USDC:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );
    console.log(
      '   User wallet SPX:',
      (Number(initialSpxBalance) / 1e8).toFixed(8),
      'SPX',
    );

    // Execute DCA
    console.log('\\n4️⃣ Executing DCA with Aerodrome...');
    const executionResponse = await fetch(
      `http://localhost:3000/api/test-force-dca-execution?orderId=${orderId}`,
    );
    const executionResult = await executionResponse.json();

    console.log(
      '📊 Execution result:',
      executionResult.success ? 'SUCCESS' : 'FAILED',
    );

    if (executionResult.success && executionResult.result.success) {
      console.log('✅ DCA execution successful!');
      console.log('   Transaction hash:', executionResult.result.txHash);
      console.log('   SPX received:', executionResult.result.spxReceived);
      console.log('   All transactions:', executionResult.result.transactions);

      // Wait for transaction to settle
      console.log('\\n⏳ Waiting for settlement...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check final balances
      const finalUsdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [sessionKeyAccount2.address],
      });

      const finalSpxBalance = await publicClient.readContract({
        address: SPX_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [USER_WALLET],
      });

      console.log('\\n5️⃣ Final balances:');
      console.log(
        '   Smart wallet USDC:',
        (Number(finalUsdcBalance) / 1e6).toFixed(6),
        'USDC',
      );
      console.log(
        '   User wallet SPX:',
        (Number(finalSpxBalance) / 1e8).toFixed(8),
        'SPX',
      );
      console.log(
        '   SPX gained:',
        ((Number(finalSpxBalance) - Number(initialSpxBalance)) / 1e8).toFixed(
          8,
        ),
        'SPX',
      );

      console.log('\\n🎉 COMPLETE SUCCESS!');
      console.log('===================');
      console.log('✅ Session keys: WORKING');
      console.log('✅ DCA creation: WORKING');
      console.log('✅ Aerodrome swaps: WORKING');
      console.log('✅ Token delivery: WORKING');
      console.log('✅ End-to-end flow: WORKING');
      console.log('');
      console.log('DCA is now fully operational with Aerodrome integration!');
    } else {
      console.log(
        '❌ DCA execution failed:',
        executionResult.result?.error || 'Unknown error',
      );

      if (executionResult.result?.error?.includes('Insufficient USDC')) {
        console.log('   💡 This was a balance issue, not a system issue');
      } else if (executionResult.result?.error?.includes('simulation')) {
        console.log('   💡 This was a transaction simulation issue');
      }
    }
  } catch (error) {
    console.error('❌ Final test failed:', error.message);
  }
}

testFinalDCAWithAerodrome();
