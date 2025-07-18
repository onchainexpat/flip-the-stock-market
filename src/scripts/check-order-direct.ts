import { Redis } from '@upstash/redis';

// Initialize Redis store
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkOrder() {
  const orderId = 'order_1752453977603_oyfasf8af';
  const orderKey = `dca:order:${orderId}`;

  console.log(`Checking order: ${orderId}\n`);

  try {
    // Check if key exists
    const exists = await redis.exists(orderKey);
    console.log(`Key exists: ${exists}`);

    if (!exists) {
      console.log('Order key not found');
      return;
    }

    // Get all fields
    const fields = await redis.hkeys(orderKey);
    console.log(`\nOrder has ${fields.length} fields:`);

    // Get each field value
    for (const field of fields) {
      const value = await redis.hget(orderKey, field);
      console.log(`  ${field}: ${value}`);
    }

    // Check for execution logs
    const execKey = `${orderKey}:executions`;
    const execExists = await redis.exists(execKey);
    console.log(`\nExecution log key exists: ${execExists}`);

    if (execExists) {
      const execCount = await redis.llen(execKey);
      console.log(`Number of execution logs: ${execCount}`);

      if (execCount > 0) {
        const logs = await redis.lrange(execKey, 0, -1);
        console.log('\nExecution logs:');
        logs.forEach((log: any, idx: number) => {
          console.log(`[${idx}]: ${log}`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrder();
