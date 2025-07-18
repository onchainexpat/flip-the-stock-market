// Debug the toECDSASigner function
import { toECDSASigner } from '@zerodev/permissions/signers';
import { privateKeyToAccount } from 'viem/accounts';

async function debugSigner() {
  console.log('🧪 Debugging toECDSASigner...');

  try {
    // Create a test account
    const testPrivateKey =
      '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
    const testAccount = privateKeyToAccount(testPrivateKey);
    console.log('Test account:', testAccount.address);

    // Test toECDSASigner
    console.log('Calling toECDSASigner...');
    const signer = await toECDSASigner({ signer: testAccount });

    console.log('Signer type:', typeof signer);
    console.log('Signer is function:', typeof signer === 'function');
    console.log('Signer keys:', Object.keys(signer || {}));

    if (typeof signer === 'function') {
      console.log('Calling signer function...');
      const actualSigner = await signer();
      console.log('Actual signer type:', typeof actualSigner);
      console.log('Actual signer keys:', Object.keys(actualSigner || {}));
    }

    // Test direct usage
    if (signer && typeof signer.signMessage === 'function') {
      console.log('✅ Signer has signMessage method');
    } else {
      console.log('❌ Signer does not have signMessage method');
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugSigner();
