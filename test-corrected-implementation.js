// Test the corrected ZeroDev implementation via API
const BASE_URL = 'http://localhost:3000';

async function testCorrectedImplementation() {
  console.log('🧪 Testing corrected ZeroDev implementation...');

  // Test parameters
  const agentKeyId = 'session_1752720108055_slxz0jq'; // From previous session
  const smartWalletAddress = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
  const userWalletAddress = '0x55E911B8cF82A2657ff6f6cB57A5c8D83ea4D45A';
  const swapAmount = BigInt('1000000'); // 1 USDC

  console.log('📋 Test parameters:');
  console.log(`   Agent key ID: ${agentKeyId}`);
  console.log(`   Smart wallet: ${smartWalletAddress}`);
  console.log(`   User wallet: ${userWalletAddress}`);
  console.log(`   Swap amount: ${(Number(swapAmount) / 1e6).toFixed(6)} USDC`);

  try {
    console.log('\n🚀 Starting DCA execution...');

    // Test the corrected implementation via API
    const response = await fetch(`${BASE_URL}/api/test-force-dca-execution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentKeyId,
        smartWalletAddress,
        userWalletAddress,
        swapAmount: swapAmount.toString(),
      }),
    });

    const result = await response.json();

    console.log('\n📊 Execution result:');
    console.log('Success:', result.success);

    if (result.success) {
      console.log('✅ DCA execution completed successfully!');
      console.log('📝 Transaction details:');
      console.log('   Final tx hash:', result.txHash);
      console.log('   Swap amount:', result.swapAmount);
      console.log('   SPX received:', result.spxReceived);
      console.log('   All transactions:', result.transactions);
    } else {
      console.log('❌ DCA execution failed:');
      console.log('   Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCorrectedImplementation();
