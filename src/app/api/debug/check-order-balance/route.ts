import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';
import { balanceChecker } from '../../../../utils/balanceChecker';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Parse order data
    const sessionData = JSON.parse(order.sessionKeyData);
    const smartWalletAddress = sessionData.smartWalletAddress;

    // Check USDC balance
    const balance = await balanceChecker.getUSDCBalance(smartWalletAddress);
    const amountPerOrder = order.totalAmount / BigInt(order.totalExecutions);

    return NextResponse.json({
      success: true,
      orderId,
      smartWalletAddress,
      usdcBalance: balance.toString(),
      usdcBalanceFormatted: (Number(balance) / 1e6).toFixed(6),
      amountPerOrder: amountPerOrder.toString(),
      amountPerOrderFormatted: (Number(amountPerOrder) / 1e6).toFixed(6),
      hasSufficientBalance: balance >= amountPerOrder,
      executionsRemaining: order.totalExecutions - order.executionsCount,
      status: order.status,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}