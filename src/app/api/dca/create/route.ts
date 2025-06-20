export const runtime = 'edge';

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, frequency, duration, userAddress } = body;

    // Validate required fields
    if (!amount || !frequency || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Generate DCA order ID
    const orderId = `dca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create DCA order record
    const dcaOrder = {
      id: orderId,
      userAddress,
      amount: Number.parseFloat(amount),
      frequency,
      duration,
      status: 'active',
      createdAt: new Date().toISOString(),
      executedCount: 0,
      totalInvested: 0,
      spx6900Bought: 0,
      avgPrice: 0,
      nextExecution: getNextExecutionTime(frequency),
      // OpenOcean integration data
      openOceanOrderId: null, // Will be populated when creating actual order
      serviceFeePercentage: 0.0005, // 0.05%
      platformFeePercentage: 0.001, // 0.1%
    };

    // Store DCA order in KV
    await kv.set(`dca:order:${orderId}`, dcaOrder, { ex: 86400 * 30 }); // 30 day expiry

    // Add to user's order list
    const userOrdersKey = `dca:user:${userAddress}`;
    const userOrders = ((await kv.get(userOrdersKey)) as string[]) || [];
    userOrders.push(orderId);
    await kv.set(userOrdersKey, userOrders, { ex: 86400 * 30 });

    // TODO: Create actual OpenOcean DCA order
    // const openOceanOrder = await createOpenOceanDCAOrder(dcaOrder);
    // dcaOrder.openOceanOrderId = openOceanOrder.id;
    // await kv.set(`dca:order:${orderId}`, dcaOrder, { ex: 86400 * 30 });

    return NextResponse.json({
      success: true,
      order: dcaOrder,
      message: 'DCA order created successfully',
    });
  } catch (error) {
    console.error('Error creating DCA order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create DCA order' },
      { status: 500 },
    );
  }
}

function getNextExecutionTime(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'hour':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case 'day':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
}
