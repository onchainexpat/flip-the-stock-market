import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import { OpenOceanDCAService } from '@/services/openOceanDCAService';
import axios from 'axios';

export const runtime = 'edge';

// POST /api/openocean-dca-orders/[orderHash]/cancel - Cancel OpenOcean DCA order
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
    const order = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is already cancelled or completed
    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json(
        { error: `Order is already ${order.status}` },
        { status: 400 }
      );
    }

    try {
      // Try to cancel via OpenOcean API first
      const response = await axios.post(
        'https://open-api.openocean.finance/v1/8453/dca/cancel',
        { orderHash },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10 second timeout
        }
      );

      const cancelResult = response.data;
      let newStatus = 'cancelled';
      let newOpenOceanStatus = 3; // 3 = cancelled

      // Check the API response for actual status
      if (cancelResult?.data?.status) {
        newOpenOceanStatus = cancelResult.data.status;
        
        // Map OpenOcean status to our status
        switch (newOpenOceanStatus) {
          case 3:
            newStatus = 'cancelled';
            break;
          case 4:
            newStatus = 'completed';
            break;
          default:
            newStatus = 'cancelled'; // Default to cancelled if we attempted cancellation
        }
      }

      // Update order status in our database
      const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(order.id, {
        status: newStatus,
        openOceanStatus: newOpenOceanStatus,
        updatedAt: Date.now()
      });

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        openOceanResponse: cancelResult,
        message: 'Order cancelled successfully via OpenOcean API'
      });

    } catch (apiError) {
      console.error('OpenOcean API cancellation failed:', apiError);
      
      // If API cancellation fails, mark as cancelled in our database
      // The user will need to handle on-chain cancellation from the client
      const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(order.id, {
        status: 'cancelled',
        openOceanStatus: 3,
        updatedAt: Date.now()
      });

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        message: 'Order marked as cancelled. On-chain cancellation may be required.',
        requiresOnChainCancellation: true,
        orderData: order.orderData
      });
    }

  } catch (error) {
    console.error('Error cancelling OpenOcean DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel OpenOcean DCA order' },
      { status: 500 }
    );
  }
}