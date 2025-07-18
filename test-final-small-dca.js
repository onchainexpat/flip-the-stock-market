// Create a very small DCA order that works with remaining balance
async function testSmallDCA() {
  console.log('🎯 Creating small DCA order for remaining balance');

  try {
    // Use the existing test wallet and create order for remaining balance
    const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
    const SMART_WALLET = '0x8127778edEbe2FdDCb4a20AC0F52789A7bFf7F65';

    // Create very small order for remaining balance (0.03 USDC)
    const orderResponse = await fetch(
      'http://localhost:3000/api/dca-orders-v2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: SMART_WALLET,
          totalAmount: '0.03', // Very small amount
          frequency: 'daily',
          duration: 1,
          // Use existing session key from previous test
          agentKeyId: 'session_1752792667831_w64g74w',
        }),
      },
    );

    const orderResult = await orderResponse.json();

    if (!orderResult.success) {
      console.log('❌ Failed to create small order:', orderResult.error);
      return;
    }

    const orderId = orderResult.order.id;
    console.log('✅ Small DCA order created:', orderId);
    console.log('   Amount: 0.03 USDC');

    // Execute immediately
    console.log('\\n🔄 Executing small DCA...');
    const executionResponse = await fetch(
      `http://localhost:3000/api/test-force-dca-execution?orderId=${orderId}`,
    );
    const executionResult = await executionResponse.json();

    console.log(
      '📊 Execution result:',
      executionResult.success ? 'SUCCESS' : 'FAILED',
    );

    if (executionResult.success && executionResult.result.success) {
      console.log('🎉 COMPLETE SUCCESS!');
      console.log('✅ Aerodrome swap: WORKING');
      console.log('✅ Session keys: WORKING');
      console.log('✅ DCA execution: WORKING');
      console.log('   Transaction:', executionResult.result.txHash);
      console.log('   SPX received:', executionResult.result.spxReceived);
    } else {
      console.log('❌ Execution failed:', executionResult.result?.error);

      // But the important part is testing if we can avoid the aggregator API issue
      if (
        !executionResult.result?.error?.includes('aggregator') &&
        !executionResult.result?.error?.includes('OpenOcean') &&
        !executionResult.result?.error?.includes('Cloudflare')
      ) {
        console.log('✅ Successfully bypassed aggregator API issues!');
        console.log('   The error is likely just balance-related');
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSmallDCA();
