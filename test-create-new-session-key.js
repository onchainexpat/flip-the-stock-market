// Test creating a new session key from scratch
const BASE_URL = 'http://localhost:3000';

async function testCreateNewSessionKey() {
  console.log('🧪 Testing creation of new session key...');

  try {
    // Create a new agent key and test it
    const userAddress = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
    const smartWalletAddress = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

    console.log('1️⃣ Creating new agent key...');
    const createResponse = await fetch(
      `${BASE_URL}/api/store-gelato-agent-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          smartWalletAddress,
          totalAmount: '1000000', // 1 USDC
          durationDays: 1,
        }),
      },
    );

    const createResult = await createResponse.json();

    if (createResult.success) {
      console.log('✅ New agent key created:', createResult.agentKeyId);
      console.log('   Smart wallet:', createResult.smartWalletAddress);

      // Test execution with new key
      console.log('\n2️⃣ Testing execution with new key...');

      // We need to create a test order with this new key
      // For now, let's just test if the key is valid
      const debugResponse = await fetch(`${BASE_URL}/api/debug-agent-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKeyId: createResult.agentKeyId }),
      });

      const debugResult = await debugResponse.json();

      if (debugResult.success) {
        console.log('✅ New agent key is valid');
        console.log('   Has private key:', debugResult.hasPrivateKey);
        console.log(
          '   Has session approval:',
          debugResult.hasSessionKeyApproval,
        );
        console.log(
          '   Session approval length:',
          debugResult.sessionKeyApprovalLength,
        );
      } else {
        console.log('❌ New agent key validation failed:', debugResult.error);
      }
    } else {
      console.log('❌ Failed to create new agent key:', createResult.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCreateNewSessionKey();
