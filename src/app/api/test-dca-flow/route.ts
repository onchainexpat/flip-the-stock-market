import { type NextRequest, NextResponse } from 'next/server';
import { coinbaseSmartWalletService } from '../../../lib/coinbaseSmartWalletService';
import { TOKENS } from '../../../utils/dexApi';

export const runtime = 'edge';

// Test endpoint to verify DCA flow works end-to-end
export async function POST(request: NextRequest) {
  try {
    const { action, email, testWalletAddress } = await request.json();

    if (action === 'test-email-wallet') {
      // Test email wallet creation
      console.log(`Testing email wallet creation for: ${email}`);

      const response = await fetch(
        `${request.nextUrl.origin}/api/auth/email-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );

      const result = await response.json();

      return NextResponse.json({
        success: true,
        message: 'Email wallet test completed',
        result,
      });
    }

    if (action === 'test-session-key') {
      // Test session key generation
      console.log(`Testing session key generation for: ${testWalletAddress}`);

      const sessionKeyData =
        await coinbaseSmartWalletService.generateSessionKey(
          testWalletAddress as `0x${string}`,
          [
            {
              target: TOKENS.USDC,
              valueLimit: BigInt(100 * 1e6), // $100 USDC
              functionSelectors: ['0xa9059cbb', '0x095ea7b3'], // transfer, approve
            },
          ],
        );

      return NextResponse.json({
        success: true,
        message: 'Session key test completed',
        sessionKey: {
          address: sessionKeyData.sessionAddress,
          expiresAt: new Date(sessionKeyData.expiresAt * 1000).toISOString(),
          permissions: sessionKeyData.permissions.length,
        },
      });
    }

    if (action === 'test-wallet-support') {
      // Test wallet session key support
      console.log(
        `Testing wallet session key support for: ${testWalletAddress}`,
      );

      const supportsSessionKeys =
        await coinbaseSmartWalletService.supportsSessionKeys(
          testWalletAddress as `0x${string}`,
        );

      const isCoinbaseWallet =
        await coinbaseSmartWalletService.isCoinbaseSmartWallet(
          testWalletAddress as `0x${string}`,
        );

      return NextResponse.json({
        success: true,
        message: 'Wallet support test completed',
        results: {
          supportsSessionKeys,
          isCoinbaseWallet,
          walletAddress: testWalletAddress,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error:
        'Invalid action. Use: test-email-wallet, test-session-key, or test-wallet-support',
    });
  } catch (error) {
    console.error('DCA flow test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      },
      { status: 500 },
    );
  }
}

// GET endpoint to show available test actions
export async function GET() {
  return NextResponse.json({
    message: 'DCA Flow Test Endpoint',
    availableActions: [
      {
        action: 'test-email-wallet',
        description: 'Test email wallet creation',
        requiredFields: ['email'],
      },
      {
        action: 'test-session-key',
        description: 'Test session key generation',
        requiredFields: ['testWalletAddress'],
      },
      {
        action: 'test-wallet-support',
        description: 'Test wallet session key support',
        requiredFields: ['testWalletAddress'],
      },
    ],
    usage: 'POST with { action, ...requiredFields }',
  });
}
