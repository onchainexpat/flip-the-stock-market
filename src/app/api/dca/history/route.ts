export const runtime = 'edge';

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Mock executions for development
const mockExecutions = [
  {
    id: 'exec_mock_1',
    orderId: 'dca_mock_1',
    amount: 50,
    spx6900Amount: 37.5,
    price: 1.333,
    fees: 0.075,
    executedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    txHash: '0x' + 'a'.repeat(64),
  },
  {
    id: 'exec_mock_2',
    orderId: 'dca_mock_1',
    amount: 50,
    spx6900Amount: 38.2,
    price: 1.309,
    fees: 0.075,
    executedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    txHash: '0x' + 'b'.repeat(64),
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

    // Try to get user's execution history from KV, fallback to mock data
    let executions: any[] = [];
    try {
      const executionsKey = `dca:executions:${userAddress}`;
      executions = ((await kv.get(executionsKey)) as any[]) || [];
    } catch (kvError) {
      console.log('KV not available, using mock executions');
      executions = mockExecutions;
    }

    // Sort by execution date (newest first)
    const sortedExecutions = executions.sort(
      (a, b) =>
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
    );

    return NextResponse.json({
      success: true,
      executions: sortedExecutions,
    });
  } catch (error) {
    console.error('Error fetching DCA history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch execution history' },
      { status: 500 },
    );
  }
}

// Mock function to simulate DCA execution (for demo purposes)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, userAddress } = body;

    // Generate mock execution
    const execution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      userAddress,
      amount: 50, // Mock amount
      spx6900Amount: 37.5, // Mock SPX6900 received
      price: 1.333, // Mock price
      fees: 0.075, // Mock fees
      executedAt: new Date().toISOString(),
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'completed',
    };

    // Save execution to user's history
    const executionsKey = `dca:executions:${userAddress}`;
    const executions = ((await kv.get(executionsKey)) as any[]) || [];
    executions.push(execution);

    // Keep only last 100 executions
    if (executions.length > 100) {
      executions.splice(0, executions.length - 100);
    }

    await kv.set(executionsKey, executions, { ex: 86400 * 30 });

    // Update the DCA order stats
    const order = (await kv.get(`dca:order:${orderId}`)) as any;
    if (order) {
      const updatedOrder = {
        ...order,
        executedCount: order.executedCount + 1,
        totalInvested: order.totalInvested + execution.amount,
        spx6900Bought: order.spx6900Bought + execution.spx6900Amount,
        avgPrice:
          (order.totalInvested + execution.amount) /
          (order.spx6900Bought + execution.spx6900Amount),
        lastExecution: execution.executedAt,
      };

      await kv.set(`dca:order:${orderId}`, updatedOrder, { ex: 86400 * 30 });
    }

    return NextResponse.json({
      success: true,
      execution,
      message: 'DCA execution recorded successfully',
    });
  } catch (error) {
    console.error('Error recording DCA execution:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record execution' },
      { status: 500 },
    );
  }
}
