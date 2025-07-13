const fetch = require('node-fetch');

async function main() {
  console.log('📋 Getting current DCA orders...\n');
  
  try {
    // You'll need to provide your wallet address here
    const userAddress = '0x320b4a7a5e365a7cd4c5b8d5e6c1c0b3f8a4dCE'; // Based on the smart wallet you mentioned
    
    const response = await fetch(`http://localhost:3000/api/dca-orders-v2?userAddress=${userAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('📊 Current orders:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.orders && result.orders.length > 0) {
        console.log('\n🗑️ Orders to delete:');
        result.orders.forEach(order => {
          console.log(`- Order ID: ${order.orderId}`);
          console.log(`  Status: ${order.status}`);
          console.log(`  Created: ${order.createdAt}`);
          console.log('');
        });
      }
    } else {
      console.log('❌ Failed to get orders');
      const error = await response.json();
      console.log('Error:', error);
    }
  } catch (error) {
    console.error('💥 Error getting orders:', error.message);
  }
}

main()
  .then(() => {
    console.log('\n🎯 Orders check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });