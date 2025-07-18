import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';
import { serverAgentKeyService } from '../../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

// Cleanup script to handle orders with missing sessionKeyApproval
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('🧹 Starting cleanup of invalid orders...');

    // Get all active orders
    const activeOrders = await serverDcaDatabase.getAllActiveOrders();
    console.log(`Found ${activeOrders.length} active orders to check`);

    let invalidCount = 0;
    let pausedCount = 0;
    let validCount = 0;
    const results = [];

    for (const order of activeOrders) {
      try {
        // Parse order data
        let orderData: any;
        try {
          orderData = JSON.parse(order.sessionKeyData);
        } catch (e) {
          console.log(`❌ Order ${order.id}: Invalid session data format`);
          await serverDcaDatabase.updateOrderStatus(order.id, 'cancelled');
          invalidCount++;
          results.push({
            orderId: order.id,
            action: 'cancelled',
            reason: 'Invalid session data format',
          });
          continue;
        }

        // Check if order has agent key
        if (orderData.agentKeyId && orderData.serverManaged) {
          // Check if agent key exists and has sessionKeyApproval
          const agentKey = await serverAgentKeyService.getAgentKey(
            orderData.agentKeyId,
          );

          if (!agentKey) {
            console.log(`❌ Order ${order.id}: Agent key not found`);
            await serverDcaDatabase.updateOrderStatus(order.id, 'cancelled');
            invalidCount++;
            results.push({
              orderId: order.id,
              action: 'cancelled',
              reason: 'Agent key not found',
            });
          } else if (agentKey.sessionKeyApproval) {
            console.log(`✅ Order ${order.id}: Valid order`);
            validCount++;
            results.push({
              orderId: order.id,
              action: 'none',
              reason: 'Valid order',
            });
          } else {
            console.log(
              `⏸️ Order ${order.id}: Missing sessionKeyApproval - pausing order`,
            );
            await serverDcaDatabase.updateOrderStatus(order.id, 'paused');
            pausedCount++;
            results.push({
              orderId: order.id,
              action: 'paused',
              reason:
                'Missing sessionKeyApproval - requires user to recreate order',
            });
          }
        } else {
          console.log(`⚠️ Order ${order.id}: Legacy order - pausing`);
          await serverDcaDatabase.updateOrderStatus(order.id, 'paused');
          pausedCount++;
          results.push({
            orderId: order.id,
            action: 'paused',
            reason: 'Legacy order format',
          });
        }
      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          action: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `🎉 Cleanup completed: ${validCount} valid, ${pausedCount} paused, ${invalidCount} cancelled`,
    );

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      totalOrders: activeOrders.length,
      valid: validCount,
      paused: pausedCount,
      cancelled: invalidCount,
      results,
    });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
      },
      { status: 500 },
    );
  }
}

// GET endpoint for checking cleanup status
export async function GET() {
  try {
    const activeOrders = await serverDcaDatabase.getAllActiveOrders();

    let validOrders = 0;
    let invalidOrders = 0;

    for (const order of activeOrders) {
      try {
        const orderData = JSON.parse(order.sessionKeyData);
        if (orderData.agentKeyId && orderData.serverManaged) {
          const agentKey = await serverAgentKeyService.getAgentKey(
            orderData.agentKeyId,
          );
          if (agentKey && agentKey.sessionKeyApproval) {
            validOrders++;
          } else {
            invalidOrders++;
          }
        } else {
          invalidOrders++;
        }
      } catch (e) {
        invalidOrders++;
      }
    }

    return NextResponse.json({
      success: true,
      totalActiveOrders: activeOrders.length,
      validOrders,
      invalidOrders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check cleanup status',
      },
      { status: 500 },
    );
  }
}
