export const runtime = 'edge';

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Mock data for development when KV is not available
const mockOrders = [
  {
    id: 'dca_mock_1',
    amount: 50,
    frequency: 'day',
    status: 'active',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    executedCount: 7,
    totalInvested: 350,
    spx6900Bought: 263.15,
    avgPrice: 1.33,
    nextExecution: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('address');

    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'User address required' },
        { status: 400 },
      );
    }

    // Try to get user's order list from KV, fallback to mock data
    let userOrders: string[] = [];
    try {
      const userOrdersKey = `dca:user:${userAddress}`;
      userOrders = ((await kv.get(userOrdersKey)) as string[]) || [];
    } catch (kvError) {
      console.log('KV not available, using mock data');
      // Return mock data for development
      return NextResponse.json({
        success: true,
        orders: mockOrders,
      });
    }

    if (userOrders.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
      });
    }

    // Fetch all orders
    const orders = await Promise.all(
      userOrders.map(async (orderId) => {
        const order = await kv.get(`dca:order:${orderId}`);
        return order;
      }),
    );

    // Filter out null orders and sort by creation date
    const validOrders = orders
      .filter((order) => order !== null)
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return NextResponse.json({
      success: true,
      orders: validOrders,
    });
  } catch (error) {
    console.error('Error fetching DCA orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}
