import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import axios from 'axios';
import type { Address } from 'viem';

export const runtime = 'edge';

// POST /api/openocean-dca-orders/sync-all - Sync all OpenOcean DCA orders for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, forceSync = false } = body;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    // Get all local OpenOcean orders for this user
    const localOrders = await serverDcaDatabase.getUserOpenOceanOrders(userAddress);
    
    if (localOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No OpenOcean orders found for this user',
        syncedOrders: [],
        errors: []
      });
    }

    // Fetch all orders from OpenOcean API for this user
    let openOceanOrders: any[] = [];
    try {
      const response = await axios.get(
        `https://open-api.openocean.finance/v1/8453/dca/address/${userAddress}`,
        {
          params: {
            page: 1,
            limit: 100,
            statuses: '[1,3,4,5,6,7]', // All statuses
            sortBy: 'createDateTime'
          },
          timeout: 15000 // 15 second timeout
        }
      );

      openOceanOrders = response.data?.data || [];
    } catch (apiError) {
      console.error('Failed to fetch orders from OpenOcean API:', apiError);
      return NextResponse.json(
        { error: 'Failed to fetch orders from OpenOcean API' },
        { status: 500 }
      );
    }

    const syncResults = [];
    const syncErrors = [];

    // Sync each local order with OpenOcean data
    for (const localOrder of localOrders) {
      try {
        const openOceanOrder = openOceanOrders.find(
          (order: any) => order.orderHash === localOrder.orderHash
        );

        if (!openOceanOrder) {
          // Order not found in OpenOcean API - might be expired or deleted
          if (localOrder.status !== 'expired' || forceSync) {
            const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
              status: 'expired',
              openOceanStatus: 7, // 7 = expired
              updatedAt: Date.now()
            });

            syncResults.push({
              orderId: localOrder.id,
              orderHash: localOrder.orderHash,
              action: 'marked_expired',
              previousStatus: localOrder.status,
              newStatus: 'expired',
              order: updatedOrder
            });
          }
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
        const remainingAmount = BigInt(openOceanOrder.remainingMakerAmount || '0');
        const executedAmount = totalAmount - remainingAmount;
        const executionsCount = openOceanOrder.have_filled || 0;

        // Only update if there are changes or forceSync is true
        const hasChanges = forceSync ||
          newStatus !== localOrder.status ||
          newOpenOceanStatus !== localOrder.openOceanStatus ||
          executedAmount !== localOrder.executedAmount ||
          executionsCount !== localOrder.executionsCount;

        if (hasChanges) {
          const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
            status: newStatus,
            openOceanStatus: newOpenOceanStatus,
            executedAmount,
            executionsCount,
            remainingMakerAmount: remainingAmount,
            openOceanCreateDateTime: openOceanOrder.createDateTime,
            openOceanExpireTime: openOceanOrder.expireTime,
            updatedAt: Date.now()
          });

          syncResults.push({
            orderId: localOrder.id,
            orderHash: localOrder.orderHash,
            action: 'updated',
            previousStatus: localOrder.status,
            newStatus,
            previousExecutions: localOrder.executionsCount,
            newExecutions: executionsCount,
            order: updatedOrder
          });
        } else {
          syncResults.push({
            orderId: localOrder.id,
            orderHash: localOrder.orderHash,
            action: 'no_changes',
            status: newStatus,
            executionsCount
          });
        }

      } catch (error) {
        console.error(`Error syncing order ${localOrder.orderHash}:`, error);
        syncErrors.push({
          orderId: localOrder.id,
          orderHash: localOrder.orderHash,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResults.length} orders with ${syncErrors.length} errors`,
      syncedOrders: syncResults,
      errors: syncErrors,
      stats: {
        totalOrders: localOrders.length,
        syncedOrders: syncResults.length,
        updatedOrders: syncResults.filter(r => r.action === 'updated').length,
        expiredOrders: syncResults.filter(r => r.action === 'marked_expired').length,
        noChangesOrders: syncResults.filter(r => r.action === 'no_changes').length,
        errorCount: syncErrors.length
      }
    });

  } catch (error) {
    console.error('Error syncing all OpenOcean DCA orders:', error);
    return NextResponse.json(
      { error: 'Failed to sync OpenOcean DCA orders' },
      { status: 500 }
    );
  }
}

// GET /api/openocean-dca-orders/sync-all - Get sync status for all user orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') as Address;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    // Get all local OpenOcean orders for this user
    const localOrders = await serverDcaDatabase.getUserOpenOceanOrders(userAddress);
    
    if (localOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No OpenOcean orders found for this user',
        orders: [],
        needsSync: false
      });
    }

    // Calculate sync status for each order
    const orderSyncStatus = localOrders.map(order => {
      const timeSinceLastSync = Date.now() - (order.updatedAt || order.createdAt);
      const needsSync = timeSinceLastSync > 5 * 60 * 1000; // 5 minutes

      return {
        orderId: order.id,
        orderHash: order.orderHash,
        status: order.status,
        openOceanStatus: order.openOceanStatus,
        lastSyncAt: order.updatedAt,
        timeSinceLastSync,
        needsSync,
        isActive: order.status === 'active'
      };
    });

    const totalNeedsSync = orderSyncStatus.filter(o => o.needsSync).length;
    const activeOrders = orderSyncStatus.filter(o => o.isActive).length;

    return NextResponse.json({
      success: true,
      orders: orderSyncStatus,
      summary: {
        totalOrders: localOrders.length,
        activeOrders,
        needsSync: totalNeedsSync,
        lastGlobalSync: Math.max(...localOrders.map(o => o.updatedAt || o.createdAt))
      },
      needsSync: totalNeedsSync > 0
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}