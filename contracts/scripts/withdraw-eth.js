const { ethers } = require("hardhat");

async function main() {
  console.log("💸 Withdrawing ETH from contract...");

  const contractAddress = "0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247";
  
  // Get the deployer account (contract owner)
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Connect to existing contract
  const DCAAutomationResolver = await ethers.getContractFactory("DCAAutomationResolver");
  const resolver = DCAAutomationResolver.attach(contractAddress);

  // Check current contract balance
  const currentBalance = await deployer.provider.getBalance(contractAddress);
  console.log("💰 Current contract balance:", ethers.formatEther(currentBalance), "ETH");

  if (currentBalance === 0n) {
    console.log("ℹ️ No ETH to withdraw");
    return;
  }

  // Withdraw all ETH to user's wallet
  const withdrawAmount = currentBalance; // Withdraw all ETH
  const userWallet = "0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7";
  
  console.log("📞 Withdrawing", ethers.formatEther(withdrawAmount), "ETH from contract...");
  
  try {
    const tx = await resolver.withdrawETH(withdrawAmount);
    console.log("⏳ Transaction sent:", tx.hash);

    // Wait for confirmation
    await tx.wait();
    console.log("✅ ETH withdrawn successfully!");

    // Check new balance
    const newBalance = await deployer.provider.getBalance(contractAddress);
    console.log("💰 New contract balance:", ethers.formatEther(newBalance), "ETH");

  } catch (error) {
    console.error("❌ Withdrawal failed:", error);
    throw error;
  }

  console.log("\n🎯 Withdrawal complete!");
}

main()
  .then(() => {
    console.log("\n🎉 ETH withdrawal successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Withdrawal failed:", error);
    process.exit(1);
  });