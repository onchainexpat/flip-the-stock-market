const { serverDcaDatabase } = require('./src/lib/serverDcaDatabase.ts');

async function findLatestOrder() {
  try {
    // Get all order keys
    const keys = await serverDcaDatabase.redis.keys('dca_order:*');
    console.log('Found order keys:', keys.length);
    
    let latestOrder = null;
    let latestTime = 0;
    
    for (const key of keys) {
      const order = await serverDcaDatabase.redis.hgetall(key);
      if (order && order.createdAt) {
        const createdAt = parseInt(order.createdAt);
        if (createdAt > latestTime) {
          latestTime = createdAt;
          latestOrder = order;
        }
      }
    }
    
    if (latestOrder) {
      console.log('Latest order:', {
        id: latestOrder.id,
        status: latestOrder.status,
        provider: latestOrder.provider || 'legacy',
        createdAt: new Date(parseInt(latestOrder.createdAt)),
        agentKeyId: latestOrder.sessionKeyData ? JSON.parse(latestOrder.sessionKeyData).agentKeyId : 'N/A'
      });
      return latestOrder.id;
    } else {
      console.log('No orders found');
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findLatestOrder().then(orderId => {
  if (orderId) {
    console.log('\nTo execute this order manually, run:');
    console.log(`curl -X POST http://localhost:3000/api/execute-gelato-dca-now -H "Content-Type: application/json" -d '{"orderId": "${orderId}"}'`);
  }
  process.exit(0);
});