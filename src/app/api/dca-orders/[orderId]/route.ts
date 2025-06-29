import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';

export const runtime = 'edge';

// Update DCA order status (pause, resume, cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const { orderId } = params;
    const body = await request.json();
    const { action, userAddress } = body;

    if (!orderId || !action || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, action, userAddress' },
        { status: 400 },
      );
    }

    // Get the existing order
    const existingOrder = await serverDcaDatabase.getOrder(orderId);
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the user owns this order
    if (existingOrder.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only modify your own orders' },
        { status: 403 },
      );
    }

    // Determine the new status based on action
    let newStatus: 'active' | 'paused' | 'cancelled';
    switch (action) {
      case 'pause':
        if (existingOrder.status !== 'active') {
          return NextResponse.json(
            { error: 'Can only pause active orders' },
            { status: 400 },
          );
        }
        newStatus = 'paused';
        break;

      case 'resume':
        if (existingOrder.status !== 'paused') {
          return NextResponse.json(
            { error: 'Can only resume paused orders' },
            { status: 400 },
          );
        }
        newStatus = 'active';
        break;

      case 'cancel':
        if (
          existingOrder.status === 'completed' ||
          existingOrder.status === 'cancelled'
        ) {
          return NextResponse.json(
            { error: 'Cannot cancel completed or already cancelled orders' },
            { status: 400 },
          );
        }
        newStatus = 'cancelled';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: pause, resume, or cancel' },
          { status: 400 },
        );
    }

    // Update the order status in Upstash
    const updatedOrder = await serverDcaDatabase.updateOrder(orderId, {
      status: newStatus,
      updatedAt: Date.now(),
    });

    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 },
      );
    }

    console.log(
      `Order ${orderId} status updated from ${existingOrder.status} to ${newStatus} by user ${userAddress}`,
    );

    return NextResponse.json({
      success: true,
      message: `Order ${action}${action === 'cancel' ? 'led' : 'd'} successfully`,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        userAddress: updatedOrder.userAddress,
        updatedAt: updatedOrder.updatedAt || Date.now(),
      },
    });
  } catch (error) {
    console.error('Failed to update DCA order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Delete DCA order (hard delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const { orderId } = params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, userAddress' },
        { status: 400 },
      );
    }

    // Get the existing order
    const existingOrder = await serverDcaDatabase.getOrder(orderId);
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the user owns this order
    if (existingOrder.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only delete your own orders' },
        { status: 403 },
      );
    }

    // For now, just mark as cancelled instead of hard delete
    // This preserves execution history and is safer
    const updatedOrder = await serverDcaDatabase.updateOrder(orderId, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });

    console.log(
      `Order ${orderId} deleted (marked as cancelled) by user ${userAddress}`,
    );

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
      orderId,
    });
  } catch (error) {
    console.error('Failed to delete DCA order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
