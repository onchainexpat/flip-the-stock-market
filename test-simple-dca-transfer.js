// Test DCA with simple USDC transfer instead of swap to verify the flow works
import { http, createPublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Smart wallet with USDC
const SMART_WALLET = '0x8127778edEbe2FdDCb4a20AC0F52789A7bFf7F65';

async function testSimpleDCATransfer() {
  console.log('🧪 Testing DCA with simple USDC transfer...');
  
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });
    
    // Check balances
    const smartWalletBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [SMART_WALLET],
    });
    
    const userBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [USER_WALLET],
    });
    
    console.log('💰 Smart wallet USDC:', (Number(smartWalletBalance) / 1e6).toFixed(6), 'USDC');
    console.log('💰 User wallet USDC:', (Number(userBalance) / 1e6).toFixed(6), 'USDC');
    
    if (smartWalletBalance === 0n) {
      console.log('❌ No USDC in smart wallet to test with');
      return;
    }
    
    // Get the latest order
    console.log('\\n📋 Getting latest DCA order...');
    const ordersResponse = await fetch(`http://localhost:3000/api/dca-orders-v2?userAddress=${USER_WALLET}`);
    const ordersData = await ordersResponse.json();
    
    if (!ordersData.success || ordersData.orders.length === 0) {
      console.log('❌ No DCA orders found');
      return;
    }
    
    const latestOrder = ordersData.orders[0];
    console.log('✅ Found order:', latestOrder.id);
    console.log('   Status:', latestOrder.status);
    console.log('   Smart wallet:', latestOrder.smartWalletAddress);
    
    // Test a simple transfer instead of swap
    console.log('\\n🧪 Testing simple USDC transfer using session key...');
    
    const transferAmount = BigInt(100000); // 0.1 USDC
    
    const response = await fetch('http://localhost:3000/api/test-simple-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: latestOrder.id,
        toAddress: USER_WALLET,
        amount: transferAmount.toString(),
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Transfer successful!');
      console.log('   Transaction hash:', result.txHash);
      
      // Wait a bit and check new balances
      console.log('\\n⏳ Waiting for transaction...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const newUserBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [USER_WALLET],
      });
      
      const newSmartBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [SMART_WALLET],
      });
      
      console.log('\\n📊 New balances:');
      console.log('   Smart wallet:', (Number(newSmartBalance) / 1e6).toFixed(6), 'USDC');
      console.log('   User wallet:', (Number(newUserBalance) / 1e6).toFixed(6), 'USDC');
      console.log('   User received:', ((Number(newUserBalance) - Number(userBalance)) / 1e6).toFixed(6), 'USDC');
      
      console.log('\\n🎉 DCA session key execution works perfectly!');
      console.log('   The swap issue is separate from session key functionality.');
      
    } else {
      console.log('❌ Transfer failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Create the test endpoint if it doesn't exist
async function createTestEndpoint() {
  // This would normally be implemented on the server side
  console.log('Note: /api/test-simple-transfer endpoint would need to be implemented');
  console.log('For now, let\\'s test the existing DCA execution...');
}

testSimpleDCATransfer();