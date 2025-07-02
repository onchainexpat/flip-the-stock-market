import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface DCAOrder {
  id: string;
  userAddress: string;
  sessionKeyAddress: string;
  totalAmount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  status:
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'insufficient_balance';
  executedAmount: string;
  remainingAmount: string;
  executionCount: number;
  totalExecutions?: number;
  lastExecutedAt?: string;
  nextExecutionAt: string;
  createdAt: string;
  platformFeePercentage: number;
}

interface ExecutionRecord {
  id: string;
  orderId: string;
  executedAt: string;
  amountIn: string;
  amountOut: string;
  transactionHash: string;
  gasUsed?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  priceImpact?: number;
}

function calculateTotalOrders(order: DCAOrder): number {
  // Get the total orders from the order itself if available
  if ('totalExecutions' in order && order.totalExecutions) {
    return order.totalExecutions;
  }

  // Otherwise calculate based on frequency and duration
  const duration = 30; // Default 30 days

  switch (order.frequency) {
    case 'hourly':
      return duration * 24; // 24 orders per day
    case 'daily':
      return duration; // 1 order per day
    case 'weekly':
      return Math.ceil(duration / 7); // 1 order per week
    case 'monthly':
      return Math.ceil(duration / 30); // 1 order per month
    default:
      return duration;
  }
}

function calculateNextExecutionTime(frequency: string): Date {
  const now = new Date();

  switch (frequency) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// Record successful manual DCA execution
export async function POST(request: NextRequest) {
  try {
    const { orderId, userAddress, txHash, amountIn, amountOut, gasUsed } =
      await request.json();

    if (!orderId || !userAddress || !txHash || !amountIn) {
      return NextResponse.json(
        {
          error:
            'Order ID, user address, transaction hash, and amount in are required',
        },
        { status: 400 },
      );
    }

    // Fetch the order using the correct key format
    const orderKey = `dca:order:${orderId}`;
    const orderData = await redis.get(orderKey);

    let order: DCAOrder | null = null;
    if (orderData) {
      // Type assertion for the order data from Redis
      const data = orderData as any;

      // Deserialize the order (convert string bigints back to BigInt)
      order = {
        ...data,
        totalAmount: data.totalAmount,
        executedAmount: data.executedAmount || '0',
        remainingAmount:
          data.remainingAmount ||
          (
            BigInt(data.totalAmount) - BigInt(data.executedAmount || '0')
          ).toString(),
        executionCount: data.executionsCount || 0,
        totalExecutions: data.totalExecutions,
        platformFeePercentage:
          typeof data.platformFeePercentage === 'number' &&
          data.platformFeePercentage < 1
            ? Math.floor(data.platformFeePercentage * 100) // Convert 0.1 to 10 basis points
            : data.platformFeePercentage || 10,
        nextExecutionAt: new Date(data.nextExecutionAt).toISOString(),
        createdAt: new Date(data.createdAt).toISOString(),
        frequency: data.frequency,
        status: data.status,
        userAddress: data.userAddress,
        sessionKeyAddress: data.sessionKeyAddress,
        id: data.id,
      } as DCAOrder;
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the order belongs to the user
    if (order.userAddress !== userAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate execution details
    const totalOrders = calculateTotalOrders(order);
    const amountPerOrder = BigInt(order.totalAmount) / BigInt(totalOrders);
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create execution record
    const execution: ExecutionRecord = {
      id: executionId,
      orderId: order.id,
      executedAt: new Date().toISOString(),
      amountIn: amountIn,
      amountOut: amountOut || '0',
      transactionHash: txHash,
      gasUsed: gasUsed,
      status: 'completed',
    };

    // Store execution record
    await redis.zadd(`dca:executions:${order.userAddress}:${order.id}`, {
      score: Date.now(),
      member: JSON.stringify(execution),
    });

    // Update order
    order.executionCount += 1;
    order.executedAmount = (
      BigInt(order.executedAmount) + amountPerOrder
    ).toString();
    order.remainingAmount = (
      BigInt(order.remainingAmount) - amountPerOrder
    ).toString();
    order.lastExecutedAt = new Date().toISOString();
    order.nextExecutionAt = calculateNextExecutionTime(
      order.frequency,
    ).toISOString();

    // Check if order is complete
    if (order.executionCount >= totalOrders) {
      order.status = 'completed';
      console.log(
        `✅ Order ${orderId} marked as completed after ${order.executionCount}/${totalOrders} executions`,
      );
    }

    // Save updated order back to Redis
    const serializedOrder = {
      ...order,
      executionsCount: order.executionCount,
      totalAmount: order.totalAmount,
      executedAmount: order.executedAmount,
      remainingAmount: order.remainingAmount,
      nextExecutionAt: new Date(order.nextExecutionAt).getTime(),
      createdAt: new Date(order.createdAt).getTime(),
    };
    await redis.set(orderKey, serializedOrder);

    console.log(`✅ Manual DCA execution recorded: ${executionId}`);
    console.log(
      `📊 Order status: ${order.status} (${order.executionCount}/${totalOrders})`,
    );

    return NextResponse.json({
      success: true,
      execution: {
        id: executionId,
        transactionHash: txHash,
        amountIn: amountIn,
        amountOut: amountOut,
        status: order.status,
        executionCount: order.executionCount,
        totalExecutions: totalOrders,
      },
      message:
        order.status === 'completed'
          ? 'Order completed!'
          : 'Execution recorded successfully',
    });
  } catch (error) {
    console.error('Failed to record manual execution:', error);
    return NextResponse.json(
      { error: 'Failed to record execution' },
      { status: 500 },
    );
  }
}
