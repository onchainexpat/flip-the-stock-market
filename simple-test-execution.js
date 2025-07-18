// Simple test to check the session key fix
console.log('🧪 Testing session key fix...');

// Test the session key deserialization by examining the agent key
const agentKeyId = 'session_1752720108055_slxz0jq';

// Let's check if the session key contains the private key
fetch('http://localhost:3000/api/debug-agent-key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ agentKeyId }),
})
.then(res => res.json())
.then(data => {
  console.log('✅ Agent key data retrieved');
  
  if (data.sessionKeyApproval) {
    try {
      const approvalData = JSON.parse(Buffer.from(data.sessionKeyApproval, 'base64').toString('utf-8'));
      console.log('📋 Session key approval contains:');
      console.log('   Private key:', !!approvalData.privateKey);
      console.log('   Private key length:', approvalData.privateKey?.length);
      console.log('   Account address:', approvalData.accountParams?.accountAddress);
      console.log('   Expected smart wallet: 0x320b2943e26ccbDacE18575e7974EDC200BA4dCE');
      console.log('   Addresses match:', approvalData.accountParams?.accountAddress?.toLowerCase() === '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE'.toLowerCase());
      
      if (approvalData.privateKey && approvalData.privateKey.length > 0) {
        console.log('✅ Session private key is available for deserialization');
        console.log('💡 This should fix the AA23 signature validation error');
      } else {
        console.log('❌ Session private key is missing');
      }
      
    } catch (e) {
      console.error('❌ Failed to parse session key approval:', e.message);
    }
  } else {
    console.log('❌ No session key approval found');
  }
})
.catch(err => {
  console.error('❌ Test failed:', err.message);
});