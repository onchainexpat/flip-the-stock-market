// Test if your EOA can create session keys for your existing smart wallet
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
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Your actual addresses
const YOUR_EOA = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const YOUR_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

// Test different possible private keys that might have created your smart wallet
const TEST_KEYS = [
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318', // Test key I was using
  // Add more test keys if needed
];

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function testYourEOASmartWallet() {
  console.log('🔍 Testing which private key created your smart wallet...');
  console.log('   Your EOA:', YOUR_EOA);
  console.log('   Your Smart Wallet:', YOUR_SMART_WALLET);
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    // Check USDC balance of your smart wallet
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [YOUR_SMART_WALLET],
    });
    
    console.log('💰 Your smart wallet USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');
    
    const entryPoint = getEntryPoint('0.7');
    
    // Test each possible private key
    for (let i = 0; i < TEST_KEYS.length; i++) {
      const testKey = TEST_KEYS[i];
      console.log(`\\n🧪 Testing key ${i + 1}:`, testKey.substring(0, 10) + '...');
      
      try {
        const ownerSigner = privateKeyToAccount(testKey);
        console.log('   Owner address:', ownerSigner.address);
        
        // Create ECDSA validator
        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
          entryPoint,
          signer: ownerSigner,
          kernelVersion: KERNEL_V3_1,
        });
        
        // Create kernel account
        const masterAccount = await createKernelAccount(publicClient, {
          entryPoint,
          plugins: {
            sudo: ecdsaValidator,
          },
          kernelVersion: KERNEL_V3_1,
        });
        
        console.log('   Generated smart wallet:', masterAccount.address);
        console.log('   Matches your wallet:', masterAccount.address.toLowerCase() === YOUR_SMART_WALLET.toLowerCase());
        
        if (masterAccount.address.toLowerCase() === YOUR_SMART_WALLET.toLowerCase()) {
          console.log('\\n🎉 FOUND THE CORRECT KEY!');
          console.log('   This private key created your smart wallet');
          console.log('   You can now create session keys for your existing smart wallet');
          
          // Create a working session key for your actual smart wallet
          console.log('\\n🔑 Creating session key for your smart wallet...');
          
          const sessionPrivateKey = generatePrivateKey();
          const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
          const sessionKeySigner = await toECDSASigner({
            signer: sessionKeyAccount,
          });
          
          console.log('   Session key address:', sessionKeyAccount.address);
          
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
          
          console.log('   Session key account address:', sessionKeyAccount2.address);
          console.log('   Should match your smart wallet:', sessionKeyAccount2.address.toLowerCase() === YOUR_SMART_WALLET.toLowerCase());
          
          // Serialize session key
          const serializedSessionKey = await serializePermissionAccount(
            sessionKeyAccount2,
            sessionPrivateKey,
          );
          
          console.log('   Serialized session key length:', serializedSessionKey.length);
          
          // Test deserialization
          const deserializedAccount = await deserializePermissionAccount(
            publicClient,
            entryPoint,
            KERNEL_V3_1,
            serializedSessionKey,
          );
          
          console.log('   Deserialized address:', deserializedAccount.address);
          console.log('   Address match:', deserializedAccount.address === sessionKeyAccount2.address);
          
          if (deserializedAccount.address === sessionKeyAccount2.address) {
            console.log('\\n✅ SUCCESS! Session key works for your smart wallet');
            console.log('   You can now use this to create a working DCA order');
            console.log('   Smart wallet address:', YOUR_SMART_WALLET);
            console.log('   Session private key:', sessionPrivateKey);
            console.log('   Serialized session key (first 100 chars):', serializedSessionKey.substring(0, 100) + '...');
            
            return {
              success: true,
              ownerKey: testKey,
              sessionPrivateKey,
              serializedSessionKey,
              smartWalletAddress: YOUR_SMART_WALLET,
            };
          }
        }
        
      } catch (error) {
        console.log('   ❌ Error with this key:', error.message);
      }
    }
    
    console.log('\\n❌ None of the test keys created your smart wallet');
    console.log('   This means your smart wallet was created with a different private key');
    console.log('   OR it was created with different ZeroDev configuration');
    console.log('\\n💡 Solutions:');
    console.log('   1. Use the client-side UI to create a new session key for your existing smart wallet');
    console.log('   2. Or continue testing with the new smart wallet that has the working session key');
    
    return { success: false };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false };
  }
}

testYourEOASmartWallet().then(result => {
  if (result.success) {
    console.log('\\n🎯 RECOMMENDATION: Use your existing smart wallet with the working session key');
  } else {
    console.log('\\n🎯 RECOMMENDATION: Continue testing with the new smart wallet, then migrate');
  }
});