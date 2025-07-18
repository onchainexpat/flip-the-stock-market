const fetch = require('node-fetch');

async function deleteOrder(orderId) {
  console.log(`🗑️ Deleting order: ${orderId}...`);

  try {
    const response = await fetch('http://localhost:3000/api/delete-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Order ${orderId} deleted successfully`);
      console.log('   Response:', result);
    } else {
      console.log(`❌ Failed to delete order ${orderId}`);
      console.log('   Error:', result);
    }
  } catch (error) {
    console.error(`💥 Error deleting order ${orderId}:`, error.message);
  }
}

async function main() {
  console.log('🧹 Cleaning up old DCA orders...\n');

  const orderIds = [
    '4bqyj64p', // First order (partial ID)
    'c5wlzh1j', // Second order (partial ID)
  ];

  // Delete both orders
  for (const orderId of orderIds) {
    await deleteOrder(orderId);
    console.log(''); // Add spacing
  }

  console.log('🎯 Cleanup complete! You can now create a new test order.');
}

main()
  .then(() => {
    console.log('\n🎉 Old orders cleanup finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
