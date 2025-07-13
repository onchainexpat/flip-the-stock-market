const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking contract authorization status...");

  const contractAddress = "0x8BC49314c9aF750Df3Ed595B4f858a0cb1c8f584";
  
  // Get the deployer account (contract owner)
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Connect to existing contract
  const DCAAutomationResolver = await ethers.getContractFactory("DCAAutomationResolver");
  const resolver = DCAAutomationResolver.attach(contractAddress);

  // Check current authorization for the address I used
  const gelatoOpsProxy = "0x2A6C106ae13B558BB9E2Ec64Bd2f1f7BEFF3A5E0";
  const isAuthorized = await resolver.authorizedExecutors(gelatoOpsProxy);
  console.log(`   Gelato Proxy (${gelatoOpsProxy}): ${isAuthorized}`);

  // Check some other common Gelato addresses for Base
  const commonGelatoAddresses = [
    "0x2A6C106ae13B558BB9E2Ec64Bd2f1f7BEFF3A5E0", // Legacy
    "0x527a819db1eb0e34426297b03bae11F2f8B3A19E", // Polygon ops proxy
    "0x7598e84B2E114AB62CAb288CE5f7d5f6bad35BBA", // Another common one
    "0x340759c8346A1E6Ed92035FB8B6ec57cE1D82c2c", // Arbitrum ops proxy
    "0x3AC05161b76a35c1c28dC99Aa9d2BA2aB5b85e0a", // Another Base possibility
  ];

  console.log("\n🔍 Checking common Gelato addresses:");
  for (const addr of commonGelatoAddresses) {
    try {
      const authorized = await resolver.authorizedExecutors(addr);
      console.log(`   ${addr}: ${authorized}`);
    } catch (error) {
      console.log(`   ${addr}: Error checking`);
    }
  }

  // Check if we can get the current ready orders
  console.log("\n📋 Checking ready orders:");
  try {
    const [canExec, execPayload] = await resolver.checker();
    console.log(`   canExec: ${canExec}`);
    console.log(`   execPayload length: ${execPayload.length}`);
    
    if (canExec && execPayload !== '0x') {
      console.log("   ✅ Orders are ready for execution");
    } else {
      console.log("   ⏳ No orders ready yet");
    }
  } catch (error) {
    console.error("   ❌ Error checking orders:", error.message);
  }

  // Get total orders
  const totalOrders = await resolver.getTotalOrders();
  console.log(`   Total orders in contract: ${totalOrders}`);
}

main()
  .then(() => {
    console.log("\n🎯 Authorization check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Check failed:", error);
    process.exit(1);
  });