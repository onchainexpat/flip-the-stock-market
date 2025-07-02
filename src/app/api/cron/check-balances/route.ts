import { type NextRequest, NextResponse } from 'next/server';
import { balanceChecker } from '../../../../utils/balanceChecker';

export const runtime = 'edge';

// This cron job should be called every 5-10 minutes to check user balances
export async function GET(request: NextRequest) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('Balance check cron job started');

    // Run the complete balance check cycle
    await balanceChecker.runBalanceCheck();

    console.log('Balance check cron job completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Balance check completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Balance check cron job failed:', error);

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

// Allow POST requests for manual testing (without auth)
export async function POST() {
  try {
    console.log('Manual balance check trigger');

    // Run the complete balance check cycle
    await balanceChecker.runBalanceCheck();

    console.log('Manual balance check completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Manual balance check completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual balance check failed:', error);

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
