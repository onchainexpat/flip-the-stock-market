// Debug script to check agent keys in the system
const { Redis } = require('@upstash/redis');

async function debugAgentKeys() {
  console.log('🔍 Debugging agent keys...');

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Look for agent key patterns
    const agentKeys = await redis.keys('agent_key:*');
    console.log(`📋 Found ${agentKeys.length} agent keys:`);

    for (const key of agentKeys.slice(0, 5)) {
      // Show first 5
      try {
        const data = await redis.get(key);
        const keyId = key.replace('agent_key:', '');
        console.log(`   🔑 ${keyId}:`);
        console.log(`      User: ${data?.userAddress || 'N/A'}`);
        console.log(`      Smart wallet: ${data?.smartWalletAddress || 'N/A'}`);
        console.log(`      Has approval: ${!!data?.sessionKeyApproval}`);
        console.log(`      Active: ${data?.isActive !== false}`);
      } catch (error) {
        console.log(`   ❌ Error reading ${key}: ${error.message}`);
      }
    }

    // Check for the specific order
    const orderKey = 'dca_order:order_1752720111186_f5ifjcour';
    try {
      const orderData = await redis.get(orderKey);
      if (orderData) {
        console.log(`\n📦 Order data for order_1752720111186_f5ifjcour:`);
        console.log(`   Agent Key ID: ${orderData.agentKeyId || 'NULL'}`);
        console.log(`   User: ${orderData.userAddress}`);
        console.log(`   Smart wallet: ${orderData.sessionKeyAddress}`);
        console.log(
          `   Session key data: ${orderData.sessionKeyData ? 'Present' : 'Missing'}`,
        );
      } else {
        console.log(`\n❌ Order not found in Redis: ${orderKey}`);
      }
    } catch (error) {
      console.log(`\n❌ Error reading order: ${error.message}`);
    }

    // Show a working agent key if any exist
    if (agentKeys.length > 0) {
      const workingKey = agentKeys[0];
      const workingData = await redis.get(workingKey);
      console.log(`\n✅ Example working agent key structure:`);
      console.log(JSON.stringify(workingData, null, 2));
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAgentKeys();
