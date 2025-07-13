// Test script to check DCA order execution
import { serverDcaDatabase } from '../lib/serverDcaDatabase';

async function testDCAExecution() {
  console.log('🔍 Testing DCA execution detection...\n');

  try {
    // Get orders due for execution
    console.log('📋 Checking for orders due for execution...');
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();
    
    console.log(`Found ${ordersToExecute.length} orders ready for execution\n`);
    
    if (ordersToExecute.length > 0) {
      ordersToExecute.forEach((order, index) => {
        console.log(`📊 Order ${index + 1}:`);
        console.log(`   ID: ${order.id}`);
        console.log(`   User: ${order.userAddress}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Executions: ${order.executionsCompleted}/${order.totalExecutions}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log(`   Updated: ${order.updatedAt || 'Never'}`);
        console.log('');
      });
    }

    // Also check all active orders for debugging
    console.log('📋 All active orders:');
    const allActiveOrders = await serverDcaDatabase.getAllActiveOrders();
    console.log(`Found ${allActiveOrders.length} total active orders\n`);
    
    allActiveOrders.forEach((order, index) => {
      console.log(`📊 Active Order ${index + 1}:`);
      console.log(`   ID: ${order.id}`);
      console.log(`   User: ${order.userAddress}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Executions: ${order.executionsCompleted}/${order.totalExecutions}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Updated: ${order.updatedAt || 'Never'}`);
      
      try {
        const orderData = typeof order.sessionKeyData === 'string' 
          ? JSON.parse(order.sessionKeyData) 
          : order.sessionKeyData;
        console.log(`   Frequency: ${orderData.frequency || 'Not set'}`);
        console.log(`   Agent Key: ${orderData.agentKeyId || 'Not set'}`);
      } catch (e) {
        console.log(`   Session Data: Invalid JSON`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error testing DCA execution:', error);
  }
}

testDCAExecution();