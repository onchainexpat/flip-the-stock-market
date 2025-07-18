// Create session key for existing smart wallet with USDC balance
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
import { http, createPublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// The existing smart wallet that has USDC balance
const EXISTING_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';

async function createSessionKeyForExistingWallet() {
  console.log('🔑 Creating session key for existing smart wallet with USDC...');
  console.log('   Target smart wallet:', EXISTING_SMART_WALLET);
  console.log('   User wallet:', USER_WALLET);
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    // Check USDC balance first
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [EXISTING_SMART_WALLET],
    });
    
    console.log('💰 Existing smart wallet USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');
    
    if (usdcBalance < 1000000n) {
      console.log('❌ Insufficient USDC balance for DCA execution');
      return;
    }
    
    // Generate new session key for this existing wallet
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    
    console.log('🔑 Generated session key address:', sessionKeyAccount.address);
    
    // Create session key approval data manually
    const sessionKeyApprovalData = {
      sessionKeyAddress: sessionKeyAccount.address,
      smartWalletAddress: EXISTING_SMART_WALLET,
      privateKey: sessionPrivateKey,
      // Add timestamp and other metadata
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
    
    // Create serialized session key data (simulating the correct client-side format)
    const serializedSessionKey = JSON.stringify(sessionKeyApprovalData);
    const base64SessionKey = Buffer.from(serializedSessionKey).toString('base64');
    
    console.log('📦 Session key data created');
    console.log('   Serialized length:', base64SessionKey.length);
    
    // Create agent key directly via server service
    const agentKeyId = `agent_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('📝 Creating agent key via API...');
    
    const agentKeyResponse = await fetch('http://localhost:3000/api/agent-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: agentKeyId,
        agentAddress: sessionKeyAccount.address,
        smartWalletAddress: EXISTING_SMART_WALLET,
        userAddress: USER_WALLET,
        encryptedPrivateKey: sessionPrivateKey, // Will be encrypted by the service
        sessionKeyApproval: base64SessionKey,
        isActive: true,
      }),
    });
    
    const agentKeyResult = await agentKeyResponse.json();
    
    if (agentKeyResult.success) {
      console.log('✅ Agent key created successfully');
      console.log('   Agent key ID:', agentKeyId);
      
      // Create DCA order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('📝 Creating DCA order...');
      
      const orderResponse = await fetch('http://localhost:3000/api/dca-orders-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: EXISTING_SMART_WALLET,
          totalAmount: '1000000', // 1 USDC
          frequency: 'daily',
          duration: 1,
          agentKeyId: agentKeyId,
        }),
      });
      
      const orderResult = await orderResponse.json();
      
      if (orderResult.success) {
        console.log('✅ DCA order created successfully');
        console.log('   Order ID:', orderResult.orderId);
        
        // Test execution immediately
        console.log('\\n🧪 Testing DCA execution with existing smart wallet...');
        
        const testResponse = await fetch(`http://localhost:3000/api/test-force-dca-execution?orderId=${orderResult.orderId}`);
        
        if (testResponse.ok) {
          const testResult = await testResponse.json();
          console.log('✅ DCA execution result:', testResult.success ? 'SUCCESS' : 'FAILED');
          
          if (testResult.success) {
            console.log('🎉 Complete DCA execution successful!');
            console.log('   Transaction hash:', testResult.result?.txHash);
            console.log('   SPX received:', testResult.result?.spxReceived);
            console.log('   All transactions:', testResult.result?.transactions);
          } else {
            console.log('❌ DCA execution failed:', testResult.result?.error?.substring(0, 500));
          }
        } else {
          console.log('❌ DCA execution test failed:', testResponse.status);
        }
        
      } else {
        console.log('❌ Failed to create DCA order:', orderResult.error);
      }
      
    } else {
      console.log('❌ Failed to create agent key:', agentKeyResult.error);
    }
    
  } catch (error) {
    console.error('❌ Session key creation failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

createSessionKeyForExistingWallet();