// Clean up corrupted orders with invalid JSON
require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

console.log(
  '🔧 Redis URL:',
  process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Missing',
);
console.log(
  '🔧 Redis Token:',
  process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Missing',
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function cleanupCorruptedOrders() {
  try {
    console.log('🧹 Starting cleanup of corrupted orders...');

    // Get all order IDs
    const allOrderIds = await redis.smembers('dca:all_orders');
    console.log(`📋 Found ${allOrderIds.length} orders to check`);

    let cleanedCount = 0;

    for (const orderId of allOrderIds) {
      try {
        // Try to get the order
        const orderData = await redis.get(`dca:order:${orderId}`);

        if (!orderData) {
          console.log(`⚠️  Order ${orderId} not found, removing from index`);
          await redis.srem('dca:all_orders', orderId);
          cleanedCount++;
          continue;
        }

        // Try to parse the order data
        let parsedOrder;
        if (typeof orderData === 'string') {
          parsedOrder = JSON.parse(orderData);
        } else {
          parsedOrder = orderData;
        }

        // Check if order is cancelled and should be removed
        if (parsedOrder.status === 'cancelled') {
          console.log(`🗑️  Deleting cancelled order ${orderId}`);
          
          // Remove from Redis
          await redis.del(`dca:order:${orderId}`);
          await redis.srem('dca:all_orders', orderId);

          // Remove from user orders if we can determine the user
          if (parsedOrder.userAddress) {
            await redis.srem(
              `dca:user:${parsedOrder.userAddress}:orders`,
              orderId,
            );
          }

          cleanedCount++;
          continue;
        }

        // Check if sessionKeyData is corrupted
        if (
          parsedOrder.sessionKeyData &&
          typeof parsedOrder.sessionKeyData === 'string'
        ) {
          if (parsedOrder.sessionKeyData === '[object Object]') {
            console.log(
              `🗑️  Deleting corrupted order ${orderId} (sessionKeyData = "[object Object]")`,
            );

            // Remove from Redis
            await redis.del(`dca:order:${orderId}`);
            await redis.srem('dca:all_orders', orderId);

            // Remove from user orders if we can determine the user
            if (parsedOrder.userAddress) {
              await redis.srem(
                `dca:user:${parsedOrder.userAddress}:orders`,
                orderId,
              );
            }

            cleanedCount++;
          } else {
            // Try to parse sessionKeyData to check if it's valid JSON
            try {
              JSON.parse(parsedOrder.sessionKeyData);
            } catch (e) {
              console.log(
                `🗑️  Deleting order ${orderId} with invalid sessionKeyData JSON`,
              );
              await redis.del(`dca:order:${orderId}`);
              await redis.srem('dca:all_orders', orderId);
              if (parsedOrder.userAddress) {
                await redis.srem(
                  `dca:user:${parsedOrder.userAddress}:orders`,
                  orderId,
                );
              }
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        console.log(`🗑️  Deleting unparseable order ${orderId}:`, error.message);
        await redis.del(`dca:order:${orderId}`);
        await redis.srem('dca:all_orders', orderId);
        cleanedCount++;
      }
    }

    console.log(
      `✅ Cleanup complete! Removed ${cleanedCount} corrupted orders`,
    );
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

cleanupCorruptedOrders();
