// Simple test to isolate ZeroDev SDK issue
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

async function testZeroDevConnection() {
  console.log('🧪 Testing ZeroDev RPC connection...');
  console.log('   RPC URL:', ZERODEV_RPC_URL);

  try {
    // Test basic RPC connection
    console.log('1️⃣ Testing basic RPC call...');
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL, {
        timeout: 5000,
        retryCount: 1,
      }),
    });

    const blockNumber = await publicClient.getBlockNumber();
    console.log('   ✅ Block number:', blockNumber.toString());

    // Test gas price
    console.log('2️⃣ Testing gas price...');
    const gasPrice = await publicClient.getGasPrice();
    console.log('   ✅ Gas price:', gasPrice.toString());

    // Test balance check
    console.log('3️⃣ Testing balance check...');
    const balance = await publicClient.getBalance({
      address: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE',
    });
    console.log('   ✅ ETH balance:', balance.toString());

    console.log('✅ ZeroDev RPC connection is working!');
  } catch (error) {
    console.error('❌ ZeroDev RPC test failed:', error.message);

    // Test alternative RPC
    console.log('🔄 Testing standard Base RPC...');
    try {
      const altClient = createPublicClient({
        chain: base,
        transport: http('https://mainnet.base.org', {
          timeout: 5000,
        }),
      });

      const altBlock = await altClient.getBlockNumber();
      console.log('   ✅ Standard RPC works, block:', altBlock.toString());
      console.log('   💡 Issue is likely with ZeroDev RPC endpoint');
    } catch (altError) {
      console.error('   ❌ Standard RPC also failed:', altError.message);
      console.log('   💡 Network connectivity issue');
    }
  }
}

testZeroDevConnection();
