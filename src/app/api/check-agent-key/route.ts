import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Check agent key status for an order
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Parse session key data
    let sessionData;
    try {
      sessionData = JSON.parse(order.sessionKeyData);
    } catch (e) {
      return NextResponse.json({
        error: 'Invalid session key data',
        raw: order.sessionKeyData,
      });
    }

    // Check if it has agent key
    const hasAgentKey = sessionData.serverManaged && sessionData.agentKeyId;

    // If it has an agent key, check its status
    let agentKeyStatus = null;
    if (hasAgentKey) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/agent-keys?keyId=${sessionData.agentKeyId}`,
        );
        if (response.ok) {
          const data = await response.json();
          agentKeyStatus = data;
        } else {
          agentKeyStatus = {
            error: 'Failed to fetch agent key',
            status: response.status,
          };
        }
      } catch (e) {
        agentKeyStatus = { error: 'Failed to check agent key' };
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      sessionData,
      hasAgentKey,
      agentKeyId: sessionData.agentKeyId,
      agentKeyStatus,
      orderStatus: order.status,
      amountPerOrder: (
        order.totalAmount / BigInt(order.totalExecutions)
      ).toString(),
    });
  } catch (error) {
    console.error('Failed to check agent key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
