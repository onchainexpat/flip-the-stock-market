import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import { OpenOceanDCAService } from '@/services/openOceanDCAService';
import type { Address } from 'viem';

export const runtime = 'edge';

// GET /api/openocean-dca-orders - Get user's OpenOcean DCA orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') as Address;
    const status = searchParams.get('status');
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    let orders;
    if (status) {
      // Get orders by status
      const allOrders = await serverDcaDatabase.getUserOpenOceanOrders(userAddress);
      orders = allOrders.filter(order => order.status === status);
    } else {
      // Get all user orders
      orders = await serverDcaDatabase.getUserOpenOceanOrders(userAddress);
    }

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching OpenOcean DCA orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OpenOcean DCA orders' },
      { status: 500 }
    );
  }
}

// POST /api/openocean-dca-orders - Create new OpenOcean DCA order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      orderHash,
      orderData,
      totalAmount,
      intervalHours,
      numberOfBuys,
      minPrice,
      maxPrice,
      fromToken,
      toToken,
      destinationAddress,
      platformFeePercentage = 1.0 // 1% default platform fee
    } = body;

    // Validate required fields
    if (!userAddress || !orderHash || !orderData || !totalAmount || !intervalHours || !numberOfBuys) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate minimum constraints
    if (totalAmount < 5) {
      return NextResponse.json(
        { error: 'Minimum order amount is $5 USD' },
        { status: 400 }
      );
    }

    if (intervalHours < 1/60) {
      return NextResponse.json(
        { error: 'Minimum interval is 60 seconds' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const intervalSeconds = intervalHours * 3600;
    const totalDurationSeconds = intervalSeconds * numberOfBuys;

    // Create OpenOcean DCA order
    const openOceanOrder = await serverDcaDatabase.createOpenOceanOrder({
      userAddress,
      orderHash,
      orderData,
      fromToken: fromToken || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
      toToken: toToken || '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
      destinationAddress: destinationAddress || userAddress,
      totalAmount: BigInt(Math.floor(totalAmount * 1e6)), // Convert to USDC decimals
      intervalSeconds,
      numberOfBuys,
      minPrice,
      maxPrice,
      platformFeePercentage,
      totalPlatformFees: BigInt(Math.floor(totalAmount * platformFeePercentage * 1e6 / 100)),
      status: 'active',
      executedAmount: BigInt(0),
      executionsCount: 0,
      remainingMakerAmount: BigInt(Math.floor(totalAmount * 1e6)),
      openOceanStatus: 1, // 1 = unfilled
      createdAt: now,
      nextExecutionAt: now + intervalSeconds * 1000, // Next execution in ms
      expiresAt: now + totalDurationSeconds * 1000, // Total duration in ms
      executionTxHashes: [],
      provider: 'openocean'
    });

    return NextResponse.json({
      success: true,
      order: openOceanOrder
    });
  } catch (error) {
    console.error('Error creating OpenOcean DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to create OpenOcean DCA order' },
      { status: 500 }
    );
  }
}

// PUT /api/openocean-dca-orders - Update OpenOcean DCA order
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderHash, updates } = body;

    if (!orderId && !orderHash) {
      return NextResponse.json(
        { error: 'Order ID or order hash is required' },
        { status: 400 }
      );
    }

    let updatedOrder;
    if (orderId) {
      updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(orderId, updates);
    } else {
      updatedOrder = await serverDcaDatabase.updateOpenOceanOrderByHash(orderHash, updates);
    }

    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating OpenOcean DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to update OpenOcean DCA order' },
      { status: 500 }
    );
  }
}

// DELETE /api/openocean-dca-orders - Cancel OpenOcean DCA order
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderHash = searchParams.get('orderHash');

    if (!orderId && !orderHash) {
      return NextResponse.json(
        { error: 'Order ID or order hash is required' },
        { status: 400 }
      );
    }

    // Get the order to cancel
    let order;
    if (orderId) {
      order = await serverDcaDatabase.getOpenOceanOrder(orderId);
    } else {
      order = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash!);
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Use OpenOcean DCA service to cancel the order
    const openOceanService = new OpenOceanDCAService();
    
    // Note: This would require the user's provider to be available server-side
    // In practice, the cancellation would need to be initiated from the client
    // For now, we'll just update the status in our database
    const updatedOrder = await serverDcaDatabase.updateOpenOceanOrder(order.id, {
      status: 'cancelled',
      openOceanStatus: 3 // 3 = cancelled
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Order marked as cancelled. Complete the cancellation from the client.'
    });
  } catch (error) {
    console.error('Error cancelling OpenOcean DCA order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel OpenOcean DCA order' },
      { status: 500 }
    );
  }
}