// Debug script to check order status directly
const orderId = 'order_1752794857701_tczwdfwp5';

console.log('🔍 Debugging order status...');

async function checkOrderDirectly() {
  try {
    // Check order via direct API call (bypassing UI)
    const response = await fetch(`http://localhost:3001/api/dca-order-history?userAddress=0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7&page=1&limit=10`);
    
    if (!response.ok) {
      console.log('❌ API Error:', response.status, response.statusText);
      const text = await response.text();
      console.log('Response:', text);
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('📊 Order History Response:');
      console.log('   Total orders found:', data.orders.length);
      
      const targetOrder = data.orders.find(o => o.id === orderId);
      if (targetOrder) {
        console.log('🎯 Target Order Found:');
        console.log('   ID:', targetOrder.id);
        console.log('   Status:', targetOrder.status);
        console.log('   Progress:', `${targetOrder.executionsCompleted}/${targetOrder.totalExecutions}`);
        console.log('   SPX Received:', targetOrder.totalSpxReceived);
        console.log('   Next Execution:', new Date(targetOrder.nextExecutionAt).toISOString());
        console.log('   Last Execution Hash:', targetOrder.lastExecutionHash);
        console.log('   Smart Wallet:', targetOrder.smartWalletAddress);
      } else {
        console.log('❌ Target order not found in response');
        console.log('Available orders:');
        data.orders.forEach(o => {
          console.log(`   - ${o.id}: ${o.status} (${o.executionsCompleted}/${o.totalExecutions})`);
        });
      }
    } else {
      console.log('❌ API returned error:', data.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Check if order might have been cancelled accidentally
async function checkCancelationLogs() {
  console.log('\n🔍 Checking for cancellation in recent logs...');
  console.log('Look for any "Cancel" or "cancelled" messages in your server logs');
  console.log('The order might have been cancelled by mistake during execution');
}

async function main() {
  await checkOrderDirectly();
  await checkCancelationLogs();
  
  console.log('\n💡 Recommendations:');
  console.log('1. If order shows as cancelled with 0 progress:');
  console.log('   - Check server logs for cancellation messages');
  console.log('   - Create a new DCA order');
  console.log('2. If order shows progress > 0:');
  console.log('   - The execution worked, just UI display issue');
  console.log('3. Check your wallet for the ~0.044 SPX tokens from the successful swap');
}

main().catch(console.error);