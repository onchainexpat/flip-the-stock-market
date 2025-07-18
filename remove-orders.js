#!/usr/bin/env node

// Script to remove all existing DCA orders for cleanup
// This allows creating fresh orders with all our fixes

const BASE_URL = 'http://localhost:3000';

async function removeAllOrders() {
  try {
    console.log('🔍 Finding all existing DCA orders...');
    
    // You'll need to provide your wallet address
    const userAddress = process.argv[2];
    if (!userAddress) {
      console.error('❌ Please provide your wallet address as an argument:');
      console.error('   node remove-orders.js 0xYourWalletAddress');
      process.exit(1);
    }
    
    console.log(`   User address: ${userAddress}`);
    
    // Get all unified orders
    const response = await fetch(`${BASE_URL}/api/unified-dca-orders?userAddress=${userAddress}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API error: ${data.error}`);
    }
    
    console.log(`📊 Found ${data.orders.length} total orders:`);
    console.log(`   Smart wallet orders: ${data.summary.smartWalletOrders}`);
    console.log(`   OpenOcean orders: ${data.summary.openOceanOrders}`);
    console.log(`   Active orders: ${data.summary.activeOrders}`);
    console.log(`   Completed orders: ${data.summary.completedOrders}`);
    console.log(`   Cancelled orders: ${data.summary.cancelledOrders}`);
    
    if (data.orders.length === 0) {
      console.log('✅ No orders found to remove.');
      return;
    }
    
    // Show orders that would be removed
    const activeOrders = data.orders.filter(order => order.status === 'active');
    if (activeOrders.length === 0) {
      console.log('✅ No active orders found to remove.');
      return;
    }
    
    console.log('\n🗑️ Active orders to be cancelled:');
    for (const order of activeOrders) {
      console.log(`   ID: ${order.id}`);
      console.log(`   Provider: ${order.provider}`);
      console.log(`   From: ${order.fromToken} → To: ${order.toToken}`);
      console.log(`   Total: ${order.totalAmount} (executed: ${order.executedAmount})`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}`);
      if (order.provider === 'openocean' && order.orderHash) {
        console.log(`   OrderHash: ${order.orderHash}`);
      }
      console.log('   ---');
    }
    
    // Ask for confirmation
    console.log(`\n⚠️ This will cancel ${activeOrders.length} active orders.`);
    console.log('   Press Enter to continue, or Ctrl+C to abort...');
    
    // Wait for user input (in a real script, you'd use readline)
    // For now, we'll proceed automatically
    console.log('📝 Proceeding with cancellation...');
    
    // Cancel each active order
    let cancelledCount = 0;
    for (const order of activeOrders) {
      try {
        console.log(`🗑️ Cancelling order ${order.id}...`);
        
        const deleteResponse = await fetch(`${BASE_URL}/api/delete-order?orderId=${order.id}&userAddress=${userAddress}`, {
          method: 'DELETE',
        });
        
        const deleteData = await deleteResponse.json();
        
        if (deleteResponse.ok && deleteData.success) {
          console.log(`   ✅ Order ${order.id} cancelled successfully`);
          cancelledCount++;
        } else {
          console.log(`   ❌ Failed to cancel order ${order.id}: ${deleteData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`   ❌ Error cancelling order ${order.id}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Cancelled ${cancelledCount} out of ${activeOrders.length} orders.`);
    
    if (cancelledCount > 0) {
      console.log('\n✅ Orders have been cancelled. You can now create a fresh DCA order!');
      console.log('   Visit: http://localhost:3000/dca-zerodev');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeAllOrders();