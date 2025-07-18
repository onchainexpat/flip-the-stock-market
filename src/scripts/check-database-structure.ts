import { serverDcaDatabase } from '../lib/serverDcaDatabase'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function checkDatabaseStructure() {
  const orderId = 'order_1752453977603_oyfasf8af'
  
  console.log(`\n=== Database Structure Check: ${orderId} ===\n`)
  
  try {
    // 1. Check if order exists with raw Redis call
    console.log('🔍 Raw Redis lookup:')
    const rawOrder = await redis.get(`dca_order:${orderId}`)
    if (rawOrder) {
      console.log('✅ Found raw order data in Redis:')
      console.log(JSON.stringify(JSON.parse(rawOrder), null, 2))
    } else {
      console.log('❌ No raw order data found in Redis')
    }
    
    // 2. Check all DCA order keys
    console.log('\n🗂️  All DCA order keys:')
    const allOrderKeys = await redis.keys('dca_order:*')
    console.log(`Found ${allOrderKeys.length} order keys:`)
    allOrderKeys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key}`)
    })
    
    // 3. Look for our specific order in different key formats
    console.log('\n🔎 Searching for order with different key patterns:')
    const possibleKeys = [
      `dca_order:${orderId}`,
      `dca_orders:${orderId}`,
      `order:${orderId}`,
      `openocean_dca_order:${orderId}`,
      `zerodev_dca_order:${orderId}`,
      `gelato_dca_order:${orderId}`,
      orderId
    ]
    
    for (const key of possibleKeys) {
      const data = await redis.get(key)
      if (data) {
        console.log(`✅ Found data with key: ${key}`)
        try {
          const parsed = JSON.parse(data)
          console.log('  - Type:', typeof parsed)
          console.log('  - Keys:', Object.keys(parsed))
          if (parsed.status) console.log('  - Status:', parsed.status)
          if (parsed.smartWalletAddress) console.log('  - Wallet:', parsed.smartWalletAddress)
        } catch (e) {
          console.log('  - Raw data:', data.substring(0, 100) + '...')
        }
      }
    }
    
    // 4. Check for agent keys with the order ID
    console.log('\n🔐 Checking for agent keys:')
    const agentKeys = await redis.keys(`agent_key:*${orderId}*`)
    if (agentKeys.length > 0) {
      console.log(`Found ${agentKeys.length} agent keys:`)
      agentKeys.forEach(key => console.log(`  - ${key}`))
      
      // Get the first agent key data
      const agentData = await redis.get(agentKeys[0])
      if (agentData) {
        console.log('Agent key data:')
        console.log(JSON.stringify(JSON.parse(agentData), null, 2))
      }
    } else {
      console.log('No agent keys found')
    }
    
    // 5. Check for execution history
    console.log('\n📊 Checking for execution history:')
    const historyKeys = await redis.keys(`*execution*${orderId}*`)
    if (historyKeys.length > 0) {
      console.log(`Found ${historyKeys.length} execution history keys:`)
      historyKeys.forEach(key => console.log(`  - ${key}`))
    } else {
      console.log('No execution history keys found')
    }
    
    // 6. Check for error logs
    console.log('\n⚠️  Checking for error logs:')
    const errorKeys = await redis.keys(`*error*${orderId}*`)
    if (errorKeys.length > 0) {
      console.log(`Found ${errorKeys.length} error keys:`)
      for (const key of errorKeys) {
        const errorData = await redis.get(key)
        console.log(`  - ${key}: ${errorData}`)
      }
    } else {
      console.log('No error keys found')
    }
    
    // 7. Search for any keys containing the order ID
    console.log('\n🔍 All keys containing order ID:')
    const allKeys = await redis.keys('*')
    const matchingKeys = allKeys.filter(key => key.includes(orderId) || key.includes('1752453977603'))
    
    if (matchingKeys.length > 0) {
      console.log(`Found ${matchingKeys.length} keys containing order ID:`)
      for (const key of matchingKeys) {
        const data = await redis.get(key)
        console.log(`  - ${key}:`)
        if (data) {
          try {
            const parsed = JSON.parse(data.toString())
            console.log(`    Type: ${typeof parsed}, Keys: ${Object.keys(parsed).join(', ')}`)
            console.log(`    Full data:`, JSON.stringify(parsed, null, 2))
          } catch (e) {
            console.log(`    Raw: ${data.toString().substring(0, 100)}...`)
          }
        }
      }
    } else {
      console.log('No keys found containing the order ID')
    }
    
  } catch (error) {
    console.error('Error checking database structure:', error)
  } finally {
    process.exit(0)
  }
}

// Run the check
checkDatabaseStructure()