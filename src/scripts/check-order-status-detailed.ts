import { Redis } from '@upstash/redis';
import { serverDcaDatabase } from '../lib/serverDcaDatabase';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkOrderStatus() {
  const orderId = 'order_1752453977603_oyfasf8af';

  console.log(`\n=== Checking Order Status: ${orderId} ===\n`);

  try {
    // 1. Get order from database
    const order = await serverDcaDatabase.getOrder(orderId);

    if (!order) {
      console.log('❌ Order not found in database');
      return;
    }

    console.log('📋 Order Details:');
    console.log('  - ID:', order.id);
    console.log('  - Status:', order.status);
    console.log('  - Smart Wallet:', order.smartWalletAddress);
    console.log('  - Created:', new Date(order.createdAt).toLocaleString());
    console.log('  - Updated:', new Date(order.updatedAt).toLocaleString());

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

    // Check execution transaction hashes
    if (order.executionTxHashes && order.executionTxHashes.length > 0) {
      console.log('\n✅ Execution Transaction Hashes:');
      order.executionTxHashes.forEach((hash, index) => {
        console.log(`  ${index + 1}. ${hash}`);
      });
    } else {
      console.log('\n⚠️  No execution transactions recorded');
    }

    // Check if there's an error message
    if (order.error) {
      console.log('\n❌ Error Message:', order.error);
    }

    // 2. Check Redis for additional data
    console.log('\n🔍 Checking Redis for additional data...');

    // Check for agent key
    const agentKeyData = await redis.get(`agent_key:${orderId}`);
    if (agentKeyData) {
      console.log('  ✅ Agent key found in Redis');
      const parsedData = JSON.parse(agentKeyData);
      console.log(
        '  - Created:',
        new Date(parsedData.createdAt).toLocaleString(),
      );
      console.log('  - Status:', parsedData.status || 'active');
    } else {
      console.log('  ⚠️  No agent key found in Redis');
    }

    // Check for execution history
    const executionHistoryKey = `dca_execution_history:${orderId}`;
    const executionHistory = await redis.lrange(executionHistoryKey, 0, -1);

    if (executionHistory && executionHistory.length > 0) {
      console.log('\n📊 Execution History (from Redis):');
      executionHistory.forEach((entry, index) => {
        try {
          const parsed = JSON.parse(entry);
          console.log(
            `  ${index + 1}. ${new Date(parsed.timestamp).toLocaleString()} - ${parsed.status}`,
          );
          if (parsed.error) {
            console.log(`     Error: ${parsed.error}`);
          }
          if (parsed.txHash) {
            console.log(`     TX: ${parsed.txHash}`);
          }
        } catch (e) {
          console.log(`  ${index + 1}. ${entry}`);
        }
      });
    } else {
      console.log('\n📊 No execution history found in Redis');
    }

    // Check for any error logs
    const errorKey = `dca_error:${orderId}`;
    const errorData = await redis.get(errorKey);
    if (errorData) {
      console.log('\n⚠️  Error data found in Redis:');
      try {
        const parsed = JSON.parse(errorData);
        console.log('  - Error:', parsed.error);
        console.log(
          '  - Timestamp:',
          new Date(parsed.timestamp).toLocaleString(),
        );
        console.log('  - Context:', parsed.context);
      } catch (e) {
        console.log('  - Raw error:', errorData);
      }
    }

    // 3. Check if order was automatically paused
    if (order.status === 'paused') {
      console.log('\n🚫 Order is PAUSED');

      // Check if it was manually paused or auto-paused
      const pauseReasonKey = `dca_pause_reason:${orderId}`;
      const pauseReason = await redis.get(pauseReasonKey);
      if (pauseReason) {
        console.log('  - Pause reason:', pauseReason);
      }

      // Check if it was paused due to insufficient balance
      if (order.error && order.error.includes('Insufficient balance')) {
        console.log('  - Likely paused due to insufficient balance');
      }

      // Check if it was paused due to repeated failures
      if (order.error && order.error.includes('rate limit')) {
        console.log('  - Likely paused due to rate limit errors');
      }
    }

    // 4. Summary
    console.log('\n📌 Summary:');
    console.log(
      `  - Order ${orderId} is currently ${order.status.toUpperCase()}`,
    );
    console.log(
      `  - ${order.executionsCount} out of ${order.totalIntervals} executions completed`,
    );

    if (order.executionsCount > 0) {
      const successRate =
        (order.executionsCount /
          (order.executionsCount + (order.error ? 1 : 0))) *
        100;
      console.log(`  - Success rate: ${successRate.toFixed(0)}%`);
    }

    if (order.status === 'paused' && order.executionsCount === 0) {
      console.log('  - ⚠️  Order was paused before any successful execution');
    }

    // Check if we should recommend any action
    console.log('\n💡 Recommendations:');
    if (order.status === 'paused' && order.error) {
      if (order.error.includes('rate limit')) {
        console.log('  - Wait for rate limit to reset before resuming');
        console.log(
          '  - Consider adjusting execution interval to avoid rate limits',
        );
      } else if (order.error.includes('Insufficient balance')) {
        console.log('  - Check wallet balance and fund if necessary');
        console.log('  - Verify token approvals are in place');
      } else {
        console.log('  - Review error message and address the issue');
        console.log('  - Order can be resumed once issue is resolved');
      }
    }
  } catch (error) {
    console.error('Error checking order status:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkOrderStatus();
