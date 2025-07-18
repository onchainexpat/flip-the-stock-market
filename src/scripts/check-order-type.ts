import { Redis } from '@upstash/redis';

// Initialize Redis store
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkOrderType() {
  const orderId = 'order_1752453977603_oyfasf8af';
  const orderKey = `dca:order:${orderId}`;
  
  console.log(`Checking order: ${orderId}\n`);

  try {
    // Check key type
    const keyType = await redis.type(orderKey);
    console.log(`Key type: ${keyType}`);
    
    // Based on type, get the value
    if (keyType === 'string') {
      const value = await redis.get(orderKey);
      console.log('\nString value:');
      console.log(value);
      
      // Try to parse as JSON
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          console.log('\nParsed JSON:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Value is not JSON');
        }
      }
    } else if (keyType === 'hash') {
      const value = await redis.hgetall(orderKey);
      console.log('\nHash value:');
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(`Unexpected key type: ${keyType}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrderType();