import { Redis } from '@upstash/redis';

// Initialize Redis store
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkSpecificOrder() {
  const orderId = 'order_1752453977603_oyfasf8af';
  console.log(`Checking order: ${orderId}\n`);

  try {
    // Get the order data
    const orderKey = `dca:order:${orderId}`;
    let orderData: any;

    try {
      orderData = await redis.hgetall(orderKey);
    } catch (e) {
      console.log('❌ Error fetching order data:', e);
      return;
    }

    if (!orderData || Object.keys(orderData).length === 0) {
      console.log('❌ Order not found in database');
      return;
    }

    console.log('📊 Order Details:');
    console.log(`  Status: ${orderData.status}`);
    console.log(`  Execution Count: ${orderData.executionCount}`);
    console.log(`  Total Executions: ${orderData.totalExecutions}`);
    console.log(
      `  Next Execution: ${orderData.nextExecution ? new Date(Number.parseInt(orderData.nextExecution)).toISOString() : 'N/A'}`,
    );
    console.log(
      `  Last Execution: ${orderData.lastExecution ? new Date(Number.parseInt(orderData.lastExecution)).toISOString() : 'Never'}`,
    );
    console.log(
      `  Creation Time: ${orderData.createdAt ? new Date(Number.parseInt(orderData.createdAt)).toISOString() : 'N/A'}`,
    );

    // Check if there are any transaction hashes
    console.log('\n📝 Transaction History:');
    if (orderData.transactionHashes) {
      const hashes = JSON.parse(orderData.transactionHashes);
      if (hashes.length > 0) {
        hashes.forEach((hash: string, index: number) => {
          console.log(`  [${index + 1}] ${hash}`);
        });
      } else {
        console.log('  No transaction hashes recorded');
      }
    } else {
      console.log('  No transaction history field');
    }

    // Check execution logs
    const executionLogs = await redis.lrange(
      `dca:order:${orderId}:executions`,
      0,
      -1,
    );
    console.log('\n📋 Execution Logs:');
    if (executionLogs && executionLogs.length > 0) {
      executionLogs.forEach((log: any, index: number) => {
        const logData = typeof log === 'string' ? JSON.parse(log) : log;
        console.log(
          `  [${index + 1}] ${new Date(logData.timestamp).toISOString()}`,
        );
        console.log(`      Status: ${logData.status}`);
        console.log(`      TX Hash: ${logData.transactionHash || 'N/A'}`);
        if (logData.error) {
          console.log(`      Error: ${logData.error}`);
        }
      });
    } else {
      console.log('  No execution logs found');
    }

    // Additional fields
    console.log('\n🔍 Additional Information:');
    console.log(`  Order Type: ${orderData.orderType || 'N/A'}`);
    console.log(`  Has Session Key: ${orderData.sessionKey ? 'Yes' : 'No'}`);
    console.log(`  Smart Wallet: ${orderData.smartWalletAddress || 'N/A'}`);
    console.log(
      `  Amount Per Execution: ${orderData.amountPerExecution} ${orderData.inputToken}`,
    );
  } catch (error) {
    console.error('Error checking order:', error);
  }
}

checkSpecificOrder();
