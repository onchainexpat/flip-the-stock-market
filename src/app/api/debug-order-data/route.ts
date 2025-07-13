import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Debug endpoint to check order data
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    
    if (!userAddress) {
      return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
    }

    const orders = await serverDcaDatabase.getUserOrders(userAddress as any);
    
    // Get detailed info for each order
    const detailedOrders = orders.map(order => {
      let sessionData;
      try {
        sessionData = JSON.parse(order.sessionKeyData);
      } catch (e) {
        sessionData = { error: 'Failed to parse sessionKeyData' };
      }
      
      return {
        id: order.id,
        status: order.status,
        sessionKeyData: sessionData,
        totalAmount: order.totalAmount?.toString() || 'N/A',
        amountPerOrder: order.amountPerOrder?.toString() || 'N/A',
        frequency: order.frequency,
        nextExecutionTime: order.nextExecutionTime ? new Date(order.nextExecutionTime).toISOString() : 'N/A',
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : 'N/A',
      };
    });

    return NextResponse.json({
      success: true,
      orderCount: orders.length,
      orders: detailedOrders,
    });
  } catch (error) {
    console.error('Failed to debug orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}