const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Funding contract with ETH for gas fees...");

  const contractAddress = "0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247";
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Check current balance
  const currentBalance = await deployer.provider.getBalance(contractAddress);
  console.log("💰 Current contract balance:", ethers.formatEther(currentBalance), "ETH");

  // Send 0.001 ETH to contract (should cover many executions)
  const fundAmount = ethers.parseEther("0.001");
  
  console.log("📞 Sending", ethers.formatEther(fundAmount), "ETH to contract...");
  
  const tx = await deployer.sendTransaction({
    to: contractAddress,
    value: fundAmount
  });

  console.log("⏳ Transaction sent:", tx.hash);
  await tx.wait();

  // Check new balance
  const newBalance = await deployer.provider.getBalance(contractAddress);
  console.log("✅ New contract balance:", ethers.formatEther(newBalance), "ETH");
  
  console.log("\n🎯 Contract funded successfully!");
}

main()
  .then(() => {
    console.log("🎉 Funding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Funding failed:", error);
    process.exit(1);
  });