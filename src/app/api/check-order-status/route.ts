import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Check the status of a specific order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🔍 Checking status of order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Parse session data
    let orderData: any = {};
    try {
      orderData = typeof order.sessionKeyData === 'string' 
        ? JSON.parse(order.sessionKeyData) 
        : order.sessionKeyData;
    } catch (e) {
      // Invalid JSON
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        userAddress: order.userAddress,
        status: order.status,
        executionsCount: order.executionsCount,
        totalExecutions: order.totalExecutions,
        createdAt: order.createdAt,
        createdAtDate: new Date(order.createdAt).toISOString(),
        updatedAt: order.updatedAt,
        updatedAtDate: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,
        nextExecutionAt: order.nextExecutionAt,
        nextExecutionAtDate: new Date(order.nextExecutionAt).toISOString(),
        frequency: order.frequency,
        agentKeyId: orderData.agentKeyId,
        executionTxHashes: order.executionTxHashes || [],
        totalExecutionTxs: (order.executionTxHashes || []).length
      }
    });

  } catch (error) {
    console.error('❌ Failed to check order status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}