import { NextResponse } from 'next/server';
import { SponsoredFundingService } from '../../../../services/sponsoredFundingService';

/**
 * Admin endpoint to check sponsor wallet status and set up sponsored funding
 */
export async function GET() {
  try {
    const sponsorStatus = await SponsoredFundingService.isAvailable();

    return NextResponse.json({
      success: true,
      sponsorWallet: {
        available: sponsorStatus.available,
        address: sponsorStatus.sponsorAddress,
        balance: sponsorStatus.sponsorBalance,
        configured: !!process.env.SPONSOR_WALLET_PRIVATE_KEY,
      },
      instructions: sponsorStatus.available
        ? 'Sponsor wallet is ready for automatic funding'
        : 'Set SPONSOR_WALLET_PRIVATE_KEY environment variable and fund the sponsor wallet with USDC',
    });
  } catch (error) {
    console.error('❌ Failed to check sponsor wallet:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Test sponsored funding with a small amount
 */
export async function POST(request: Request) {
  try {
    const { testAddress, amount } = await request.json();

    if (!testAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Test address required',
        },
        { status: 400 },
      );
    }

    const testAmount = BigInt((amount || 0.01) * 1e6); // Default 0.01 USDC

    const result = await SponsoredFundingService.fundAutomationWallet(
      testAddress,
      testAmount,
      testAddress,
    );

    return NextResponse.json({
      success: result.success,
      txHash: result.txHash,
      error: result.error,
      message: result.success
        ? `Successfully funded ${testAddress} with ${amount || 0.01} USDC`
        : `Funding failed: ${result.error}`,
    });
  } catch (error) {
    console.error('❌ Test funding failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
