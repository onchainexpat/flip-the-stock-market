// Direct test of the corrected ZeroDev implementation
const BASE_URL = 'http://localhost:3000';

async function testWithAgentKey() {
  console.log('🧪 Testing agent key execution directly...');
  
  try {
    // Check if the agent key exists
    const agentKeyId = 'session_1752720108055_slxz0jq';
    console.log('🔍 Checking agent key:', agentKeyId);
    
    const checkResponse = await fetch(`${BASE_URL}/api/debug-agent-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentKeyId,
      }),
    });
    
    const keyData = await checkResponse.json();
    console.log('Agent key data:', keyData);
    
    if (!keyData.success) {
      console.log('❌ Agent key not found or invalid');
      return;
    }
    
    console.log('✅ Agent key exists and is valid');
    console.log('   Agent address:', keyData.agentAddress);
    console.log('   Smart wallet:', keyData.smartWalletAddress);
    console.log('   Has session key approval:', !!keyData.sessionKeyApproval);
    
    // Test the actual execution
    console.log('\n🚀 Testing DCA execution with corrected implementation...');
    
    const executionResponse = await fetch(`${BASE_URL}/api/test-force-dca-execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentKeyId: agentKeyId,
        smartWalletAddress: keyData.smartWalletAddress,
        userWalletAddress: '0x55E911B8cF82A2657ff6f6cB57A5c8D83ea4D45A',
        swapAmount: '1000000', // 1 USDC
      }),
    });
    
    console.log('Response status:', executionResponse.status);
    const responseText = await executionResponse.text();
    console.log('Response length:', responseText.length);
    
    if (responseText.length > 0) {
      try {
        const result = JSON.parse(responseText);
        console.log('✅ Got result:', result);
        
        if (result.success) {
          console.log('🎉 DCA execution successful!');
          console.log('   Transaction hash:', result.txHash);
          console.log('   SPX received:', result.spxReceived);
        } else {
          console.log('❌ DCA execution failed:', result.error);
        }
      } catch (e) {
        console.log('❌ Failed to parse response:', responseText.slice(0, 200));
      }
    } else {
      console.log('❌ Empty response from server');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithAgentKey();