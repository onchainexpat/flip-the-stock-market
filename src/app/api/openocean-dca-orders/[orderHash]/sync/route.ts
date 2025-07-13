import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import { OpenOceanDCAService } from '@/services/openOceanDCAService';
import axios from 'axios';

export const runtime = 'edge';

// POST /api/openocean-dca-orders/[orderHash]/sync - Sync order status with OpenOcean API
export async function POST(
  request: NextRequest,
  { params }: { params: { orderHash: string } }
) {
  try {
    const { orderHash } = params;
    
    if (!orderHash) {
      return NextResponse.json(
        { error: 'Order hash is required' },
        { status: 400 }
      );
    }

    // Get the order from our database
    const localOrder = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash);
    if (!localOrder) {
      return NextResponse.json(
        { error: 'Order not found in local database' },
        { status: 404 }
      );
    }

    try {
      // Query OpenOcean API to get current order status
      const response = await axios.get(
        `https://open-api.openocean.finance/v1/8453/dca/address/${localOrder.userAddress}`,
        {
          params: {
            page: 1,
            limit: 100,
            statuses: '[1,3,4,5,6,7]', // All statuses
            sortBy: 'createDateTime'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const allOrders = response.data?.data || [];
      const openOceanOrder = allOrders.find((order: any) => order.orderHash === orderHash);

      if (!openOceanOrder) {
        // Order not found in OpenOcean API, might be expired or deleted
        const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
          status: 'expired',
          openOceanStatus: 7, // 7 = expired
          updatedAt: Date.now()
        });

        return NextResponse.json({
          success: true,
          order: updatedOrder,
          message: 'Order not found in OpenOcean API, marked as expired'
        });
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
        default:
          newStatus = 'active';
      }

      // Calculate execution progress
      const totalAmount = BigInt(openOceanOrder.makerAmount || '0');
      const remainingAmount = BigInt(openOceanOrder.remainingMakerAmount || '0');
      const executedAmount = totalAmount - remainingAmount;
      const executionsCount = openOceanOrder.have_filled || 0;

      // Update our local order with OpenOcean data
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

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        openOceanData: openOceanOrder,
        message: 'Order status synchronized successfully'
      });

    } catch (apiError) {
      console.error('OpenOcean API sync failed:', apiError);
      
      return NextResponse.json(
        { 
          error: 'Failed to sync with OpenOcean API',
          details: apiError instanceof Error ? apiError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error syncing OpenOcean DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to sync OpenOcean DCA order' },
      { status: 500 }
    );
  }
}

// GET /api/openocean-dca-orders/[orderHash]/sync - Get sync status info
export async function GET(
  request: NextRequest,
  { params }: { params: { orderHash: string } }
) {
  try {
    const { orderHash } = params;
    
    if (!orderHash) {
      return NextResponse.json(
        { error: 'Order hash is required' },
        { status: 400 }
      );
    }

    // Get the order from our database
    const localOrder = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash);
    if (!localOrder) {
      return NextResponse.json(
        { error: 'Order not found in local database' },
        { status: 404 }
      );
    }

    // Use OpenOcean DCA service to get current status
    const openOceanService = new OpenOceanDCAService();
    const currentStatus = await openOceanService.getOrderStatus(orderHash);

    return NextResponse.json({
      success: true,
      localOrder,
      openOceanStatus: currentStatus,
      needsSync: currentStatus?.status !== localOrder.openOceanStatus,
      lastSyncAt: localOrder.updatedAt
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}