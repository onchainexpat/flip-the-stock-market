import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Delete a specific DCA order (dev only)
export async function DELETE(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const userAddress = searchParams.get('userAddress');

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing orderId or userAddress' },
        { status: 400 },
      );
    }

    console.log(`🗑️ Deleting order ${orderId} for user ${userAddress}`);

    // Get the order first to verify ownership
    const order = await serverDcaDatabase.getOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized - order belongs to different user' },
        { status: 403 },
      );
    }

    // Update order status to cancelled
    await serverDcaDatabase.updateOrder(orderId, {
      status: 'cancelled',
    });

    console.log(`✅ Order ${orderId} cancelled successfully`);

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} has been cancelled`,
      orderId,
    });
  } catch (error) {
    console.error('Failed to delete order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
