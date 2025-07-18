const { ethers } = require('hardhat');

async function main() {
  console.log('💰 Adding more ETH to contract for higher gas fees...');

  const contractAddress = '0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247';

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Using account:', deployer.address);

  // Check current balance
  const currentBalance = await deployer.provider.getBalance(contractAddress);
  console.log(
    '💰 Current contract balance:',
    ethers.formatEther(currentBalance),
    'ETH',
  );

  // Send additional 0.005 ETH to contract (total will be ~0.006 ETH)
  const additionalAmount = ethers.parseEther('0.005');

  console.log(
    '📞 Sending additional',
    ethers.formatEther(additionalAmount),
    'ETH to contract...',
  );

  const tx = await deployer.sendTransaction({
    to: contractAddress,
    value: additionalAmount,
  });

  console.log('⏳ Transaction sent:', tx.hash);
  await tx.wait();

  // Check new balance
  const newBalance = await deployer.provider.getBalance(contractAddress);
  console.log(
    '✅ New contract balance:',
    ethers.formatEther(newBalance),
    'ETH',
  );

  // Calculate new estimated transactions
  const avgGasFee = ethers.parseEther('0.00003'); // Higher estimate for complex DCA operations
  const estimatedTxns = newBalance / avgGasFee;
  console.log(
    '📊 Estimated complex transactions this can cover:',
    estimatedTxns.toString(),
  );

  console.log('\n🎯 Contract funding increased!');
}

main()
  .then(() => {
    console.log('🎉 Additional funding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Additional funding failed:', error);
    process.exit(1);
  });
