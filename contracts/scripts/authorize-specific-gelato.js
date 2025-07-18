const { ethers } = require('hardhat');

async function main() {
  console.log('🔐 Authorizing specific Gelato message sender...');

  const contractAddress = '0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247';

  // Get the deployer account (contract owner)
  const [deployer] = await ethers.getSigners();
  console.log('📝 Using account:', deployer.address);

  // Connect to existing contract
  const DCAAutomationResolver = await ethers.getContractFactory(
    'DCAAutomationResolver',
  );
  const resolver = DCAAutomationResolver.attach(contractAddress);

  // Your specific Gelato message sender from the dashboard
  const gelatoMessageSender = '0x239b82c435aa0647f65b9a1a8d3458ca9a4efc1f';

  console.log('📞 Authorizing your specific Gelato message sender...');
  console.log('   Contract:', contractAddress);
  console.log('   Message Sender:', gelatoMessageSender);

  try {
    // Check if already authorized
    const isAuthorized =
      await resolver.authorizedExecutors(gelatoMessageSender);
    console.log('   Current authorization status:', isAuthorized);

    if (isAuthorized) {
      console.log('✅ Gelato message sender is already authorized!');
      return;
    }

    // Authorize Gelato message sender
    const tx = await resolver.authorizeExecutor(gelatoMessageSender);
    console.log('⏳ Transaction sent:', tx.hash);

    // Wait for confirmation
    await tx.wait();
    console.log('✅ Gelato message sender authorized successfully!');

    // Verify authorization
    const newStatus = await resolver.authorizedExecutors(gelatoMessageSender);
    console.log('   New authorization status:', newStatus);
  } catch (error) {
    console.error('❌ Authorization failed:', error);
    throw error;
  }

  console.log('\n🎯 Authorization complete!');
  console.log('   Gelato can now execute DCA orders through:', contractAddress);
}

main()
  .then(() => {
    console.log('\n🎉 Specific Gelato authorization successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Authorization failed:', error);
    process.exit(1);
  });
