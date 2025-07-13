import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Force immediate execution by updating nextExecutionTime to now
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      );
    }

    console.log(`⚡ Forcing immediate execution for order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'active') {
      return NextResponse.json(
        { error: 'Order is not active' },
        { status: 400 }
      );
    }

    // Update the order to execute immediately
    const updatedOrder = await serverDcaDatabase.updateOrder(orderId, {
      nextExecutionAt: Date.now() - 1000, // Set to 1 second ago to ensure it's due
    });

    console.log(`✅ Order ${orderId} updated for immediate execution`);
    console.log(`   Next execution time set to: ${new Date(updatedOrder!.nextExecutionAt).toISOString()}`);

    // Now trigger the cron job
    console.log('🚀 Triggering DCA execution...');
    
    const executeResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/cron/execute-dca-v2`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'dev-secret'}`,
      },
    });

    let executionResult;
    try {
      executionResult = await executeResponse.json();
    } catch (e) {
      executionResult = { error: 'Failed to parse execution response' };
    }

    return NextResponse.json({
      success: true,
      message: 'Order updated for immediate execution',
      orderId,
      nextExecutionTime: new Date(updatedOrder!.nextExecutionAt).toISOString(),
      executionTriggered: executeResponse.ok,
      executionResult,
    });

  } catch (error) {
    console.error('Failed to force execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}