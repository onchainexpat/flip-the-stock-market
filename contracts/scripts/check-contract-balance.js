const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Checking contract ETH balance...");

  const contractAddress = "0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247";
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Check contract balance
  const balance = await deployer.provider.getBalance(contractAddress);
  console.log("💰 Contract balance:", ethers.formatEther(balance), "ETH");
  
  // Calculate how many transactions this can cover (rough estimate)
  const avgGasFee = ethers.parseEther("0.00001"); // ~$0.03 at current ETH prices
  const estimatedTxns = balance / avgGasFee;
  
  console.log("📊 Estimated transactions this can cover:", estimatedTxns.toString());
  
  if (balance === 0n) {
    console.log("⚠️ Contract has no ETH - Gelato executions will fail!");
    console.log("💡 Run: npx hardhat run scripts/fund-contract.js --network base");
  } else {
    console.log("✅ Contract is funded and ready for Gelato executions");
  }
}

main()
  .then(() => {
    console.log("\n🎯 Balance check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Balance check failed:", error);
    process.exit(1);
  });