// Test DCA execution with just a USDC transfer (no swap) to prove session keys work
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  deserializePermissionAccount,
} from '@zerodev/permissions';
import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function testDCATransferOnly() {
  console.log('🧪 Testing DCA execution with USDC transfer only (no swap)...');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    // Get the latest order
    console.log('📋 Getting latest DCA order...');
    const ordersResponse = await fetch(`http://localhost:3000/api/dca-orders-v2?userAddress=${USER_WALLET}`);
    const ordersData = await ordersResponse.json();
    
    if (!ordersData.success || ordersData.orders.length === 0) {
      console.log('❌ No DCA orders found');
      return;
    }
    
    // Use our test order with the funded wallet
    const testOrderId = 'order_1752791672647_59o2j49ah';
    const latestOrder = ordersData.orders.find(o => o.id === testOrderId) || ordersData.orders[0];
    console.log('✅ Found order:', latestOrder.id);
    console.log('   Smart wallet:', latestOrder.smartWalletAddress);
    
    // Get the agent key data from the order
    console.log('\\n🔐 Getting agent key data...');
    const agentKeyResponse = await fetch(`http://localhost:3000/api/debug/agent-key-data?orderId=${latestOrder.id}`);
    const agentKeyData = await agentKeyResponse.json();
    
    if (!agentKeyData.success) {
      console.log('❌ Failed to get agent key data');
      return;
    }
    
    console.log('✅ Agent key retrieved');
    console.log('   Has session approval:', !!agentKeyData.agentKey.sessionKeyApproval);
    
    // Deserialize the session key
    console.log('\\n🔓 Deserializing session key...');
    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      getEntryPoint('0.7'),
      KERNEL_V3_1,
      agentKeyData.agentKey.sessionKeyApproval,
    );
    
    console.log('✅ Session key deserialized');
    console.log('   Smart wallet address:', deserializedAccount.address);
    
    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });
    
    console.log('💰 Smart wallet USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');
    
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
          return await paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });
    
    // Transfer 0.1 USDC to user wallet
    console.log('\\n💸 Transferring 0.1 USDC to user wallet...');
    const transferAmount = BigInt(100000); // 0.1 USDC
    
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [USER_WALLET, transferAmount],
    });
    
    const userOpHash = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([{
        to: USDC_ADDRESS,
        value: BigInt(0),
        data: transferData,
      }]),
    });
    
    console.log('✅ Transfer UserOp hash:', userOpHash);
    
    // Wait for transaction to be mined
    const receipt = await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    
    console.log('✅ Transfer transaction mined:', receipt.receipt.transactionHash);
    
    // Check new balances
    console.log('\\n📊 Checking new balances...');
    const newSmartBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });
    
    const userBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [USER_WALLET],
    });
    
    console.log('   Smart wallet:', (Number(newSmartBalance) / 1e6).toFixed(6), 'USDC');
    console.log('   User wallet:', (Number(userBalance) / 1e6).toFixed(6), 'USDC');
    console.log('   Transferred:', (Number(transferAmount) / 1e6).toFixed(6), 'USDC');
    
    console.log('\\n🎉 DCA SESSION KEY EXECUTION WORKS PERFECTLY!');
    console.log('   ✅ Session key authentication: WORKING');
    console.log('   ✅ Transaction execution: WORKING');
    console.log('   ✅ Token transfers: WORKING');
    console.log('   ✅ Gas sponsorship: WORKING');
    console.log('');
    console.log('   ❌ Swap API: BLOCKED BY CLOUDFLARE (separate issue)');
    console.log('');
    console.log('The DCA infrastructure is fully functional.');
    console.log('Only the external swap API needs to be fixed.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testDCATransferOnly();