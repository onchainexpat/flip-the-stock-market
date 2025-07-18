import { Redis } from '@upstash/redis';

// Initialize Redis store
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function listAllOrders() {
  console.log('Scanning for all DCA orders...\n');

  try {
    // Scan for all DCA order keys
    let cursor = 0;
    const allKeys: string[] = [];
    
    do {
      const [newCursor, keys] = await redis.scan(cursor, {
        match: 'dca:order_*',
        count: 100
      });
      cursor = parseInt(newCursor);
      allKeys.push(...keys);
    } while (cursor !== 0);

    console.log(`Found ${allKeys.length} DCA orders\n`);

    // Get details for each order
    for (const key of allKeys) {
      const orderData = await redis.hgetall(key);
      if (orderData) {
        console.log(`📦 Order: ${key.replace('dca:', '')}`);
        console.log(`  Status: ${orderData.status}`);
        console.log(`  User: ${orderData.userAddress}`);
        console.log(`  Executions: ${orderData.executionCount || 0}/${orderData.totalExecutions || 0}`);
        console.log(`  Created: ${orderData.createdAt ? new Date(parseInt(orderData.createdAt)).toISOString() : 'N/A'}`);
        console.log('');
      }
    }

    // Also check for execution logs
    console.log('\n📋 Recent Execution Logs:');
    for (const key of allKeys.slice(0, 5)) { // Check first 5 orders
      const orderId = key.replace('dca:', '');
      const logs = await redis.lrange(`dca:${orderId}:executions`, 0, 2);
      if (logs && logs.length > 0) {
        console.log(`\n  ${orderId}:`);
        logs.forEach((log: any) => {
          const logData = typeof log === 'string' ? JSON.parse(log) : log;
          console.log(`    - ${new Date(logData.timestamp).toISOString()} - ${logData.status}`);
        });
      }
    }

  } catch (error) {
    console.error('Error listing orders:', error);
  }
}

listAllOrders();