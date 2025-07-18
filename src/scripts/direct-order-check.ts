import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function directOrderCheck() {
  const orderId = 'order_1752453977603_oyfasf8af';
  const key = `dca:order:${orderId}`;

  console.log(`\n=== Direct Order Check: ${key} ===\n`);

  try {
    // Get the data directly
    const data = await redis.get(key);

    console.log('Raw data type:', typeof data);
    console.log('Raw data:', data);

    if (data && typeof data === 'object') {
      console.log('\n📋 Order Data (parsed as object):');
      console.log('Keys:', Object.keys(data));
      console.log('Full object:');
      console.log(JSON.stringify(data, null, 2));

      // Check specific fields
      const order = data as any;
      console.log('\n📊 Order Details:');
      console.log('  - ID:', order.id);
      console.log('  - Status:', order.status);
      console.log('  - Smart Wallet:', order.smartWalletAddress);
      console.log('  - Provider:', order.provider);
      console.log(
        '  - Created:',
        order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A',
      );
      console.log(
        '  - Updated:',
        order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'N/A',
      );

      console.log('\n💰 Trade Configuration:');
      console.log('  - Input Token:', order.inputTokenAddress);
      console.log('  - Output Token:', order.outputTokenAddress);
      console.log('  - Amount per interval:', order.amountPerInterval);
      console.log('  - Interval (seconds):', order.intervalSeconds);
      console.log('  - Total intervals:', order.totalIntervals);

      console.log('\n🔄 Execution Status:');
      console.log('  - Executions Count:', order.executionsCount);
      console.log(
        '  - Next Execution:',
        order.nextExecutionTime
          ? new Date(order.nextExecutionTime).toLocaleString()
          : 'N/A',
      );
      console.log(
        '  - Last Execution:',
        order.lastExecutionTime
          ? new Date(order.lastExecutionTime).toLocaleString()
          : 'Never',
      );

      if (order.executionTxHashes && order.executionTxHashes.length > 0) {
        console.log('\n✅ Execution Transaction Hashes:');
        order.executionTxHashes.forEach((hash: string, index: number) => {
          console.log(`  ${index + 1}. ${hash}`);
        });
      }

      if (order.error) {
        console.log('\n❌ Error:', order.error);
      }

      // Check execution details if available
      if (order.executionDetails) {
        console.log('\n🔍 Execution Details:');
        console.log(JSON.stringify(order.executionDetails, null, 2));
      }

      // Summary
      console.log('\n📌 Analysis:');
      if (order.status === 'paused') {
        console.log('  - Order is currently PAUSED');

        if (order.executionsCount === 0) {
          console.log('  - No successful executions before pausing');
          console.log(
            '  - This suggests the issue occurred during first execution attempt',
          );
        } else {
          console.log(
            `  - ${order.executionsCount} successful execution(s) before pausing`,
          );
        }

        if (order.error) {
          console.log(
            '  - Error details available - likely auto-paused due to error',
          );
        }
      }
    }

    // Also check for agent key with corrected pattern
    console.log('\n🔐 Checking for agent key...');
    const agentKey = await redis.get(`agent_key:${orderId}`);
    if (agentKey) {
      console.log('Agent key found:', agentKey);
    } else {
      console.log('No agent key found');
    }

    // Check for Gelato task ID
    console.log('\n🤖 Checking for Gelato task...');
    const gelatoTaskKey = `gelato_task:${orderId}`;
    const gelatoTask = await redis.get(gelatoTaskKey);
    if (gelatoTask) {
      console.log('Gelato task found:', gelatoTask);
    } else {
      console.log('No Gelato task found');
    }
  } catch (error) {
    console.error('Error in direct order check:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
directOrderCheck();
