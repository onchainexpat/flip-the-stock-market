import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { TOKENS } from '../../../utils/0xApi';

export const runtime = 'edge';

// Create a new DCA order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      sessionKeyAddress,
      sessionKeyData,
      totalAmount,
      frequency,
      duration,
      platformFeePercentage,
      estimatedPriceImpact,
    } = body;

    if (
      !userAddress ||
      !sessionKeyAddress ||
      !sessionKeyData ||
      !totalAmount ||
      !frequency ||
      !duration
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const now = Date.now();
    const totalAmountBigInt = BigInt(Math.floor(Number(totalAmount) * 1e6)); // Convert to USDC wei
    const platformFees =
      (totalAmountBigInt *
        BigInt(Math.floor((platformFeePercentage || 0.1) * 100))) /
      BigInt(10000);
    const netAmount = totalAmountBigInt - platformFees;

    // Calculate total executions based on frequency and duration
    const totalExecutions = calculateTotalExecutions(
      frequency,
      Number(duration),
    );

    // Set first execution to immediate (current time + 1 minute to allow for processing)
    const nextExecutionAt = now + 60 * 1000; // Start in 1 minute

    const order = await serverDcaDatabase.createOrder({
      userAddress,
      sessionKeyAddress,
      sessionKeyData, // Store the full session key data
      fromToken: TOKENS.USDC,
      toToken: TOKENS.SPX6900,
      totalAmount: totalAmountBigInt,
      frequency,
      duration: Number(duration),
      platformFeePercentage: platformFeePercentage || 0.1,
      totalPlatformFees: platformFees,
      netInvestmentAmount: netAmount,
      status: 'active',
      executedAmount: BigInt(0),
      executionsCount: 0,
      totalExecutions,
      estimatedPriceImpact,
      createdAt: now,
      nextExecutionAt,
      expiresAt: now + Number(duration) * 24 * 60 * 60 * 1000,
      executionTxHashes: [],
    });

    return NextResponse.json({
      success: true,
      message: 'DCA order created successfully',
      order: {
        id: order.id,
        userAddress: order.userAddress,
        totalAmount: order.totalAmount.toString(),
        frequency: order.frequency,
        status: order.status,
        nextExecution: new Date(order.nextExecutionAt).toISOString(),
        totalExecutions: order.totalExecutions,
      },
    });
  } catch (error) {
    console.error('Failed to create DCA order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Get user's DCA orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 },
      );
    }

    const orders = await serverDcaDatabase.getUserOrders(
      userAddress as `0x${string}`,
    );
    const stats = await serverDcaDatabase.getUserStats(
      userAddress as `0x${string}`,
    );

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => ({
        id: order.id,
        userAddress: order.userAddress,
        totalAmount: order.totalAmount.toString(),
        frequency: order.frequency,
        status: order.status,
        executionsRemaining: order.totalExecutions - order.executionsCount,
        totalExecutions: order.totalExecutions,
        executedAmount: order.executedAmount.toString(),
        nextExecutionAt: new Date(order.nextExecutionAt).toISOString(),
        createdAt: new Date(order.createdAt).toISOString(),
        amountPerOrder: (
          order.totalAmount / BigInt(order.totalExecutions)
        ).toString(),
      })),
      stats: {
        totalOrders: stats.totalOrders,
        activeOrders: stats.activeOrders,
        completedOrders: stats.completedOrders,
        totalInvested: stats.totalInvested.toString(),
        totalExecutions: stats.totalExecutions,
      },
    });
  } catch (error) {
    console.error('Failed to get user orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Helper functions
function calculateTotalExecutions(
  frequency: string,
  durationDays: number,
): number {
  switch (frequency) {
    case 'hourly':
      return durationDays * 24;
    case 'daily':
      return durationDays;
    case 'weekly':
      return Math.ceil(durationDays / 7);
    case 'monthly':
      return Math.ceil(durationDays / 30);
    default:
      return durationDays;
  }
}

function getFrequencyInMs(frequency: string): number {
  switch (frequency) {
    case 'hourly':
      return 60 * 60 * 1000; // 1 hour
    case 'daily':
      return 24 * 60 * 60 * 1000; // 1 day
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000; // 30 days
    default:
      return 24 * 60 * 60 * 1000; // Default to daily
  }
}
