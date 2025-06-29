import { type NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Get execution history for a specific DCA order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const { orderId } = params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { error: 'Order ID and userAddress are required' },
        { status: 400 },
      );
    }

    // Get the order to verify ownership
    const orderKey = `dca:order:${orderId}`;
    const orderData = await redis.get(orderKey);

    if (!orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Type assertion and verify the user owns the order
    const order = orderData as any;
    if (order.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Unauthorized: You can only view your own order executions',
        },
        { status: 403 },
      );
    }

    // Get executions from Redis ZADD storage (matches record-execution storage)
    const executionKey = `dca:executions:${userAddress}:${orderId}`;
    const executionData = await redis.zrange(executionKey, 0, -1);

    console.log(`Raw execution data for ${executionKey}:`, executionData);

    // Parse execution data - handle both string and object formats
    const executions = executionData.map((item) => {
      let execution;
      try {
        // If item is already an object, use it directly
        if (typeof item === 'object' && item !== null) {
          execution = item;
        } else {
          // If item is a string, parse it
          execution = JSON.parse(item as string);
        }
      } catch (error) {
        console.error('Failed to parse execution item:', item, error);
        return null;
      }

      return {
        id: execution.id,
        orderId: execution.orderId,
        transactionHash: execution.transactionHash,
        amountIn: execution.amountIn,
        amountOut: execution.amountOut,
        executedAt: execution.executedAt,
        status: execution.status,
        swapProvider: execution.swapProvider,
        exchangeRate: execution.exchangeRate,
        gasUsed: execution.gasUsed || '0',
        gasPrice: execution.gasPrice || '0',
        priceImpact: execution.priceImpact,
      };
    }).filter(Boolean); // Remove any null entries from failed parsing

    console.log(
      `Retrieved ${executions.length} executions for order ${orderId}`,
    );

    return NextResponse.json({
      success: true,
      orderId,
      executions,
      totalExecutions: executions.length,
    });
  } catch (error) {
    console.error('Failed to get order executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
