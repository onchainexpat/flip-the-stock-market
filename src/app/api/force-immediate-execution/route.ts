import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Force an order to be ready for immediate execution by updating its timing
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order ID required',
        },
        { status: 400 },
      );
    }

    console.log(`⚡ Setting order for immediate execution: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order not found',
        },
        { status: 404 },
      );
    }

    if (order.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: `Order status is ${order.status}, not active`,
        },
        { status: 400 },
      );
    }

    const now = Date.now();
    const currentTime = new Date(now).toISOString();

    // Update the order to be ready for immediate execution
    // Set nextExecutionAt to now (making it immediately ready)
    const updatedOrder = await serverDcaDatabase.updateOrder(orderId, {
      nextExecutionAt: now - 1000, // 1 second ago to ensure it's ready
      updatedAt: now,
    });

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update order timing',
        },
        { status: 500 },
      );
    }

    console.log(`✅ Order ${orderId} updated for immediate execution`);
    console.log(
      `   Previous nextExecutionAt: ${new Date(order.nextExecutionAt).toISOString()}`,
    );
    console.log(
      `   New nextExecutionAt: ${new Date(now - 1000).toISOString()}`,
    );
    console.log(`   Current time: ${currentTime}`);

    // Verify it's now ready for execution
    const ordersReady = await serverDcaDatabase.getOrdersDueForExecution();
    const isReady = ordersReady.some((o) => o.id === orderId);

    return NextResponse.json({
      success: true,
      message: 'Order updated for immediate execution',
      orderId: orderId,
      timing: {
        previousNextExecution: new Date(order.nextExecutionAt).toISOString(),
        newNextExecution: new Date(now - 1000).toISOString(),
        currentTime: currentTime,
        isReadyForExecution: isReady,
      },
      note: 'Gelato should pick this up in the next 5-minute check cycle',
    });
  } catch (error) {
    console.error('❌ Failed to set immediate execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
