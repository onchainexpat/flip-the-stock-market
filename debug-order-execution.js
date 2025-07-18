const orderId = 'order_1752794857701_tczwdfwp5';

console.log('🔍 Debugging order execution...');

// Check order status
async function checkOrderStatus() {
  try {
    const response = await fetch(`http://localhost:3001/api/dca-order-history?userAddress=0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7&page=1&limit=5`);
    const data = await response.json();
    
    if (data.success) {
      const order = data.orders.find(o => o.id === orderId);
      if (order) {
        console.log('📊 Order Status:');
        console.log('   ID:', order.id);
        console.log('   Status:', order.status);
        console.log('   Progress:', `${order.executionsCompleted}/${order.totalExecutions}`);
        console.log('   SPX Received:', order.totalSpxReceived);
        console.log('   Next Execution:', new Date(order.nextExecutionAt).toISOString());
        console.log('   Smart Wallet:', order.smartWalletAddress);
      } else {
        console.log('❌ Order not found');
      }
    } else {
      console.log('❌ Failed to fetch orders:', data.error);
    }
  } catch (error) {
    console.log('❌ Error checking order status:', error.message);
  }
}

// Try manual execution
async function tryExecution() {
  try {
    console.log('🚀 Attempting manual execution...');
    const response = await fetch('http://localhost:3001/api/force-execute-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    
    const result = await response.json();
    console.log('📋 Execution Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ Error executing order:', error.message);
  }
}

// Run checks
async function main() {
  console.log('1. Checking current order status...');
  await checkOrderStatus();
  
  console.log('\n2. Attempting execution...');
  await tryExecution();
  
  console.log('\n3. Checking order status after execution...');
  setTimeout(async () => {
    await checkOrderStatus();
  }, 5000);
}

main().catch(console.error);