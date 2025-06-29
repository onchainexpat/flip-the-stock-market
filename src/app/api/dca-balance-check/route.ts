import { type NextRequest, NextResponse } from 'next/server';
import { balanceChecker } from '../../../utils/balanceChecker';

export const runtime = 'edge';

// Manual balance check endpoint (can be triggered by cron job or manually)
export async function POST(request: NextRequest) {
  try {
    console.log('Starting manual balance check...');

    // Run the complete balance check cycle
    await balanceChecker.runBalanceCheck();

    return NextResponse.json({
      success: true,
      message: 'Balance check completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Balance check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Get balance check status for a specific user
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

    // Check balance for specific user
    const balanceResult = await balanceChecker.checkUserBalance(
      userAddress as `0x${string}`,
    );

    return NextResponse.json({
      success: true,
      result: {
        userAddress: balanceResult.userAddress,
        currentBalance: balanceResult.currentBalance.toString(),
        requiredBalance: balanceResult.requiredBalance.toString(),
        hasInsufficientBalance: balanceResult.hasInsufficientBalance,
        ordersAffected: balanceResult.ordersAffected,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to check user balance:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
