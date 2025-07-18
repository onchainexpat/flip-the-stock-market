// Debug DCA execution step by step to find where it fails
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
import { http, createPublicClient, zeroAddress, encodeFunctionData, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';

// Common router addresses that might be used
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';

async function debugDCASteps() {
  console.log('🔍 Debugging DCA execution step by step...');
  
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
    
    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });
    
    console.log('💰 USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');
    
    if (usdcBalance === 0n) {
      console.log('❌ No USDC balance to test with');
      return;
    }
    
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
          console.log('🔍 UserOp before sponsorship:', {
            sender: userOperation.sender,
            nonce: userOperation.nonce,
            callDataLength: userOperation.callData.length,
          });
          return await paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });
    
    // Step 1: Test basic transaction (should work)
    console.log('\\n🧪 Step 1: Basic transaction test...');
    const testTx = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([{
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      }]),
    });
    
    console.log('✅ Step 1 SUCCESS - Test tx hash:', testTx);
    await kernelClient.waitForUserOperationReceipt({ hash: testTx });
    
    // Step 2: Test USDC approval for Aerodrome router
    console.log('\\n🧪 Step 2: USDC approval for Aerodrome router...');
    const swapAmount = BigInt(1000000); // 1 USDC
    
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [AERODROME_ROUTER, swapAmount],
    });
    
    try {
      const approveTx = await kernelClient.sendUserOperation({
        callData: await deserializedAccount.encodeCalls([{
          to: USDC_ADDRESS,
          value: BigInt(0),
          data: approveData,
        }]),
      });
      
      console.log('✅ Step 2 SUCCESS - Approval tx hash:', approveTx);
      await kernelClient.waitForUserOperationReceipt({ hash: approveTx });
      
      // Check allowance
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [deserializedAccount.address, AERODROME_ROUTER],
      });
      
      console.log('✅ Allowance set:', (Number(allowance) / 1e6).toFixed(6), 'USDC');
      
    } catch (error) {
      console.log('❌ Step 2 FAILED - Approval error:', error.message.substring(0, 200));
      return;
    }
    
    // Step 3: Get a real swap quote from the API
    console.log('\\n🧪 Step 3: Getting swap quote from OpenOcean...');
    
    try {
      const quoteResponse = await fetch('http://localhost:3000/api/openocean-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellToken: USDC_ADDRESS,
          buyToken: SPX_ADDRESS,
          sellAmount: swapAmount.toString(),
          takerAddress: deserializedAccount.address,
          slippagePercentage: 0.01, // 1%
        }),
      });
      const quoteData = await quoteResponse.json();
      
      if (!quoteData.success) {
        console.log('❌ Step 3 FAILED - Quote error:', quoteData.error);
        return;
      }
      
      console.log('✅ Step 3 SUCCESS - Got swap quote');
      console.log('   Router:', quoteData.data.to);
      console.log('   Expected output:', quoteData.data.outAmount);
      console.log('   Call data length:', quoteData.data.data.length);
      
      // Step 4: Test the actual swap transaction
      console.log('\\n🧪 Step 4: Testing swap transaction...');
      
      const swapTx = await kernelClient.sendUserOperation({
        callData: await deserializedAccount.encodeCalls([{
          to: quoteData.data.to,
          value: BigInt(quoteData.data.value || '0'),
          data: quoteData.data.data,
        }]),
      });
      
      console.log('✅ Step 4 SUCCESS - Swap tx hash:', swapTx);
      await kernelClient.waitForUserOperationReceipt({ hash: swapTx });
      
      // Check SPX balance
      const spxBalance = await publicClient.readContract({
        address: SPX_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [deserializedAccount.address],
      });
      
      console.log('✅ SPX received:', (Number(spxBalance) / 1e8).toFixed(8), 'SPX');
      console.log('🎉 Complete DCA step-by-step test successful!');
      
    } catch (swapError) {
      console.log('❌ Step 4 FAILED - Swap error:', swapError.message.substring(0, 300));
      
      // Let's try to understand what went wrong
      if (swapError.message.includes('simulation')) {
        console.log('\\n🔍 Simulation error - checking transaction data...');
        console.log('   Router address:', quoteData?.data?.to);
        console.log('   Value:', quoteData?.data?.value);
        console.log('   Data prefix:', quoteData?.data?.data?.substring(0, 20));
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

debugDCASteps();