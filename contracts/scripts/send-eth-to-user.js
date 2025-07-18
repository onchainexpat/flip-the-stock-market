const { ethers } = require('hardhat');

async function main() {
  console.log('💸 Sending ETH from deployer to user wallet...');

  const userWallet = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 From account:', deployer.address);
  console.log('📝 To account:', userWallet);

  // Check deployer balance
  const deployerBalance = await deployer.provider.getBalance(deployer.address);
  console.log(
    '💰 Deployer balance:',
    ethers.formatEther(deployerBalance),
    'ETH',
  );

  if (deployerBalance === 0n) {
    console.log('ℹ️ No ETH to send');
    return;
  }

  // Send most of the ETH, keeping some for gas
  const gasBuffer = ethers.parseEther('0.0001'); // Keep 0.0001 ETH for gas
  const sendAmount = deployerBalance - gasBuffer;

  if (sendAmount <= 0) {
    console.log('ℹ️ Not enough ETH after gas buffer');
    return;
  }

  console.log(
    '📞 Sending',
    ethers.formatEther(sendAmount),
    'ETH to user wallet...',
  );
  console.log('   (Keeping', ethers.formatEther(gasBuffer), 'ETH for gas)');

  try {
    const tx = await deployer.sendTransaction({
      to: userWallet,
      value: sendAmount,
    });

    console.log('⏳ Transaction sent:', tx.hash);
    await tx.wait();

    // Check final balances
    const newDeployerBalance = await deployer.provider.getBalance(
      deployer.address,
    );
    const userBalance = await deployer.provider.getBalance(userWallet);

    console.log('✅ Transfer successful!');
    console.log(
      '💰 Deployer final balance:',
      ethers.formatEther(newDeployerBalance),
      'ETH',
    );
    console.log(
      '💰 User wallet balance:',
      ethers.formatEther(userBalance),
      'ETH',
    );
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    throw error;
  }

  console.log('\n🎯 ETH transfer complete!');
}

main()
  .then(() => {
    console.log('\n🎉 ETH sent to user wallet successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Transfer failed:', error);
    process.exit(1);
  });
