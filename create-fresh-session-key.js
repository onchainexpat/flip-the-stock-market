// Create a fresh session key using the exact working pattern
const BASE_URL = 'http://localhost:3000';

async function createFreshSessionKey() {
  console.log('🔑 Creating fresh session key...');

  try {
    // Create a fresh session key for the current user
    const response = await fetch(`${BASE_URL}/api/create-gasless-session-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
        smartWalletAddress: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE',
        totalAmount: '1000000', // 1 USDC
        durationDays: 1,
        orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Add orderId
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Fresh session key created successfully');
      console.log('   Agent key ID:', result.agentKeyId);
      console.log('   Smart wallet:', result.smartWalletAddress);
      console.log('   Session key data length:', result.sessionKeyData?.length);

      // Test the new session key
      console.log('\n🧪 Testing new session key...');
      const testResponse = await fetch(`${BASE_URL}/api/debug-agent-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKeyId: result.agentKeyId }),
      });

      const testResult = await testResponse.json();
      if (testResult.success) {
        console.log('✅ New session key is valid');
        console.log('   Has private key:', testResult.hasPrivateKey);
        console.log(
          '   Has session approval:',
          testResult.hasSessionKeyApproval,
        );
        console.log(
          '   Session approval length:',
          testResult.sessionKeyApprovalLength,
        );

        // Create a new order with this session key
        console.log('\n📝 Creating new order with fresh session key...');
        const orderResponse = await fetch(`${BASE_URL}/api/dca-orders-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
            fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
            toToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
            totalAmount: '1000000',
            frequency: 'daily',
            duration: 1,
            destinationAddress: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
            sessionKeyData: result.sessionKeyData,
            agentKeyId: result.agentKeyId,
          }),
        });

        const orderResult = await orderResponse.json();
        if (orderResult.success) {
          console.log('✅ New order created with fresh session key');
          console.log('   Order ID:', orderResult.orderId);
          console.log('   Now ready for execution testing');
        } else {
          console.log('❌ Failed to create order:', orderResult.error);
        }
      } else {
        console.log('❌ New session key validation failed:', testResult.error);
      }
    } else {
      console.log('❌ Failed to create fresh session key:', result.error);
    }
  } catch (error) {
    console.error('❌ Fresh session key creation failed:', error.message);
  }
}

createFreshSessionKey();
