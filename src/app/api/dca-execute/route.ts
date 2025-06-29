import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';
import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';
import { TOKENS } from '../../../utils/0xApi';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// In production, this would be a secure key management service
// For now, we'll use a server-side executor account
const EXECUTOR_PRIVATE_KEY = process.env.DCA_EXECUTOR_PRIVATE_KEY;

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
  txHash: string;
  gasUsed?: string;
  status: 'success' | 'failed';
  error?: string;
  priceImpact?: number;
}

// Manual execution endpoint (for testing and manual triggers)
export async function POST(request: NextRequest) {
  try {
    const { orderId, userAddress } = await request.json();

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { error: 'Order ID and user address are required' },
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

    if (order.status !== 'active' && order.status !== 'insufficient_balance') {
      return NextResponse.json(
        { error: `Order is not active (status: ${order.status})` },
        { status: 400 },
      );
    }

    // Execute the order with manual flag
    const result = await executeOrder(order, orderKey, true);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Manual execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute order' },
      { status: 500 },
    );
  }
}

// Automatic execution endpoint (called by cron job)
export async function GET(request: NextRequest) {
  try {
    console.log('Starting automatic DCA execution check...');

    // Get all order keys
    const orderKeys = await redis.keys('dca:order:*');
    const now = new Date();
    let executedCount = 0;
    let checkedCount = 0;
    const results = [];

    // Process each order
    for (const orderKey of orderKeys) {
      const orderData = await redis.get(orderKey);
      if (!orderData) continue;

      // Type assertion and deserialize the order
      const data = orderData as any;
      const order: DCAOrder = {
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

      checkedCount++;

      // Skip if not active
      if (
        order.status !== 'active' &&
        order.status !== 'insufficient_balance'
      ) {
        continue;
      }

      // Check if order is due for execution
      const nextExecution = new Date(order.nextExecutionAt);
      if (nextExecution > now) {
        continue;
      }

      console.log(`Executing overdue order: ${order.id}`);
      try {
        const result = await executeOrder(order, orderKey, false);
        results.push(result);
        executedCount++;
      } catch (error) {
        console.error(`Failed to execute order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      checkedCount,
      executedCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Automatic execution error:', error);
    return NextResponse.json(
      { error: 'Failed to check orders' },
      { status: 500 },
    );
  }
}

async function executeOrder(
  order: DCAOrder,
  redisKey: string,
  isManual = false,
) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // Calculate execution amount
  const totalOrders = calculateTotalOrders(order);
  const remainingOrders = totalOrders - order.executionCount;

  if (remainingOrders <= 0) {
    // Mark order as completed
    order.status = 'completed';

    // Save updated order
    const serializedOrder = {
      ...order,
      executionsCount: order.executionCount,
      totalAmount: order.totalAmount,
      executedAmount: order.executedAmount,
      remainingAmount: order.remainingAmount,
      nextExecutionAt: new Date(order.nextExecutionAt).getTime(),
      createdAt: new Date(order.createdAt).getTime(),
    };
    await redis.set(redisKey, serializedOrder);

    return {
      orderId: order.id,
      success: false,
      error: 'All executions completed',
    };
  }

  const amountPerOrder = BigInt(order.totalAmount) / BigInt(totalOrders);
  const platformFee =
    (amountPerOrder * BigInt(order.platformFeePercentage)) / BigInt(10000); // 10 = 0.1% in basis points
  const netAmount = amountPerOrder - platformFee;

  // For now, simulate the execution
  // In production, this would use session keys and smart contracts
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    // For manual execution, return the swap parameters
    // The frontend will handle getting the swap quote and executing
    if (isManual) {
      return {
        orderId: order.id,
        success: true,
        requiresExecution: true,
        swapParams: {
          sellToken: TOKENS.USDC,
          buyToken: TOKENS.SPX6900,
          sellAmount: netAmount.toString(),
          userAddress: order.userAddress, // External wallet (for UI display)
          smartWalletAddress: order.sessionKeyAddress, // Smart wallet (for swap execution)
        },
        message: 'Ready to execute DCA swap',
      };
    }

    // For automatic execution, we would need proper infrastructure
    // For now, just get a price quote
    const priceResponse = await fetch(
      `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/0x-price?` +
        `sellToken=${TOKENS.USDC}&buyToken=${TOKENS.SPX6900}&sellAmount=${netAmount.toString()}`,
    );

    if (!priceResponse.ok) {
      throw new Error('Failed to get price quote');
    }

    const priceData = await priceResponse.json();

    // For automatic execution (cron), we would need proper session key infrastructure
    // For now, just mark as pending manual execution
    const mockTxHash = `pending_${Date.now()}`;

    // Create execution record
    const execution: ExecutionRecord = {
      id: executionId,
      orderId: order.id,
      executedAt: new Date().toISOString(),
      amountIn: netAmount.toString(),
      amountOut: priceData.buyAmount || '0',
      txHash: mockTxHash,
      status: 'success',
      priceImpact: Number.parseFloat(priceData.estimatedPriceImpact || '0'),
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
    await redis.set(redisKey, serializedOrder);

    return {
      orderId: order.id,
      success: true,
      execution: {
        id: executionId,
        txHash: mockTxHash,
        amountIn: netAmount.toString(),
        amountOut: priceData.buyAmount,
        priceImpact: execution.priceImpact,
      },
    };
  } catch (error) {
    console.error('Order execution failed:', error);

    // Create failed execution record
    const failedExecution: ExecutionRecord = {
      id: executionId,
      orderId: order.id,
      executedAt: new Date().toISOString(),
      amountIn: netAmount.toString(),
      amountOut: '0',
      txHash: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    await redis.zadd(`dca:executions:${order.userAddress}:${order.id}`, {
      score: Date.now(),
      member: JSON.stringify(failedExecution),
    });

    // Update next execution time even on failure
    order.nextExecutionAt = calculateNextExecutionTime(
      order.frequency,
    ).toISOString();

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
    await redis.set(redisKey, serializedOrder);

    throw error;
  }
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
