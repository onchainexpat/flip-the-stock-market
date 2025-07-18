import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function comprehensiveOrderAnalysis() {
  const orderId = 'order_1752453977603_oyfasf8af'
  const key = `dca:order:${orderId}`
  
  console.log(`\n=== Comprehensive Order Analysis: ${orderId} ===\n`)
  
  try {
    // Get the order data
    const orderData = await redis.get(key) as any
    
    if (!orderData) {
      console.log('❌ Order not found')
      return
    }
    
    console.log('📋 BASIC ORDER INFORMATION')
    console.log('├─ Order ID:', orderData.id)
    console.log('├─ Status:', orderData.status)
    console.log('├─ User Address:', orderData.userAddress)
    console.log('├─ Session Key Address:', orderData.sessionKeyAddress)
    console.log('├─ Created:', new Date(orderData.createdAt).toLocaleString())
    console.log('└─ Last Updated:', new Date(orderData.updatedAt).toLocaleString())
    
    // Parse session key data
    let sessionKeyInfo = null
    try {
      sessionKeyInfo = JSON.parse(orderData.sessionKeyData)
      console.log('\n🔐 SESSION KEY INFORMATION')
      console.log('├─ Agent Key ID:', sessionKeyInfo.agentKeyId)
      console.log('├─ Smart Wallet:', sessionKeyInfo.smartWalletAddress)
      console.log('├─ Provider:', sessionKeyInfo.provider)
      console.log('├─ Gasless:', sessionKeyInfo.gasless)
      console.log('├─ EIP-7702:', sessionKeyInfo.eip7702)
      console.log('└─ Session Created:', new Date(sessionKeyInfo.createdAt).toLocaleString())
    } catch (e) {
      console.log('\n⚠️  Could not parse session key data')
    }
    
    console.log('\n💰 TRADE CONFIGURATION')
    console.log('├─ From Token (USDC):', orderData.fromToken)
    console.log('├─ To Token (SPX):', orderData.toToken)
    console.log('├─ Destination Address:', orderData.destinationAddress)
    console.log('├─ Total Amount:', orderData.totalAmount, 'USDC (micro units)')
    console.log('├─ Amount Per Order:', orderData.amountPerOrder, 'USDC (micro units)')
    console.log('├─ Frequency:', orderData.frequency)
    console.log('├─ Duration:', orderData.duration, 'intervals')
    console.log('└─ Total Executions Planned:', orderData.totalExecutions)
    
    console.log('\n🔄 EXECUTION STATUS')
    console.log('├─ Executions Completed:', orderData.executionsCount)
    console.log('├─ Amount Executed:', orderData.executedAmount)
    console.log('├─ Next Execution Time:', new Date(orderData.nextExecutionAt).toLocaleString())
    console.log('├─ Expires At:', new Date(orderData.expiresAt).toLocaleString())
    console.log('└─ Transaction Hashes:', orderData.executionTxHashes.length > 0 ? orderData.executionTxHashes : 'None')
    
    // Check for the actual agent key
    if (sessionKeyInfo?.agentKeyId) {
      console.log('\n🔍 AGENT KEY CHECK')
      const agentKeyData = await redis.get(`agent_key:${sessionKeyInfo.agentKeyId}`)
      if (agentKeyData) {
        console.log('✅ Agent key found:', sessionKeyInfo.agentKeyId)
        const agentInfo = typeof agentKeyData === 'object' ? agentKeyData : JSON.parse(agentKeyData.toString())
        console.log('├─ Status:', agentInfo.status || 'active')
        console.log('├─ Smart Wallet:', agentInfo.smartWalletAddress)
        console.log('└─ Created:', new Date(agentInfo.createdAt).toLocaleString())
      } else {
        console.log('❌ Agent key not found:', sessionKeyInfo.agentKeyId)
      }
    }
    
    // Check for execution history
    console.log('\n📊 EXECUTION HISTORY CHECK')
    const historyKeys = [
      `execution_history:${orderId}`,
      `dca_execution:${orderId}`,
      `gelato_execution:${orderId}`,
      `dca_execution_history:${orderId}`
    ]
    
    let foundHistory = false
    for (const histKey of historyKeys) {
      const history = await redis.lrange(histKey, 0, -1)
      if (history && history.length > 0) {
        console.log(`✅ Found execution history in ${histKey}:`)
        history.forEach((entry, index) => {
          try {
            const parsed = JSON.parse(entry)
            console.log(`  ${index + 1}. ${new Date(parsed.timestamp).toLocaleString()} - ${parsed.status}`)
            if (parsed.error) console.log(`     Error: ${parsed.error}`)
            if (parsed.txHash) console.log(`     TX: ${parsed.txHash}`)
          } catch (e) {
            console.log(`  ${index + 1}. ${entry}`)
          }
        })
        foundHistory = true
      }
    }
    
    if (!foundHistory) {
      console.log('❌ No execution history found')
    }
    
    // Check for error logs
    console.log('\n⚠️  ERROR LOG CHECK')
    const errorKeys = [
      `error:${orderId}`,
      `dca_error:${orderId}`,
      `gelato_error:${orderId}`,
      `execution_error:${orderId}`
    ]
    
    let foundErrors = false
    for (const errKey of errorKeys) {
      const errorData = await redis.get(errKey)
      if (errorData) {
        console.log(`❌ Error found in ${errKey}:`)
        try {
          const parsed = typeof errorData === 'object' ? errorData : JSON.parse(errorData.toString())
          console.log('  ├─ Error:', parsed.error)
          console.log('  ├─ Timestamp:', new Date(parsed.timestamp).toLocaleString())
          console.log('  └─ Context:', parsed.context)
        } catch (e) {
          console.log('  └─ Raw error:', errorData.toString())
        }
        foundErrors = true
      }
    }
    
    if (!foundErrors) {
      console.log('✅ No error logs found')
    }
    
    // Check for Gelato task
    console.log('\n🤖 GELATO INTEGRATION CHECK')
    const gelatoKeys = [
      `gelato_task:${orderId}`,
      `gelato_task_id:${orderId}`,
      `task:${orderId}`
    ]
    
    let foundGelato = false
    for (const gelatoKey of gelatoKeys) {
      const gelatoData = await redis.get(gelatoKey)
      if (gelatoData) {
        console.log(`✅ Gelato task found in ${gelatoKey}:`, gelatoData)
        foundGelato = true
      }
    }
    
    if (!foundGelato) {
      console.log('❌ No Gelato task found')
    }
    
    // ANALYSIS AND RECOMMENDATIONS
    console.log('\n🔬 ANALYSIS')
    console.log('═'.repeat(50))
    
    console.log('\n📊 Current State:')
    console.log(`  ├─ Order is ${orderData.status.toUpperCase()}`)
    console.log(`  ├─ ${orderData.executionsCount}/${orderData.totalExecutions} executions completed`)
    console.log(`  ├─ ${orderData.executedAmount}/${orderData.totalAmount} amount executed`)
    
    const timeSinceCreation = Date.now() - orderData.createdAt
    const timeSinceUpdate = Date.now() - orderData.updatedAt
    console.log(`  ├─ Created ${Math.round(timeSinceCreation / (1000 * 60))} minutes ago`)
    console.log(`  └─ Last updated ${Math.round(timeSinceUpdate / (1000 * 60))} minutes ago`)
    
    console.log('\n🎯 Key Findings:')
    if (orderData.status === 'paused' && orderData.executionsCount === 0) {
      console.log('  ❌ Order was paused before any successful execution')
      console.log('  ❌ This indicates an issue during the first execution attempt')
      
      if (orderData.nextExecutionAt < Date.now()) {
        console.log('  ⏰ Next execution time has passed - order should have executed')
      }
      
      if (sessionKeyInfo?.provider === 'gelato-native') {
        console.log('  🤖 Uses Gelato Native provider - check Gelato dashboard for task status')
      }
    }
    
    console.log('\n💡 Recommendations:')
    console.log('  1. Check Gelato dashboard for task execution logs')
    console.log('  2. Verify smart wallet balance and token approvals')
    console.log('  3. Check if rate limits or API issues occurred during execution')
    console.log('  4. Review OpenOcean API response for swap quote issues')
    console.log('  5. Manual execution test to isolate the issue')
    
  } catch (error) {
    console.error('Error in comprehensive analysis:', error)
  } finally {
    process.exit(0)
  }
}

// Run the analysis
comprehensiveOrderAnalysis()