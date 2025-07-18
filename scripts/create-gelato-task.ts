/**
 * Script to programmatically create and fund Gelato tasks
 * Use this as an alternative to the dashboard
 */

import { GelatoOpsSDK } from '@gelatonetwork/ops-sdk';
import { ethers } from 'ethers';

async function createGelatoTask() {
  console.log('🚀 Creating Gelato DCA Task...\n');

  try {
    // Environment variables check
    const requiredEnvVars = [
      'GELATO_DEPLOYER_PRIVATE_KEY',
      'NEXT_PUBLIC_ZERODEV_RPC_URL',
      'UPSTASH_REDIS_REST_URL',
      'AGENT_KEY_ENCRYPTION_SECRET',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_ZERODEV_RPC_URL,
    );
    const signer = new ethers.Wallet(
      process.env.GELATO_DEPLOYER_PRIVATE_KEY!,
      provider,
    );

    console.log('📝 Configuration:');
    console.log(`   Deployer address: ${signer.address}`);
    console.log(`   Network: Base (Chain ID: 8453)`);

    // Check balance
    const balance = await provider.getBalance(signer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther('0.1')) {
      console.warn(
        '⚠️  Low balance! You need at least 0.1 ETH for deployment and funding',
      );
    }

    // Initialize Gelato SDK
    const gelatoOps = new GelatoOpsSDK(8453, signer); // Base chain ID

    // Web3 Function configuration
    const web3FunctionHash = process.env.GELATO_WEB3_FUNCTION_HASH;
    if (!web3FunctionHash) {
      console.error('❌ GELATO_WEB3_FUNCTION_HASH not found!');
      console.log('   Please deploy your Web3 Function first:');
      console.log('   npm run gelato:deploy');
      return;
    }

    // Task arguments
    const userArgs = {
      redisUrl: process.env.UPSTASH_REDIS_REST_URL,
      encryptionSecret: process.env.AGENT_KEY_ENCRYPTION_SECRET,
      zerodevRpcUrl: process.env.NEXT_PUBLIC_ZERODEV_RPC_URL,
      adminWalletAddress: signer.address,
    };

    console.log('\n🔧 Creating task with configuration:');
    console.log(`   Web3 Function Hash: ${web3FunctionHash}`);
    console.log(`   User Arguments: ${JSON.stringify(userArgs, null, 2)}`);

    // Create task
    const taskArgs = {
      name: `DCA-Automation-${Date.now()}`,
      web3FunctionHash,
      web3FunctionArgsHash: ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(userArgs)),
      ),
      trigger: {
        type: 'time',
        interval: 300000, // 5 minutes in milliseconds
      },
      dedicatedMsgSender: false,
      useTaskTreasuryFunds: true,
      singleExec: false,
    };

    console.log('\n📋 Creating Gelato task...');
    const { taskId, tx } = await gelatoOps.createTask(taskArgs);

    console.log('✅ Task created successfully!');
    console.log(`   Task ID: ${taskId}`);
    console.log(`   Transaction: ${tx.hash}`);

    // Wait for transaction confirmation
    console.log('\n⏳ Waiting for transaction confirmation...');
    await tx.wait();
    console.log('✅ Transaction confirmed!');

    // Fund the task
    console.log('\n💰 Funding task with 0.1 ETH...');
    const fundAmount = ethers.parseEther('0.1');

    const fundTx = await gelatoOps.depositFunds(
      fundAmount,
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    ); // ETH
    console.log(`   Funding transaction: ${fundTx.hash}`);

    await fundTx.wait();
    console.log('✅ Task funded successfully!');

    // Get task details
    console.log('\n📊 Task Details:');
    const taskDetails = await gelatoOps.getTask(taskId);
    console.log(`   Status: ${taskDetails.status}`);
    console.log(`   Balance: ${ethers.formatEther(taskDetails.balance)} ETH`);
    console.log(
      `   Created: ${new Date(taskDetails.createdDate).toLocaleString()}`,
    );

    console.log('\n🎯 Next Steps:');
    console.log('1. Monitor task execution in Gelato dashboard');
    console.log('2. Create DCA orders to test automation');
    console.log('3. Monitor logs and performance');
    console.log(
      `4. Task URL: https://app.gelato.network/functions/task/${taskId}:8453`,
    );

    // Save task ID to environment for future reference
    console.log('\n💾 Save this Task ID to your environment:');
    console.log(`GELATO_TASK_ID=${taskId}`);

    return {
      success: true,
      taskId,
      txHash: tx.hash,
      fundingTxHash: fundTx.hash,
    };
  } catch (error) {
    console.error('❌ Failed to create Gelato task:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Run the script
if (require.main === module) {
  createGelatoTask()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 Gelato task setup complete!');
        process.exit(0);
      } else {
        console.error('\n💥 Task creation failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Script execution failed:', error);
      process.exit(1);
    });
}

export { createGelatoTask };
