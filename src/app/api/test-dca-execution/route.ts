import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { serverZerodevDCAExecutor } from '../../../services/serverZerodevDCAExecutor';
import { balanceChecker } from '../../../utils/balanceChecker';

export const runtime = 'nodejs';

// Test endpoint for manual DCA execution (dev only)
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    console.log('🧪 TEST: Manual DCA execution started');

    // Get orders ready for execution
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();

    if (ordersToExecute.length === 0) {
      console.log('No DCA orders ready for execution');
      return NextResponse.json({
        success: true,
        message: 'No orders ready for execution',
        processed: 0,
      });
    }

    console.log(`Found ${ordersToExecute.length} orders ready for execution`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each order
    for (const order of ordersToExecute) {
      try {
        console.log(
          `Processing DCA order ${order.id} for user ${order.userAddress}`,
        );

        // Parse order data to check if it has agent key
        let orderData: any;
        try {
          orderData = JSON.parse(order.sessionKeyData);
        } catch (e) {
          console.log('❌ Invalid order data format');
          continue;
        }

        if (!orderData.serverManaged || !orderData.agentKeyId) {
          console.log('❌ Order not server-managed or missing agent key');
          continue;
        }

        // Check smart wallet balance
        const balance = await balanceChecker.checkUserBalance(
          orderData.smartWalletAddress,
        );

        if (balance.usdc < order.amountPerOrder) {
          console.log(
            `❌ Insufficient USDC balance in smart wallet: ${balance.usdc} < ${order.amountPerOrder}`,
          );
          failureCount++;
          results.push({
            orderId: order.id,
            error: 'Insufficient balance',
            balance: balance.usdc,
            required: order.amountPerOrder,
          });
          continue;
        }

        // Execute DCA trade
        const result = await serverZerodevDCAExecutor.executeDCAWithAgentKey(
          orderData.agentKeyId,
          orderData.smartWalletAddress,
          order.userAddress,
          order.amountPerOrder,
        );
        
        if (result.success) {
          successCount++;
          results.push({
            orderId: order.id,
            success: true,
            txHash: result.txHash,
            amountIn: result.amountIn,
            amountOut: result.amountOut,
          });
        } else {
          failureCount++;
          results.push({
            orderId: order.id,
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        failureCount++;
        results.push({
          orderId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${ordersToExecute.length} orders`,
      summary: {
        total: ordersToExecute.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
    });
  } catch (error) {
    console.error('Failed to execute DCA orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}