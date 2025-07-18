/**
 * Fix corrupted sessionKeyData in DCA orders
 * This script fixes orders where sessionKeyData has been corrupted to "[object Object]"
 */
require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEYS = {
  ORDER: (id) => `dca:order:${id}`,
  ALL_ORDERS: 'dca:all_orders',
};

async function fixCorruptedSessionKeyData() {
  try {
    console.log('🔍 Scanning for corrupted orders...');
    
    // Get all order IDs
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_ORDERS);
    console.log(`Found ${allOrderIds.length} total orders`);
    
    let fixedCount = 0;
    let deletedCount = 0;
    
    for (const orderId of allOrderIds) {
      try {
        const data = await redis.get(REDIS_KEYS.ORDER(orderId));
        if (!data) continue;
        
        let parsedData;
        if (typeof data === 'string') {
          parsedData = JSON.parse(data);
        } else if (typeof data === 'object') {
          parsedData = data;
        } else {
          console.log(`⚠️  Skipping order ${orderId} - unexpected data type: ${typeof data}`);
          continue;
        }
        
        // Check if sessionKeyData is corrupted
        if (parsedData.sessionKeyData === '[object Object]' || 
            (typeof parsedData.sessionKeyData === 'object' && parsedData.sessionKeyData !== null)) {
          
          console.log(`❌ Found corrupted order: ${orderId}`);
          console.log(`   Status: ${parsedData.status}`);
          console.log(`   SessionKeyData: ${parsedData.sessionKeyData}`);
          
          // If the order is cancelled, delete it entirely
          if (parsedData.status === 'cancelled') {
            console.log(`🗑️  Deleting cancelled order: ${orderId}`);
            await redis.del(REDIS_KEYS.ORDER(orderId));
            await redis.srem(REDIS_KEYS.ALL_ORDERS, orderId);
            deletedCount++;
          } else {
            // For active/completed orders, we need to reconstruct the sessionKeyData
            // Since we can't recover the original data, we'll mark these as corrupted
            console.log(`⚠️  Order ${orderId} is ${parsedData.status} but has corrupted sessionKeyData`);
            console.log(`   This order will need manual intervention or recreation`);
            
            // Set a placeholder that indicates corruption
            parsedData.sessionKeyData = JSON.stringify({
              corrupted: true,
              originalStatus: parsedData.status,
              corruptedAt: Date.now(),
              note: "sessionKeyData was corrupted - order may need to be recreated"
            });
            
            // Update the order with the fixed sessionKeyData
            await redis.set(REDIS_KEYS.ORDER(orderId), JSON.stringify(parsedData));
            fixedCount++;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing order ${orderId}:`, error.message);
        
        // If we can't parse the order at all, it's probably completely corrupted
        if (error.message.includes('not valid JSON')) {
          console.log(`🗑️  Deleting completely corrupted order: ${orderId}`);
          await redis.del(REDIS_KEYS.ORDER(orderId));
          await redis.srem(REDIS_KEYS.ALL_ORDERS, orderId);
          deletedCount++;
        }
      }
    }
    
    console.log('\n✅ Cleanup completed!');
    console.log(`📊 Results:`);
    console.log(`   - Fixed orders: ${fixedCount}`);
    console.log(`   - Deleted orders: ${deletedCount}`);
    console.log(`   - Total processed: ${allOrderIds.length}`);
    
    if (fixedCount > 0) {
      console.log('\n⚠️  Note: Some orders had corrupted sessionKeyData and have been marked.');
      console.log('   These orders may need to be manually recreated by users.');
    }
    
  } catch (error) {
    console.error('Failed to fix corrupted orders:', error);
  }
}

// Run the fix
fixCorruptedSessionKeyData();