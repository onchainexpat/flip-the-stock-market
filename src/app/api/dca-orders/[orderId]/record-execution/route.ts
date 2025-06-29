import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface ExecutionRecord {
  id: string;
  orderId: string;
  executedAt: string;
  amountIn: string;
  amountOut: string;
  transactionHash: string;
  status: 'completed' | 'failed';
  swapProvider?: string;
  exchangeRate?: string;
  gasUsed?: string;
  gasPrice?: string;
  priceImpact?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const { orderId } = params;
    const { 
      userAddress, 
      txHash, 
      amountIn, 
      amountOut, 
      swapProvider, 
      gasUsed, 
      gasPrice, 
      priceImpact 
    } = await request.json();

    if (!userAddress || !txHash || !amountIn || !amountOut) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Get the order
    const orderKey = `dca:order:${orderId}`;
    const orderData = await redis.get(orderKey);

    if (!orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Type assertion and verify the user owns the order
    const data = orderData as any;
    if (data.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Calculate exchange rate
    const exchangeRate = amountOut !== '0' 
      ? (Number(amountOut) / 1e8 / (Number(amountIn) / 1e6)).toFixed(6)
      : '0';
    
    const execution: ExecutionRecord = {
      id: executionId,
      orderId,
      executedAt: new Date().toISOString(),
      amountIn,
      amountOut,
      transactionHash: txHash,
      status: 'completed',
      swapProvider: swapProvider || 'unknown',
      exchangeRate,
      gasUsed,
      gasPrice,
      priceImpact,
    };

    // Store execution record
    await redis.zadd(`dca:executions:${userAddress}:${orderId}`, {
      score: Date.now(),
      member: JSON.stringify(execution),
    });

    // Update order stats
    const totalOrders = data.totalExecutions || 24; // Default to 24 for hourly
    const executionCount = (data.executionsCount || 0) + 1;
    const executedAmount =
      BigInt(data.executedAmount || '0') + BigInt(amountIn);

    // Calculate next execution time based on frequency
    const frequencyMs = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const nextExecutionAt = new Date(
      Date.now() +
        (frequencyMs[data.frequency as keyof typeof frequencyMs] ||
          frequencyMs.daily),
    );

    // Update order
    const updatedOrder = {
      ...data,
      executionsCount: executionCount,
      executedAmount: executedAmount.toString(),
      remainingAmount: (BigInt(data.totalAmount) - executedAmount).toString(),
      lastExecutedAt: new Date().toISOString(),
      nextExecutionAt: nextExecutionAt.getTime(),
      status: executionCount >= totalOrders ? 'completed' : data.status,
    };

    await redis.set(orderKey, updatedOrder);

    console.log(`Execution recorded for order ${orderId}: ${txHash}`);

    return NextResponse.json({
      success: true,
      execution,
      orderStatus: updatedOrder.status,
      executionsRemaining: totalOrders - executionCount,
    });
  } catch (error) {
    console.error('Failed to record execution:', error);
    return NextResponse.json(
      { error: 'Failed to record execution' },
      { status: 500 },
    );
  }
}
