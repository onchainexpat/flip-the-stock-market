import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { serverZerodevDCAExecutor } from '../../../services/serverZerodevDCAExecutor';
import { balanceChecker } from '../../../utils/balanceChecker';

export const runtime = 'nodejs';

// Force execution of a specific DCA order (dev only)
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    console.log('🧪 FORCE TEST: Manual DCA execution for order:', orderId);

    let order;
    if (orderId) {
      // Execute specific order
      order = await serverDcaDatabase.getOrder(orderId);
      if (!order) {
        return NextResponse.json(
          {
            success: false,
            error: 'Order not found',
          },
          { status: 404 },
        );
      }
    } else {
      // Get the latest active order with server management
      const activeOrders = await serverDcaDatabase.getAllActiveOrders();
      const serverManagedOrders = activeOrders.filter((o) => {
        try {
          const data = JSON.parse(o.sessionKeyData);
          return data.serverManaged === true;
        } catch {
          return false;
        }
      });

      if (serverManagedOrders.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active server-managed orders found',
        });
      }

      // Get the most recent one
      order = serverManagedOrders.sort((a, b) => b.createdAt - a.createdAt)[0];
    }

    console.log(
      `Processing DCA order ${order.id} for user ${order.userAddress}`,
    );
    // Calculate amount per order from total amount and total executions
    const amountPerOrder = order.amountPerOrder || 
      (order.totalAmount && order.totalExecutions 
        ? BigInt(order.totalAmount) / BigInt(order.totalExecutions)
        : BigInt(order.totalAmount || 0));
    
    console.log('Order details:', {
      totalAmount: order.totalAmount?.toString(),
      amountPerOrder: amountPerOrder.toString(),
      executionsCount: order.executionsCount,
      totalExecutions: order.totalExecutions,
    });

    // Parse order data to check if it has agent key
    let orderData: any;
    try {
      orderData = JSON.parse(order.sessionKeyData);
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Invalid order data format',
      });
    }

    if (!orderData.serverManaged || !orderData.agentKeyId) {
      return NextResponse.json({
        success: false,
        error: 'Order not server-managed or missing agent key',
      });
    }

    // Check smart wallet balance
    const balance = await balanceChecker.checkUserBalance(
      orderData.smartWalletAddress,
    );

    console.log('Smart wallet balance:', {
      smartWallet: orderData.smartWalletAddress,
      usdc: balance.usdc,
      required: Number(amountPerOrder) / 1e6,
    });

    if (balance.usdc < Number(amountPerOrder) / 1e6) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient balance',
        balance: balance.usdc,
        required: Number(amountPerOrder) / 1e6,
      });
    }

    // Execute DCA trade
    console.log('💱 Executing DCA trade...');
    const result = await serverZerodevDCAExecutor.executeDCAWithAgentKey(
      orderData.agentKeyId,
      orderData.smartWalletAddress,
      order.userAddress,
      amountPerOrder,
    );

    // Convert any BigInt values to strings for JSON serialization
    const safeResult = {
      ...result,
      swapAmount: result.swapAmount?.toString(),
      spxReceived: result.spxReceived?.toString(),
      gasUsed: result.gasUsed?.toString(),
    };

    return NextResponse.json({
      success: result.success,
      orderId: order.id,
      result: safeResult,
    });
  } catch (error) {
    console.error('Failed to force execute DCA order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
