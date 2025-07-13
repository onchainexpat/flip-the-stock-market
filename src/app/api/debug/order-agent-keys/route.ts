import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const orders = await serverDcaDatabase.getAllActiveOrders();
    
    const orderInfo = orders.map(order => {
      try {
        const sessionData = JSON.parse(order.sessionKeyData);
        return {
          orderId: order.id,
          userAddress: order.userAddress,
          agentKeyId: sessionData.agentKeyId,
          smartWalletAddress: sessionData.smartWalletAddress,
          serverManaged: sessionData.serverManaged,
          hasSessionKeyApproval: !!sessionData.sessionKeyApproval,
        };
      } catch (e) {
        return {
          orderId: order.id,
          userAddress: order.userAddress,
          error: 'Invalid session data',
        };
      }
    });

    return NextResponse.json({
      success: true,
      totalOrders: orders.length,
      orders: orderInfo,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}