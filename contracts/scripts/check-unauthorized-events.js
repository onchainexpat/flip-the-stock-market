const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking for UnauthorizedAttempt events...");

  const contractAddress = "0x608AFDa57620855a620313a02D54A2620b01460d";
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);

  // Connect to existing contract
  const DCAAutomationResolver = await ethers.getContractFactory("DCAAutomationResolver");
  const resolver = DCAAutomationResolver.attach(contractAddress);

  try {
    // Get recent blocks to search
    const currentBlock = await deployer.provider.getBlockNumber();
    const fromBlock = currentBlock - 1000; // Search last 1000 blocks
    
    console.log(`🔍 Searching blocks ${fromBlock} to ${currentBlock}`);

    // Query for UnauthorizedAttempt events
    const unauthorizedFilter = resolver.filters.UnauthorizedAttempt();
    const unauthorizedEvents = await resolver.queryFilter(unauthorizedFilter, fromBlock, currentBlock);

    console.log(`\n🚫 Found ${unauthorizedEvents.length} UnauthorizedAttempt events:`);
    
    for (const event of unauthorizedEvents) {
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   Caller: ${event.args.caller}`);
      console.log(`   Tx Hash: ${event.transactionHash}`);
      console.log(`   ---`);
    }

    // Also check for recent OrderCreated events to verify contract is working
    const orderCreatedFilter = resolver.filters.OrderCreated();
    const orderEvents = await resolver.queryFilter(orderCreatedFilter, fromBlock, currentBlock);
    
    console.log(`\n📋 Found ${orderEvents.length} OrderCreated events:`);
    for (const event of orderEvents) {
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   Order ID: ${event.args.orderId}`);
      console.log(`   User: ${event.args.user}`);
      console.log(`   ---`);
    }

    // Check ExecutorAuthorized events
    const authFilter = resolver.filters.ExecutorAuthorized();
    const authEvents = await resolver.queryFilter(authFilter, fromBlock, currentBlock);
    
    console.log(`\n✅ Found ${authEvents.length} ExecutorAuthorized events:`);
    for (const event of authEvents) {
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   Executor: ${event.args.executor}`);
      console.log(`   ---`);
    }

    // Check total orders in contract
    const totalOrders = await resolver.getTotalOrders();
    console.log(`\n📊 Contract Status:`);
    console.log(`   Total orders: ${totalOrders}`);
    
    if (totalOrders > 0) {
      const orderId = await resolver.allOrderIds(0);
      const order = await resolver.getOrder(orderId);
      console.log(`   First order user: ${order.user}`);
      console.log(`   First order active: ${order.isActive}`);
      console.log(`   Executions completed: ${order.executionsCompleted}/${order.totalExecutions}`);
    }

  } catch (error) {
    console.error("❌ Failed to check events:", error);
  }
}

main()
  .then(() => {
    console.log("\n🎯 Event check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Check failed:", error);
    process.exit(1);
  });