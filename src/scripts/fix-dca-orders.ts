import { serverDcaDatabase } from '../lib/serverDcaDatabase';
import { serverAgentKeyService } from '../services/serverAgentKeyService';

async function fixDCAOrders() {
  try {
    console.log('🔧 Starting DCA orders fix...');

    // Get all active orders
    const activeOrders = await serverDcaDatabase.getAllActiveOrders();
    console.log(`Found ${activeOrders.length} active orders to check`);

    let pausedCount = 0;
    let validCount = 0;

    for (const order of activeOrders) {
      try {
        // Parse order data
        let orderData: any;
        try {
          orderData = JSON.parse(order.sessionKeyData);
        } catch (e) {
          console.log(
            `❌ Order ${order.id}: Invalid session data format - cancelling`,
          );
          await serverDcaDatabase.updateOrderStatus(order.id, 'cancelled');
          continue;
        }

        // Check if order has agent key
        if (orderData.agentKeyId && orderData.serverManaged) {
          // Check if agent key exists and has sessionKeyApproval
          const agentKey = await serverAgentKeyService.getAgentKey(
            orderData.agentKeyId,
          );

          if (!agentKey) {
            console.log(
              `❌ Order ${order.id}: Agent key not found - cancelling`,
            );
            await serverDcaDatabase.updateOrderStatus(order.id, 'cancelled');
          } else if (agentKey.sessionKeyApproval) {
            console.log(`✅ Order ${order.id}: Valid order`);
            validCount++;
          } else {
            console.log(
              `⏸️ Order ${order.id}: Missing sessionKeyApproval - pausing`,
            );
            await serverDcaDatabase.updateOrderStatus(order.id, 'paused');
            pausedCount++;
          }
        } else {
          console.log(`⚠️ Order ${order.id}: Legacy order - pausing`);
          await serverDcaDatabase.updateOrderStatus(order.id, 'paused');
          pausedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error);
      }
    }

    console.log(`🎉 Fix completed: ${validCount} valid, ${pausedCount} paused`);
  } catch (error) {
    console.error('Fix script failed:', error);
  }
}

// Run the fix
fixDCAOrders()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
