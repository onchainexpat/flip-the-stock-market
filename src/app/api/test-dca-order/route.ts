import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { TOKENS } from '../../../utils/dexApi';

export const runtime = 'edge';

export async function POST() {
  try {
    console.log('Creating test DCA order');

    // Create a test order that's due for execution soon
    const now = Date.now();
    const testOrder = {
      userAddress: '0x1234567890123456789012345678901234567890' as any,
      sessionKeyAddress: '0x0987654321098765432109876543210987654321' as any,
      sessionKeyData: JSON.stringify({ test: 'data' }), // Required field
      destinationAddress: '0x1234567890123456789012345678901234567890' as any, // Required field
      fromToken: TOKENS.USDC,
      toToken: TOKENS.SPX6900,
      totalAmount: BigInt('100000000'), // 100 USDC (6 decimals)
      frequency: 'daily' as const,
      duration: 30,
      platformFeePercentage: 0.1,
      totalPlatformFees: BigInt('100000'), // 0.1 USDC
      netInvestmentAmount: BigInt('99900000'), // 99.9 USDC
      status: 'active' as const,
      executedAmount: BigInt('0'),
      executionsCount: 0,
      totalExecutions: 30,
      estimatedPriceImpact: 1.0,
      createdAt: now,
      nextExecutionAt: now - 60000, // Execute immediately (1 minute ago)
      expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      executionTxHashes: [],
    };

    const createdOrder = await serverDcaDatabase.createOrder(testOrder);

    return NextResponse.json({
      success: true,
      message: 'Test DCA order created',
      order: {
        id: createdOrder.id,
        userAddress: createdOrder.userAddress,
        totalAmount: createdOrder.totalAmount.toString(),
        frequency: createdOrder.frequency,
        status: createdOrder.status,
        nextExecution: new Date(createdOrder.nextExecutionAt).toISOString(),
        totalExecutions: createdOrder.totalExecutions,
      },
    });
  } catch (error) {
    console.error('Failed to create test order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test DCA order creation endpoint',
    info: 'Use POST to create a test order that will be due for execution in 1 minute',
  });
}
