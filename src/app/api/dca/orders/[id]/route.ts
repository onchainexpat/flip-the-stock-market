export const runtime = 'edge';

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 },
      );
    }

    // Get the existing order
    const order = (await kv.get(`dca:order:${id}`)) as any;

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    // Update order status based on action
    let newStatus = order.status;
    switch (action) {
      case 'pause':
        newStatus = 'paused';
        break;
      case 'resume':
        newStatus = 'active';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        break;
    }

    const updatedOrder = {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    // Save updated order
    await kv.set(`dca:order:${id}`, updatedOrder, { ex: 86400 * 30 });

    // TODO: Update OpenOcean DCA order status
    // if (order.openOceanOrderId) {
    //   await updateOpenOceanDCAOrder(order.openOceanOrderId, action);
    // }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order ${action}d successfully`,
    });
  } catch (error) {
    console.error('Error updating DCA order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // Get the existing order
    const order = (await kv.get(`dca:order:${id}`)) as any;

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    // Cancel the order instead of deleting
    const cancelledOrder = {
      ...order,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };

    await kv.set(`dca:order:${id}`, cancelledOrder, { ex: 86400 * 30 });

    // TODO: Cancel OpenOcean DCA order
    // if (order.openOceanOrderId) {
    //   await cancelOpenOceanDCAOrder(order.openOceanOrderId);
    // }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling DCA order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel order' },
      { status: 500 },
    );
  }
}
