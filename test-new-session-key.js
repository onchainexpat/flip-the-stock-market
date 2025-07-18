// Test creating a new session key with corrected serialization
const BASE_URL = 'http://localhost:3000';

async function createNewSessionKey() {
  console.log('🔑 Creating new session key with corrected serialization...');

  try {
    // Create a new DCA order with corrected session key serialization
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📝 Creating new order with corrected session key:', orderId);

    const response = await fetch(`${BASE_URL}/api/dca-orders-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
        fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        toToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
        totalAmount: '1000000', // 1 USDC
        frequency: 'daily',
        duration: 1,
        destinationAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
        provider: 'zerodev',
        // We'll let the API create the session key with corrected serialization
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ New order created successfully');
      console.log('   Order ID:', result.orderId);
      console.log('   Agent Key ID:', result.agentKeyId);
      console.log('   Smart Wallet:', result.smartWalletAddress);

      // Test execution immediately
      console.log('\\n🧪 Testing execution with new session key...');
      const testResponse = await fetch(
        `${BASE_URL}/api/test-force-dca-execution?orderId=${result.orderId}`,
      );

      if (testResponse.ok) {
        const testResult = await testResponse.text();
        console.log('✅ Execution test result:', testResult.substring(0, 1000));
      } else {
        console.log('❌ Execution test failed:', testResponse.status);
      }
    } else {
      console.log('❌ Failed to create new order:', result.error);
    }
  } catch (error) {
    console.error('❌ New session key creation failed:', error.message);
  }
}

createNewSessionKey();
