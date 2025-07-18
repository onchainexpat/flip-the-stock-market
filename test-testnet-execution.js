// Test execution on testnet using working pattern
const BASE_URL = 'http://localhost:3000';

async function testTestnetExecution() {
  console.log('🧪 Testing execution with testnet configuration...');
  
  try {
    // Create a test endpoint that forces testnet config
    console.log('1️⃣ Testing Aerodrome quote on mainnet (for reference)...');
    const aerodromeResponse = await fetch(`${BASE_URL}/api/aerodrome-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        buyToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
        sellAmount: '1000000', // 1 USDC
        takerAddress: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE',
      }),
    });
    
    if (aerodromeResponse.ok) {
      const aerodromeData = await aerodromeResponse.json();
      console.log('   ✅ Mainnet Aerodrome quote works');
      console.log('   Expected SPX:', aerodromeData.buyAmount);
    } else {
      console.log('   ❌ Mainnet Aerodrome failed');
    }
    
    console.log('\n2️⃣ Key insight: Working examples use Sepolia testnet');
    console.log('   All ZeroDev examples: sepolia (chain ID 11155111)');
    console.log('   Our mainnet: base (chain ID 8453)');
    console.log('   Our testnet: base-sepolia (chain ID 84532)');
    
    console.log('\n3️⃣ Theory: Mainnet gas estimation differs from testnet');
    console.log('   Working examples have automatic gas estimation');
    console.log('   Mainnet might require explicit gas configuration');
    
    console.log('\n4️⃣ Current UserOperation shows:');
    console.log('   maxFeePerGas: 0x0 ❌');
    console.log('   maxPriorityFeePerGas: 0x0 ❌');
    console.log('   But paymaster sponsorship is working ✅');
    
    console.log('\n💡 Solutions to try:');
    console.log('   A) Add middleware back with proper gas estimation');
    console.log('   B) Use Base Sepolia testnet (84532) to test');
    console.log('   C) Check if mainnet needs different entry point');
    
    // Check current gas prices on Base mainnet
    console.log('\n⛽ Current Base mainnet gas prices:');
    try {
      const gasPriceResponse = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'eth_gasPrice',
          params: [],
          id: 1,
          jsonrpc: '2.0'
        })
      });
      
      if (gasPriceResponse.ok) {
        const gasPriceData = await gasPriceResponse.json();
        const gasPrice = parseInt(gasPriceData.result, 16);
        console.log(`   Current gas price: ${gasPrice} wei (${gasPrice / 1e9} gwei)`);
        console.log(`   Suggested maxFeePerGas: ${gasPrice * 2} wei (${(gasPrice * 2) / 1e9} gwei)`);
      }
    } catch (error) {
      console.log('   ❌ Failed to get gas price:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTestnetExecution();