const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 Deploying DCA Automation Resolver...');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deploying with account:', deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.002')) {
    console.error('❌ Insufficient balance for deployment');
    process.exit(1);
  }

  // Deploy the contract
  const DCAAutomationResolver = await ethers.getContractFactory(
    'DCAAutomationResolver',
  );
  const resolver = await DCAAutomationResolver.deploy();

  await resolver.waitForDeployment();

  const contractAddress = await resolver.getAddress();
  console.log('✅ DCAAutomationResolver deployed to:', contractAddress);
  console.log('📋 Transaction hash:', resolver.deploymentTransaction().hash);

  // Wait for a few confirmations
  console.log('⏳ Waiting for confirmations...');
  await resolver.deploymentTransaction().wait(3);

  console.log('🎯 Deployment complete!');
  console.log('\n📋 Contract Details:');
  console.log('   Address:', contractAddress);
  console.log('   Owner:', deployer.address);
  console.log('   Network: Base (8453)');

  console.log('\n🔧 Gelato Task Configuration:');
  console.log('   Contract Address:', contractAddress);
  console.log('   Function: checker()');
  console.log('   Network: Base');

  console.log('\n💾 Save these to your .env.local:');
  console.log(`DCA_RESOLVER_ADDRESS=${contractAddress}`);

  return contractAddress;
}

main()
  .then((address) => {
    console.log('\n🎉 Deployment successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  });
