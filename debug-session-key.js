// Debug session key approval data
const BASE_URL = 'http://localhost:3000';

async function debugSessionKey() {
  console.log('🔍 Debugging session key approval...');

  try {
    const agentKeyId = 'session_1752720108055_slxz0jq';

    const response = await fetch(`${BASE_URL}/api/debug-agent-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentKeyId }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Session key data retrieved');
      console.log(
        'Session key approval length:',
        data.sessionKeyApprovalLength,
      );

      // Decode the base64 session key approval
      const approval = data.sessionKeyApproval;
      const decoded = Buffer.from(approval, 'base64').toString('utf-8');
      console.log('Decoded approval structure:', decoded.slice(0, 200) + '...');

      // Parse the JSON
      try {
        const parsedApproval = JSON.parse(decoded);
        console.log('Parsed approval structure:');
        console.log('  Permission params:', parsedApproval.permissionParams);
        console.log('  Action:', parsedApproval.action);
        console.log('  Validity data:', parsedApproval.validityData);
        console.log('  Account params:', parsedApproval.accountParams);
        console.log(
          '  Enable signature present:',
          !!parsedApproval.enableSignature,
        );
        console.log('  Private key present:', !!parsedApproval.privateKey);

        // Check if account address matches
        const accountAddress = parsedApproval.accountParams?.accountAddress;
        console.log('Account address from approval:', accountAddress);
        console.log(
          'Expected smart wallet:',
          '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE',
        );
        console.log(
          'Addresses match:',
          accountAddress?.toLowerCase() ===
            '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE'.toLowerCase(),
        );
      } catch (e) {
        console.error('❌ Failed to parse approval JSON:', e.message);
      }
    } else {
      console.log('❌ Failed to get session key data:', data.error);
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugSessionKey();
