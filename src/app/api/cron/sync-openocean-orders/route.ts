import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import axios from 'axios';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// POST /api/cron/sync-openocean-orders - Periodic sync of OpenOcean order statuses
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 },
      );
    }

    const cronSecret = authHeader.split(' ')[1];
    if (cronSecret !== process.env.CRON_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Invalid cron secret' },
        { status: 401 },
      );
    }

    console.log('Starting OpenOcean order sync job...');

    // Get all active OpenOcean orders
    const activeOrders = await serverDcaDatabase.getAllActiveOpenOceanOrders();

    if (activeOrders.length === 0) {
      console.log('No active OpenOcean orders found');
      return NextResponse.json({
        success: true,
        message: 'No active OpenOcean orders to sync',
        syncedOrders: 0,
        errors: [],
      });
    }

    console.log(`Found ${activeOrders.length} active OpenOcean orders to sync`);

    // Group orders by user address to minimize API calls
    const ordersByUser = new Map<string, typeof activeOrders>();
    for (const order of activeOrders) {
      const userAddress = order.userAddress;
      if (!ordersByUser.has(userAddress)) {
        ordersByUser.set(userAddress, []);
      }
      ordersByUser.get(userAddress)!.push(order);
    }

    const syncResults = [];
    const syncErrors = [];
    let totalSynced = 0;

    // Process each user's orders
    for (const [userAddress, userOrders] of ordersByUser) {
      try {
        console.log(
          `Syncing ${userOrders.length} orders for user ${userAddress}`,
        );

        // Fetch all orders for this user from OpenOcean API
        const response = await axios.get(
          `https://open-api.openocean.finance/v1/8453/dca/address/${userAddress}`,
          {
            params: {
              page: 1,
              limit: 100,
              statuses: '[1,3,4,5,6,7]', // All statuses
              sortBy: 'createDateTime',
            },
            timeout: 10000, // 10 second timeout
          },
        );

        const openOceanOrders = response.data?.data || [];

        // Sync each order for this user
        for (const localOrder of userOrders) {
          try {
            const openOceanOrder = openOceanOrders.find(
              (order: any) => order.orderHash === localOrder.orderHash,
            );

            if (!openOceanOrder) {
              // Order not found in OpenOcean API - mark as expired
              await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
                status: 'expired',
                openOceanStatus: 7, // 7 = expired
                updatedAt: Date.now(),
              });

              syncResults.push({
                orderId: localOrder.id,
                orderHash: localOrder.orderHash,
                userAddress,
                action: 'marked_expired',
                previousStatus: localOrder.status,
                newStatus: 'expired',
              });
              totalSynced++;
              continue;
            }

            // Map OpenOcean status to our internal status
            let newStatus = localOrder.status;
            const newOpenOceanStatus = openOceanOrder.statuses;

            switch (newOpenOceanStatus) {
              case 1: // unfilled
                newStatus = 'active';
                break;
              case 3: // cancelled
                newStatus = 'cancelled';
                break;
              case 4: // filled
                newStatus = 'completed';
                break;
              case 5: // pending
                newStatus = 'active';
                break;
              case 6: // hash not exist
                newStatus = 'cancelled';
                break;
              case 7: // expired
                newStatus = 'expired';
                break;
            }

            // Calculate execution progress
            const totalAmount = BigInt(openOceanOrder.makerAmount || '0');
            const remainingAmount = BigInt(
              openOceanOrder.remainingMakerAmount || '0',
            );
            const executedAmount = totalAmount - remainingAmount;
            const executionsCount = openOceanOrder.have_filled || 0;

            // Check if there are changes
            const hasChanges =
              newStatus !== localOrder.status ||
              newOpenOceanStatus !== localOrder.openOceanStatus ||
              executedAmount !== localOrder.executedAmount ||
              executionsCount !== localOrder.executionsCount;

            if (hasChanges) {
              await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
                status: newStatus,
                openOceanStatus: newOpenOceanStatus,
                executedAmount,
                executionsCount,
                remainingMakerAmount: remainingAmount,
                openOceanCreateDateTime: openOceanOrder.createDateTime,
                openOceanExpireTime: openOceanOrder.expireTime,
                updatedAt: Date.now(),
              });

              syncResults.push({
                orderId: localOrder.id,
                orderHash: localOrder.orderHash,
                userAddress,
                action: 'updated',
                previousStatus: localOrder.status,
                newStatus,
                previousExecutions: localOrder.executionsCount,
                newExecutions: executionsCount,
                executedAmount: executedAmount.toString(),
                remainingAmount: remainingAmount.toString(),
              });
              totalSynced++;
            }
          } catch (orderError) {
            console.error(
              `Error syncing order ${localOrder.orderHash}:`,
              orderError,
            );
            syncErrors.push({
              orderId: localOrder.id,
              orderHash: localOrder.orderHash,
              userAddress,
              error:
                orderError instanceof Error
                  ? orderError.message
                  : 'Unknown error',
            });
          }
        }
      } catch (userError) {
        console.error(
          `Error syncing orders for user ${userAddress}:`,
          userError,
        );

        // Record error for all orders of this user
        for (const order of userOrders) {
          syncErrors.push({
            orderId: order.id,
            orderHash: order.orderHash,
            userAddress,
            error:
              userError instanceof Error
                ? userError.message
                : 'Failed to fetch user orders',
          });
        }
      }

      // Add delay between users to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `Sync job completed: ${totalSynced} orders synced, ${syncErrors.length} errors`,
    );

    return NextResponse.json({
      success: true,
      message: `Synced ${totalSynced} orders with ${syncErrors.length} errors`,
      stats: {
        totalActiveOrders: activeOrders.length,
        uniqueUsers: ordersByUser.size,
        syncedOrders: totalSynced,
        errorCount: syncErrors.length,
        updatedOrders: syncResults.filter((r) => r.action === 'updated').length,
        expiredOrders: syncResults.filter((r) => r.action === 'marked_expired')
          .length,
      },
      syncResults: syncResults.slice(0, 10), // Return first 10 results
      errors: syncErrors.slice(0, 10), // Return first 10 errors
      syncedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error in OpenOcean sync cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync OpenOcean orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// GET /api/cron/sync-openocean-orders - Get sync job status
export async function GET(request: NextRequest) {
  try {
    // Get all active OpenOcean orders for status
    const activeOrders = await serverDcaDatabase.getAllActiveOpenOceanOrders();

    // Calculate sync status
    const now = Date.now();
    const syncThreshold = 10 * 60 * 1000; // 10 minutes

    const orderSyncStatus = activeOrders.map((order) => {
      const timeSinceLastSync = now - (order.updatedAt || order.createdAt);
      return {
        orderId: order.id,
        orderHash: order.orderHash,
        userAddress: order.userAddress,
        status: order.status,
        openOceanStatus: order.openOceanStatus,
        lastSyncAt: order.updatedAt || order.createdAt,
        timeSinceLastSync,
        needsSync: timeSinceLastSync > syncThreshold,
      };
    });

    const needsSync = orderSyncStatus.filter((o) => o.needsSync).length;
    const lastGlobalSync = Math.max(
      ...orderSyncStatus.map((o) => o.lastSyncAt),
      0,
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalActiveOrders: activeOrders.length,
        ordersNeedingSync: needsSync,
        lastGlobalSync,
        timeSinceLastGlobalSync: now - lastGlobalSync,
        syncHealthy: needsSync < activeOrders.length * 0.1, // Less than 10% need sync
      },
      orders: orderSyncStatus,
      nextSyncRecommended: needsSync > 0,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 },
    );
  }
}
