import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';
import { serverZerodevDCAExecutor } from '../../../../services/serverZerodevDCAExecutor';
import { balanceChecker } from '../../../../utils/balanceChecker';

export const runtime = 'nodejs';

// Enhanced DCA cron job with server-side agent keys
export async function GET(request: NextRequest) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('🚀 DCA V2 execution cron job started');

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

        // Check if this order uses server-side agent key
        if (orderData.agentKeyId) {
          console.log('🔐 Order uses server-side agent key');
          
          // Calculate amount per order
          const amountPerOrder = order.totalAmount / BigInt(order.totalExecutions);
          
          // Execute using server-side agent key
          const result = await serverZerodevDCAExecutor.executeDCAWithAgentKey(
            orderData.agentKeyId,
            orderData.smartWalletAddress,
            order.destinationAddress || order.userAddress,
            amountPerOrder,
          );

          if (result.success) {
            successCount++;
            console.log(`✅ Successfully executed order ${order.id}`);
            
            // Record execution
            await serverDcaDatabase.recordExecution({
              orderId: order.id,
              amountIn: amountPerOrder,
              amountOut: BigInt(result.spxReceived || '0'),
              txHash: result.txHash!,
              executedAt: Math.floor(Date.now() / 1000),
              status: 'completed',
              gasUsed: result.gasUsed || BigInt('0'),
              gasPrice: BigInt('0'), // Gas sponsored
              blockNumber: 0,
            });

            results.push({
              orderId: order.id,
              userAddress: order.userAddress,
              success: true,
              txHash: result.txHash,
              transactions: result.transactions,
            });
          } else {
            failureCount++;
            console.error(`❌ Failed to execute order ${order.id}:`, result.error);
            
            results.push({
              orderId: order.id,
              userAddress: order.userAddress,
              success: false,
              error: result.error,
            });
          }
        } else {
          // Legacy session key execution (fallback)
          console.log('⚠️ Order uses legacy session keys - skipping');
          results.push({
            orderId: order.id,
            userAddress: order.userAddress,
            success: false,
            error: 'Legacy session key orders not supported in V2',
          });
          failureCount++;
        }
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing order ${order.id}:`, error);

        results.push({
          orderId: order.id,
          userAddress: order.userAddress,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `DCA V2 execution completed: ${successCount} success, ${failureCount} failures`,
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${ordersToExecute.length} orders`,
      processed: ordersToExecute.length,
      successful: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error('DCA V2 execution cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
      },
      { status: 500 },
    );
  }
}

// Manual trigger for testing
export async function POST() {
  console.log('🧪 Manual DCA V2 execution trigger');
  
  // Create a fake auth header for manual testing
  const fakeRequest = new Request('http://localhost', {
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET_KEY}`,
    },
  });
  
  return GET(fakeRequest as NextRequest);
}