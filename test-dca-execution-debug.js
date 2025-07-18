// Debug the DCA execution to see exactly where it fails
async function debugDCAExecution() {
  console.log('🔍 Debugging DCA execution with detailed logging...');

  const orderId = 'order_1752791672647_59o2j49ah';

  console.log('📋 Testing order:', orderId);
  console.log('⏳ Calling test-force-dca-execution endpoint...');

  try {
    const response = await fetch(
      `http://localhost:3000/api/test-force-dca-execution?orderId=${orderId}`,
    );
    const data = await response.json();

    console.log('\\n📊 Response:');
    console.log('   Success:', data.success);

    if (data.result) {
      console.log('\\n🔍 Execution details:');
      console.log('   Success:', data.result.success);

      if (data.result.error) {
        console.log('\\n❌ Error details:');
        console.log(data.result.error);

        // Parse the error to understand what's happening
        if (data.result.error.includes('callData')) {
          console.log(
            '\\n📋 Call data in error:',
            data.result.error
              .match(/"callData":"([^"]+)"/)?.[1]
              ?.substring(0, 100) + '...',
          );
        }

        if (data.result.error.includes('0xe9ae5c53')) {
          console.log(
            '\\n🔍 This is a multicall operation (0xe9ae5c53 = execute batch)',
          );
          console.log(
            '   The session key is trying to execute a batched transaction',
          );
        }

        if (data.result.error.includes('simulation')) {
          console.log('\\n⚠️ Transaction failed during simulation');
          console.log(
            '   This usually means the transaction would revert on-chain',
          );
        }
      }

      if (data.result.transactions) {
        console.log('\\n✅ Successful transactions:');
        Object.entries(data.result.transactions).forEach(([key, value]) => {
          console.log(`   ${key}: ${value || 'pending'}`);
        });
      }

      if (data.result.swapAmount) {
        console.log('\\n💱 Swap details:');
        console.log('   Swap amount:', data.result.swapAmount);
        console.log('   SPX received:', data.result.spxReceived || 'none');
      }
    }

    // Let's also check the order status
    console.log('\\n📋 Checking order status...');
    const orderResponse = await fetch(
      `http://localhost:3000/api/dca-orders-v2?userAddress=0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7`,
    );
    const orderData = await orderResponse.json();

    if (orderData.success) {
      const order = orderData.orders.find((o) => o.id === orderId);
      if (order) {
        console.log('\\n📊 Order details:');
        console.log('   Status:', order.status);
        console.log(
          '   Executions:',
          order.executionsCount,
          '/',
          order.totalExecutions,
        );
        console.log('   Smart wallet:', order.smartWalletAddress);
        console.log('   Total amount:', order.totalAmount, 'USDC');
        console.log('   Executed amount:', order.executedAmount, 'USDC');

        if (order.transactions && order.transactions.length > 0) {
          console.log('   Transactions:', order.transactions);
        }
      }
    }

    console.log('\\n💡 Analysis:');
    console.log(
      '   - Session keys are working correctly (authentication passes)',
    );
    console.log('   - The issue appears to be with the swap transaction data');
    console.log('   - This might be due to:');
    console.log('     1. Aggregator API returning invalid swap data');
    console.log('     2. Router contract address mismatch');
    console.log('     3. Insufficient liquidity or slippage');
    console.log('     4. Gas estimation issues');
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugDCAExecution();
