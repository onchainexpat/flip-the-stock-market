// Manual test of DCA execution with explicit gas limits
const BASE_URL = 'http://localhost:3000';

async function testManualExecution() {
  console.log('🧪 Testing manual DCA execution with explicit parameters...');

  const orderId = 'order_1752716497028_g4p9bcx2c';
  const smartWallet = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

  try {
    // Check current balance
    console.log('1️⃣ Checking smart wallet balance...');
    const balanceResponse = await fetch(
      `${BASE_URL}/api/check-wallet-balance?address=${smartWallet}`,
    );
    const balanceData = await balanceResponse.json();
    console.log(
      '   USDC Balance:',
      balanceData.balances?.usdc?.formatted || 'N/A',
    );

    // Test Aerodrome swap quote
    console.log('2️⃣ Testing Aerodrome swap quote...');
    const aerodromeResponse = await fetch(`${BASE_URL}/api/aerodrome-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        buyToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
        sellAmount: '3333333', // ~$3.33 (1/30th of $100)
        takerAddress: smartWallet,
      }),
    });

    if (aerodromeResponse.ok) {
      const aerodromeData = await aerodromeResponse.json();
      console.log('   ✅ Aerodrome quote successful');
      console.log('   Router:', aerodromeData.to);
      console.log('   Expected SPX:', aerodromeData.buyAmount);
      console.log('   Price impact:', aerodromeData.estimatedPriceImpact + '%');
    } else {
      console.log('   ❌ Aerodrome quote failed:', aerodromeResponse.status);
    }

    // Try a simple test execution endpoint
    console.log('3️⃣ Testing DCA execution...');
    const testResponse = await fetch(`${BASE_URL}/api/test-dca-execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderId,
        forceExecution: true,
        debug: true,
      }),
    });

    const testResult = await testResponse.json();
    console.log(
      '   Execution result:',
      testResult.success ? '✅ SUCCESS' : '❌ FAILED',
    );

    if (testResult.success) {
      console.log('   TX Hash:', testResult.txHash);
      console.log('   Gas Used:', testResult.gasUsed);
      console.log('   SPX Received:', testResult.spxReceived);
    } else {
      console.log('   Error:', testResult.error);

      if (testResult.error?.includes('UserOperation reverted')) {
        console.log('   🔧 Diagnosis: UserOperation simulation issue');
        console.log('   💡 Likely causes:');
        console.log('      - Gas parameters being overridden to 0');
        console.log('      - ZeroDev SDK configuration issue');
        console.log('      - Paymaster middleware not working correctly');
        console.log('      - Smart wallet permission issue');
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testManualExecution();
