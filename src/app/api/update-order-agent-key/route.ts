import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Update an order to use a new agent key
export async function POST(request: Request) {
  try {
    const { orderId, newAgentKeyId } = await request.json();

    if (!orderId || !newAgentKeyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order ID and new agent key ID required',
        },
        { status: 400 },
      );
    }

    console.log(
      `🔄 Updating order ${orderId} to use agent key ${newAgentKeyId}`,
    );

    // Get the current order
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

    // Parse current session key data
    const currentSessionData =
      typeof order.sessionKeyData === 'string'
        ? JSON.parse(order.sessionKeyData)
        : order.sessionKeyData;

    // Update the session key data with new agent key ID
    const updatedSessionData = {
      ...currentSessionData,
      agentKeyId: newAgentKeyId,
      updatedAt: Date.now(),
      updatedReason: 'Switched to gasless session key',
    };

    // Update the order in the database
    await serverDcaDatabase.updateOrder(orderId, {
      sessionKeyData: JSON.stringify(updatedSessionData),
    });

    console.log('✅ Order updated successfully');
    console.log(`   Old agent key: ${currentSessionData.agentKeyId}`);
    console.log(`   New agent key: ${newAgentKeyId}`);

    return NextResponse.json({
      success: true,
      message: 'Order updated with new gasless agent key',
      orderId,
      oldAgentKeyId: currentSessionData.agentKeyId,
      newAgentKeyId,
      sessionData: updatedSessionData,
    });
  } catch (error) {
    console.error('❌ Failed to update order agent key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
