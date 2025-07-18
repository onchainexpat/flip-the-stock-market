import { serverDcaDatabase } from './src/lib/serverDcaDatabase.ts';
// Debug the server-side DCA execution issue
import { ServerZerodevDCAExecutor } from './src/services/serverZerodevDCAExecutor.ts';

async function debugServerDCA() {
  console.log('🔍 Debugging server-side DCA execution...');

  const executor = new ServerZerodevDCAExecutor();

  // Use the order we created in the test
  const orderId = 'order_1752780541246_48bhofntr';

  try {
    // Get the order from database
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      console.log('❌ Order not found');
      return;
    }

    console.log('📋 Order found:', order.id);
    console.log('   Status:', order.status);
    console.log('   Smart wallet:', order.sessionKeyAddress);
    console.log('   Amount per order:', order.amountPerOrder);

    // Parse session key data
    const sessionKeyData = JSON.parse(order.sessionKeyData);
    console.log('🔐 Session key data:');
    console.log('   Agent key ID:', sessionKeyData.agentKeyId);
    console.log('   Server managed:', sessionKeyData.serverManaged);
    console.log('   Has approval:', !!sessionKeyData.sessionKeyApproval);

    // Try to execute the DCA
    console.log('\\n🧪 Testing DCA execution...');

    const result = await executor.executeDCAWithAgentKey(
      sessionKeyData.agentKeyId,
      order.sessionKeyAddress,
      order.userAddress,
      BigInt(order.amountPerOrder),
    );

    console.log('✅ DCA execution result:', result.success);
    if (result.success) {
      console.log('   Transaction hash:', result.txHash);
      console.log('   SPX received:', result.spxReceived);
    } else {
      console.log('❌ DCA execution failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

debugServerDCA();
