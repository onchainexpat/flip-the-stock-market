// Test creating a real 24-hour DCA order
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function test24HourDCA() {
  console.log('🕐 Creating 24-hour DCA order');
  console.log('============================');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    const ownerSigner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');
    
    // Create new session key for this order
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });
    
    console.log('🔑 Creating new session key...');
    console.log('   Session key address:', sessionKeyAccount.address);
    
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
    
    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [sessionKeyAccount2.address],
    });
    
    console.log('💰 Smart wallet USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');
    
    // Serialize session key
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );
    
    // Store session key
    console.log('\\n📝 Storing session key...');
    const storeResponse = await fetch('http://localhost:3000/api/store-client-session-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: USER_WALLET,
        smartWalletAddress: sessionKeyAccount2.address,
        sessionPrivateKey: sessionPrivateKey,
        sessionKeyApproval: serializedSessionKey,
        agentAddress: sessionKeyAccount.address,
      }),
    });
    
    const storeResult = await storeResponse.json();
    
    if (!storeResult.success) {
      console.log('❌ Failed to store session key:', storeResult.error);
      return;
    }
    
    console.log('✅ Session key stored with ID:', storeResult.agentKeyId);
    
    // Create 24-hour DCA order
    console.log('\\n🕐 Creating 24-hour DCA order...');
    
    // Calculate a reasonable DCA amount based on available balance
    const availableAmount = Number(usdcBalance) / 1e6;
    let dcaAmount;
    
    if (availableAmount >= 1.0) {
      dcaAmount = '0.5'; // Use 0.5 USDC for DCA if we have enough
    } else if (availableAmount >= 0.1) {
      dcaAmount = (availableAmount * 0.8).toFixed(6); // Use 80% of available
    } else {
      dcaAmount = '0.01'; // Minimum test amount
    }
    
    console.log('   DCA amount:', dcaAmount, 'USDC');
    console.log('   Frequency: Daily (24 hours)');
    console.log('   Duration: 3 days (3 executions)');
    
    const orderResponse = await fetch('http://localhost:3000/api/dca-orders-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: USER_WALLET,
        smartWalletAddress: sessionKeyAccount2.address,
        totalAmount: dcaAmount,
        frequency: 'daily', // 24-hour frequency
        duration: 3, // 3 days = 3 executions
        agentKeyId: storeResult.agentKeyId,
      }),
    });
    
    const orderResult = await orderResponse.json();
    
    if (!orderResult.success) {
      console.log('❌ Failed to create DCA order:', orderResult.error);
      return;
    }
    
    const orderId = orderResult.order.id;
    console.log('\\n✅ 24-hour DCA order created successfully!');
    console.log('   Order ID:', orderId);
    console.log('   Smart wallet:', orderResult.order.smartWalletAddress);
    console.log('   Total amount:', orderResult.order.totalAmount, 'USDC');
    console.log('   Per execution:', orderResult.order.amountPerExecution, 'USDC');
    console.log('   Next execution:', orderResult.order.nextExecutionAt);
    console.log('   Expires:', orderResult.order.expiresAt);
    
    // Test immediate execution to verify it works
    console.log('\\n🧪 Testing immediate execution to verify functionality...');
    const testResponse = await fetch(`http://localhost:3000/api/test-force-dca-execution?orderId=${orderId}`);
    const testResult = await testResponse.json();
    
    if (testResult.success && testResult.result.success) {
      console.log('✅ Test execution successful!');
      console.log('   Transaction:', testResult.result.txHash);
      console.log('   SPX received:', testResult.result.spxReceived);
      
      console.log('\\n🎉 COMPLETE SUCCESS!');
      console.log('===================');
      console.log('✅ 24-hour DCA order is fully functional!');
      console.log('✅ Automated execution works!');
      console.log('✅ Aerodrome integration works!');
      console.log('\\nThe order will now execute automatically every 24 hours');
      console.log('until completed or expired.');
      
    } else {
      console.log('⚠️ Test execution failed, but order is created');
      console.log('   Error:', testResult.result?.error);
      console.log('\\nThe order is still valid and will be attempted');
      console.log('during the next cron execution cycle.');
    }
    
    // Show funding instructions if needed
    if (availableAmount < 0.1) {
      console.log('\\n💡 TO FUND THE DCA ORDER:');
      console.log('   Send USDC to:', sessionKeyAccount2.address);
      console.log('   Network: Base');
      console.log('   Token: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)');
      console.log('   The order will execute automatically once funded!');
    }
    
  } catch (error) {
    console.error('❌ 24-hour DCA test failed:', error.message);
  }
}

test24HourDCA();