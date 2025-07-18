import { Redis } from '@upstash/redis';

// Initialize Redis store
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkRedisKeys() {
  console.log('Scanning Redis for all keys...\n');

  try {
    // Scan for all keys
    let cursor = 0;
    const allKeys: string[] = [];
    const keyPatterns: { [key: string]: number } = {};
    
    do {
      const [newCursor, keys] = await redis.scan(cursor, {
        count: 100
      });
      cursor = parseInt(newCursor);
      allKeys.push(...keys);
    } while (cursor !== 0);

    console.log(`Total keys found: ${allKeys.length}\n`);

    // Categorize keys by pattern
    allKeys.forEach(key => {
      const pattern = key.split(':')[0];
      keyPatterns[pattern] = (keyPatterns[pattern] || 0) + 1;
    });

    console.log('Key patterns:');
    Object.entries(keyPatterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} keys`);
    });

    // Show some sample keys
    console.log('\nSample keys:');
    allKeys.slice(0, 10).forEach(key => {
      console.log(`  - ${key}`);
    });

    // Check for DCA-related keys
    const dcaKeys = allKeys.filter(key => key.includes('dca') || key.includes('order'));
    console.log(`\nDCA-related keys: ${dcaKeys.length}`);
    dcaKeys.forEach(key => {
      console.log(`  - ${key}`);
    });

  } catch (error) {
    console.error('Error scanning Redis:', error);
  }
}

checkRedisKeys();