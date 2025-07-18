import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';
import { serverAgentKeyService } from '../../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

// Migration script to fix existing orders missing sessionKeyApproval
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('🔧 Starting migration to fix missing sessionKeyApproval...');

    // Get all active orders
    const activeOrders = await serverDcaDatabase.getAllActiveOrders();
    console.log(`Found ${activeOrders.length} active orders to check`);

    let migratedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const order of activeOrders) {
      try {
        // Parse order data
        let orderData: any;
        try {
          orderData = JSON.parse(order.sessionKeyData);
        } catch (e) {
          console.log(`❌ Order ${order.id}: Invalid session data format`);
          results.push({
            orderId: order.id,
            success: false,
            error: 'Invalid session data format',
          });
          continue;
        }

        // Check if order has agent key but missing sessionKeyApproval
        if (
          orderData.agentKeyId &&
          orderData.serverManaged &&
          !orderData.sessionKeyApproval
        ) {
          console.log(
            `🔧 Order ${order.id}: Missing sessionKeyApproval, attempting to retrieve...`,
          );

          // Try to get the agent key data
          const agentKey = await serverAgentKeyService.getAgentKey(
            orderData.agentKeyId,
          );

          if (agentKey && agentKey.sessionKeyApproval) {
            // Update the order with the sessionKeyApproval
            const updatedSessionData = {
              ...orderData,
              sessionKeyApproval: agentKey.sessionKeyApproval,
            };

            await serverDcaDatabase.updateOrder(order.id, {
              sessionKeyData: JSON.stringify(updatedSessionData),
            });

            console.log(
              `✅ Order ${order.id}: Added sessionKeyApproval to order data`,
            );
            migratedCount++;
            results.push({
              orderId: order.id,
              success: true,
              message: 'Added sessionKeyApproval to order data',
            });
          } else {
            console.log(
              `❌ Order ${order.id}: Agent key not found or no sessionKeyApproval`,
            );
            results.push({
              orderId: order.id,
              success: false,
              error: 'Agent key not found or no sessionKeyApproval',
            });
          }
        } else {
          console.log(
            `✅ Order ${order.id}: Already has sessionKeyApproval or not server-managed`,
          );
          skippedCount++;
          results.push({
            orderId: order.id,
            success: true,
            message: 'Already has sessionKeyApproval or not server-managed',
          });
        }
      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `🎉 Migration completed: ${migratedCount} migrated, ${skippedCount} skipped`,
    );

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      totalOrders: activeOrders.length,
      migrated: migratedCount,
      skipped: skippedCount,
      results,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      },
      { status: 500 },
    );
  }
}

// GET endpoint for checking migration status
export async function GET() {
  try {
    const activeOrders = await serverDcaDatabase.getAllActiveOrders();

    let needsMigration = 0;
    let alreadyMigrated = 0;

    for (const order of activeOrders) {
      try {
        const orderData = JSON.parse(order.sessionKeyData);
        if (orderData.agentKeyId && orderData.serverManaged) {
          if (orderData.sessionKeyApproval) {
            alreadyMigrated++;
          } else {
            needsMigration++;
          }
        }
      } catch (e) {
        // Skip invalid orders
      }
    }

    return NextResponse.json({
      success: true,
      totalActiveOrders: activeOrders.length,
      needsMigration,
      alreadyMigrated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check migration status',
      },
      { status: 500 },
    );
  }
}
