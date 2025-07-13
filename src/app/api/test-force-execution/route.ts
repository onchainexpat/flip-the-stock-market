import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { serverZerodevDCAExecutor } from '../../../services/serverZerodevDCAExecutor';

export const runtime = 'nodejs';

// Force execute a DCA order for testing (bypasses timing checks)
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🚀 Force executing DCA order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    if (order.status !== 'active') {
      return NextResponse.json({ 
        success: false, 
        error: `Order status is ${order.status}, not active` 
      }, { status: 400 });
    }

    // Parse order data to get agent key
    let orderData;
    try {
      orderData = typeof order.sessionKeyData === 'string' 
        ? JSON.parse(order.sessionKeyData) 
        : order.sessionKeyData;
    } catch (e) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid order data format' 
      }, { status: 400 });
    }

    if (!orderData.agentKeyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order missing agent key' 
      }, { status: 400 });
    }

    console.log(`📝 Executing order ${order.id} with agent key ${orderData.agentKeyId}`);

    // Execute the order using the server executor
    const executionResult = await serverZerodevDCAExecutor.executeDCAWithAgentKey(
      orderData.agentKeyId,
      order.sessionKeyAddress, // Smart wallet address
      order.userAddress, // User wallet address  
      order.amountPerOrder // Amount per execution
    );

    if (executionResult.success) {
      console.log(`✅ Order ${order.id} executed successfully`);
      console.log('   Transaction hash:', executionResult.txHash);
      console.log('   Amount swapped:', executionResult.amountSwapped);

      return NextResponse.json({
        success: true,
        message: 'Order executed successfully',
        orderId: order.id,
        executionResult
      });
    } else {
      console.log(`❌ Order ${order.id} execution failed:`, executionResult.error);
      return NextResponse.json({
        success: false,
        error: executionResult.error,
        orderId: order.id
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Force execution failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}