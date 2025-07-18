const { ethers } = require('hardhat');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  console.log('🚀 Deploying DCA Automation Resolver...');

  // Check if we have a private key
  if (!process.env.GELATO_DEPLOYER_PRIVATE_KEY) {
    console.log(
      '\n❌ GELATO_DEPLOYER_PRIVATE_KEY environment variable not set.',
    );
    console.log('\n🔧 To deploy, you need to:');
    console.log('1. Create a new wallet for deployment');
    console.log('2. Send 0.1+ ETH to it on Base network');
    console.log('3. Export the private key');
    console.log('4. Add to .env.local:');
    console.log('   GELATO_DEPLOYER_PRIVATE_KEY=0x_your_private_key_here');
    console.log('\n📋 Or for testing, you can use a test private key:');
    console.log('   export GELATO_DEPLOYER_PRIVATE_KEY=0x_test_key_here');

    process.exit(1);
  }

  try {
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying with account:', deployer.address);

    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH');

    if (balance < ethers.parseEther('0.001')) {
      console.error(
        '❌ Insufficient balance for deployment (need at least 0.001 ETH)',
      );
      console.log('\n💡 To get ETH on Base:');
      console.log('1. Bridge from Ethereum mainnet');
      console.log('2. Use a CEX that supports Base');
      console.log('3. Use a faucet for Base testnet');
      process.exit(1);
    }

    // Deploy the contract
    console.log('\n🔨 Deploying contract...');
    const DCAAutomationResolver = await ethers.getContractFactory(
      'DCAAutomationResolver',
    );
    const resolver = await DCAAutomationResolver.deploy();

    console.log('⏳ Waiting for deployment...');
    await resolver.waitForDeployment();

    const contractAddress = await resolver.getAddress();
    const deploymentTransaction = resolver.deploymentTransaction();

    console.log('\n✅ DCAAutomationResolver deployed successfully!');
    console.log('📋 Contract Address:', contractAddress);
    console.log('📋 Transaction Hash:', deploymentTransaction.hash);
    console.log('📋 Deployer Address:', deployer.address);

    // Wait for confirmations
    console.log('\n⏳ Waiting for 3 confirmations...');
    await deploymentTransaction.wait(3);

    console.log('\n🎯 Deployment Complete!');

    console.log('\n📋 Next Steps:');
    console.log('1. Save contract address to .env.local:');
    console.log(`   DCA_RESOLVER_ADDRESS=${contractAddress}`);
    console.log('\n2. Go to Gelato Dashboard:');
    console.log("   - Select 'Solidity Function'");
    console.log('   - Network: Base');
    console.log(`   - Contract: ${contractAddress}`);
    console.log('   - Function: checker()');
    console.log('   - Trigger: Time Interval (5 minutes)');
    console.log('   - Fund with 0.1+ ETH');

    console.log('\n🔗 Useful Links:');
    console.log(
      `   - Basescan: https://basescan.org/address/${contractAddress}`,
    );
    console.log('   - Gelato Dashboard: https://app.gelato.network');

    return {
      address: contractAddress,
      txHash: deploymentTransaction.hash,
      deployer: deployer.address,
    };
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);

    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 You need more ETH in your deployer wallet');
    } else if (error.message.includes('nonce')) {
      console.log('\n💡 Try restarting the deployment');
    } else if (error.message.includes('network')) {
      console.log('\n💡 Check your RPC URL and network connection');
    }

    process.exit(1);
  }
}

// Handle script execution
main()
  .then((result) => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
