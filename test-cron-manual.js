#!/usr/bin/env node

// Manual test of the cron execution
console.log('🧪 Testing DCA cron execution manually...');

async function testCronExecution() {
  try {
    // Use the same logic as the cron job
    const { serverDcaDatabase } = await import('./src/lib/serverDcaDatabase.js');
    
    console.log('📋 Checking for orders due for execution...');
    
    // Get orders ready for execution
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();
    
    console.log(`Found ${ordersToExecute.length} orders ready for execution`);
    
    if (ordersToExecute.length > 0) {
      console.log('📋 Orders ready for execution:');
      ordersToExecute.forEach(order => {
        console.log(`  - ${order.id}: ${order.executionsCount}/${order.totalExecutions} completed`);
        console.log(`    Next execution: ${new Date(order.nextExecutionAt).toISOString()}`);
        console.log(`    Current time: ${new Date().toISOString()}`);
      });
    } else {
      console.log('❌ No orders ready for execution');
      
      // Let's check all active orders
      const activeOrders = await serverDcaDatabase.getAllActiveOrders();
      console.log(`\n📊 Found ${activeOrders.length} active orders total:`);
      
      for (const order of activeOrders) {
        console.log(`\n🔍 Order ${order.id}:`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Executions: ${order.executionsCount}/${order.totalExecutions}`);
        console.log(`   Next execution: ${new Date(order.nextExecutionAt).toISOString()}`);
        console.log(`   Current time: ${new Date().toISOString()}`);
        console.log(`   Due? ${new Date() >= new Date(order.nextExecutionAt) ? 'YES' : 'NO'}`);
        
        // Check session key data
        try {
          const sessionData = typeof order.sessionKeyData === 'string' 
            ? JSON.parse(order.sessionKeyData) 
            : order.sessionKeyData;
          console.log(`   Has agent key: ${sessionData.agentKeyId ? 'YES' : 'NO'}`);
          if (sessionData.agentKeyId) {
            console.log(`   Agent key ID: ${sessionData.agentKeyId}`);
          }
        } catch (e) {
          console.log(`   Session data error: ${e.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing cron execution:', error);
  }
}

testCronExecution();