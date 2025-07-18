// Check if smart wallet is deployed
const { createPublicClient, http, getContractCode } = require('viem');
const { base } = require('viem/chains');

async function checkSmartWalletDeployment() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const smartWalletAddress = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

  console.log('🔍 Checking smart wallet deployment...');
  console.log('   Address:', smartWalletAddress);

  try {
    const code = await publicClient.getCode({
      address: smartWalletAddress,
    });

    if (code && code !== '0x') {
      console.log('✅ Smart wallet is deployed');
      console.log('   Code length:', code.length);
      console.log('   First 100 chars:', code.substring(0, 100));
    } else {
      console.log('❌ Smart wallet is NOT deployed');
      console.log('   This could be why UserOperation is failing');
      console.log('   The wallet needs to be deployed first');
    }

    // Also check balance
    const balance = await publicClient.getBalance({
      address: smartWalletAddress,
    });

    console.log('\n💰 ETH Balance:', balance.toString(), 'wei');
    console.log('   In ETH:', Number(balance) / 1e18);
  } catch (error) {
    console.error('❌ Error checking deployment:', error.message);
  }
}

checkSmartWalletDeployment();
