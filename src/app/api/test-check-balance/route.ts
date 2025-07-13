import { type NextRequest, NextResponse } from 'next/server';
import { balanceChecker } from '../../../utils/balanceChecker';

export const runtime = 'nodejs';

// Check smart wallet balance (dev only)
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const smartWallet = searchParams.get('wallet') || '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
    
    console.log('💰 Checking balance for smart wallet:', smartWallet);
    
    const balance = await balanceChecker.checkUserBalance(smartWallet as `0x${string}`);
    
    return NextResponse.json({
      success: true,
      smartWallet,
      balance: {
        usdc: balance.usdc,
        spx: balance.spx,
        eth: balance.eth,
      },
      message: `Smart wallet has ${balance.usdc} USDC, ${balance.spx} SPX, and ${balance.eth} ETH`,
    });
    
  } catch (error) {
    console.error('Failed to check balance:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}