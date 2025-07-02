import { type NextRequest, NextResponse } from 'next/server';
import { coinbaseSmartWalletService } from '../../../lib/coinbaseSmartWalletService';
import { TOKENS } from '../../../utils/dexApi';

export const runtime = 'edge';

// Test endpoint to verify session key execution works
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'test-swap-creation') {
      // Test creating a swap transaction without executing it
      console.log('Testing swap transaction creation...');

      const testAmount = BigInt('1000000'); // 1 USDC (6 decimals)
      const testTaker = '0x1111111111111111111111111111111111111111';

      const swapTransaction =
        await coinbaseSmartWalletService.createSwapTransaction(
          TOKENS.USDC,
          TOKENS.SPX6900,
          testAmount,
          testTaker,
          0.015, // 1.5% slippage
        );

      return NextResponse.json({
        success: true,
        message: 'Swap transaction created successfully',
        transaction: {
          to: swapTransaction.to,
          data: swapTransaction.data.slice(0, 20) + '...', // Truncate for display
          value: swapTransaction.value?.toString(),
          gas: swapTransaction.gas?.toString(),
        },
      });
    }

    if (action === 'test-session-key-generation') {
      // Test session key generation
      console.log('Testing session key generation...');

      const testWalletAddress = '0x1111111111111111111111111111111111111111';
      const testPermissions = [
        {
          target: TOKENS.USDC,
          valueLimit: BigInt('100000000'), // 100 USDC
          functionSelectors: [
            '0xa9059cbb' as `0x${string}`,
            '0x095ea7b3' as `0x${string}`,
          ], // transfer, approve
        },
        {
          target: TOKENS.SPX6900,
          valueLimit: BigInt(0),
          functionSelectors: ['0xa9059cbb' as `0x${string}`], // transfer
        },
      ];

      const sessionKeyData =
        await coinbaseSmartWalletService.generateSessionKey(
          testWalletAddress,
          testPermissions,
        );

      return NextResponse.json({
        success: true,
        message: 'Session key generated successfully',
        sessionKey: {
          sessionAddress: sessionKeyData.sessionAddress,
          expiresAt: new Date(sessionKeyData.expiresAt * 1000).toISOString(),
          permissionsCount: sessionKeyData.permissions.length,
          userWallet: sessionKeyData.userWalletAddress,
        },
      });
    }

    if (action === 'test-session-validation') {
      // Test session key validation without execution
      console.log('Testing session key validation...');

      // Create a mock session key for testing
      const mockSessionKey = {
        sessionPrivateKey:
          '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        sessionAddress: '0x2222222222222222222222222222222222222222',
        permissions: [
          {
            target: TOKENS.USDC,
            valueLimit: BigInt('100000000'), // 100 USDC
            functionSelectors: ['0xa9059cbb', '0x095ea7b3'],
            validAfter: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
            validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
          },
        ],
        userWalletAddress: '0x1111111111111111111111111111111111111111',
        expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      };

      const testTransaction = {
        to: TOKENS.USDC,
        data: '0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240', // transfer 1 USDC
        value: BigInt(0),
      };

      // This would normally execute, but we'll just validate permissions
      console.log('Mock session key validation:', {
        sessionValid: mockSessionKey.expiresAt > Math.floor(Date.now() / 1000),
        hasUSDCPermission: mockSessionKey.permissions.some(
          (p) => p.target.toLowerCase() === TOKENS.USDC.toLowerCase(),
        ),
        functionAllowed: mockSessionKey.permissions.some((p) =>
          p.functionSelectors.includes('0xa9059cbb'),
        ),
      });

      return NextResponse.json({
        success: true,
        message: 'Session key validation test completed',
        validation: {
          sessionExpired:
            mockSessionKey.expiresAt <= Math.floor(Date.now() / 1000),
          hasRequiredPermissions: mockSessionKey.permissions.length > 0,
          targetAllowed: mockSessionKey.permissions.some(
            (p) => p.target.toLowerCase() === testTransaction.to.toLowerCase(),
          ),
        },
      });
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Use: test-swap-creation, test-session-key-generation, or test-session-validation',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Session execution test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Simple GET endpoint to check if the service is working
export async function GET() {
  return NextResponse.json({
    message: 'Session execution test endpoint is ready',
    timestamp: new Date().toISOString(),
    availableActions: [
      'test-swap-creation',
      'test-session-key-generation',
      'test-session-validation',
    ],
  });
}
