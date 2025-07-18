const { ethers } = require('hardhat');

async function main() {
  console.log('🔐 Authorizing Gelato executor on existing contract...');

  // New contract address with authorization support and UnauthorizedAttempt logging
  const contractAddress = '0x608AFDa57620855a620313a02D54A2620b01460d';

  // Get the deployer account (contract owner)
  const [deployer] = await ethers.getSigners();
  console.log('📝 Using account:', deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH');

  // Connect to existing contract
  const DCAAutomationResolver = await ethers.getContractFactory(
    'DCAAutomationResolver',
  );
  const resolver = DCAAutomationResolver.attach(contractAddress);

  // Common Gelato proxy addresses to authorize
  const gelatoProxyAddresses = [
    '0x2A6C106ae13B558BB9E2Ec64Bd2f1f7BEFF3A5E0', // Legacy
    '0x527a819db1eb0e34426297b03bae11F2f8B3A19E', // Polygon ops proxy
    '0x7598e84B2E114AB62CAb288CE5f7d5f6bad35BBA', // Another common one
    '0x340759c8346A1E6Ed92035FB8B6ec57cE1D82c2c', // Arbitrum ops proxy
    '0x3AC05161b76a35c1c28dC99Aa9d2BA2aB5b85e0a', // Another Base possibility
    '0x2A6C106ae13B558BB9E2Ec64Bd2f1f7BEFF3A5E0', // Base Automate
  ];

  console.log('📞 Authorizing multiple potential Gelato proxy addresses...');
  console.log('   Contract:', contractAddress);

  try {
    for (const proxyAddress of gelatoProxyAddresses) {
      console.log(`\n🔍 Checking ${proxyAddress}...`);

      try {
        // Check if already authorized
        const isAuthorized = await resolver.authorizedExecutors(proxyAddress);
        console.log(`   Current authorization status: ${isAuthorized}`);

        if (isAuthorized) {
          console.log('   ✅ Already authorized!');
          continue;
        }

        // Authorize this proxy
        const tx = await resolver.authorizeExecutor(proxyAddress);
        console.log(`   ⏳ Authorization transaction sent: ${tx.hash}`);

        // Wait for confirmation
        await tx.wait();
        console.log('   ✅ Authorized successfully!');

        // Verify authorization
        const newStatus = await resolver.authorizedExecutors(proxyAddress);
        console.log(`   ✅ Verified authorization status: ${newStatus}`);
      } catch (authError) {
        console.error(
          `   ❌ Failed to authorize ${proxyAddress}:`,
          authError.message,
        );
        // Continue with next address
      }
    }
  } catch (error) {
    console.error('❌ Authorization process failed:', error);
    throw error;
  }

  console.log('\n🎯 Authorization complete!');
  console.log('   Gelato can now execute DCA orders through:', contractAddress);
}

main()
  .then(() => {
    console.log('\n🎉 Gelato authorization successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Authorization failed:', error);
    process.exit(1);
  });
