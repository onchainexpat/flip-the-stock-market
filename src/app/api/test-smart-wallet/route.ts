import { type NextRequest, NextResponse } from 'next/server';
import { coinbaseSmartWalletService } from '../../../lib/coinbaseSmartWalletService';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { action, email, walletAddress } = await request.json();

    if (action === 'test-email-wallet') {
      console.log(`Testing smart wallet creation for email: ${email}`);

      // Create smart wallet
      const smartWalletAddress =
        await coinbaseSmartWalletService.createSmartWalletForEmail(email);

      // Test if it supports session keys
      const supportsSessionKeys =
        await coinbaseSmartWalletService.supportsSessionKeys(
          smartWalletAddress,
        );

      // Check if it's recognized as a Coinbase Smart Wallet
      const isCoinbaseWallet =
        await coinbaseSmartWalletService.isCoinbaseSmartWallet(
          smartWalletAddress,
        );

      return NextResponse.json({
        success: true,
        results: {
          email,
          smartWalletAddress,
          supportsSessionKeys,
          isCoinbaseWallet,
          message: 'Smart wallet test completed',
        },
      });
    }

    if (action === 'test-session-key-generation') {
      console.log(`Testing session key generation for: ${walletAddress}`);

      try {
        // Test session key generation
        const sessionKeyData =
          await coinbaseSmartWalletService.generateSessionKey(
            walletAddress as `0x${string}`,
            [
              {
                target:
                  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // USDC
                valueLimit: BigInt(100 * 1e6), // $100 USDC
                functionSelectors: ['0xa9059cbb', '0x095ea7b3'], // transfer, approve
              },
            ],
          );

        return NextResponse.json({
          success: true,
          results: {
            walletAddress,
            sessionKey: {
              address: sessionKeyData.sessionAddress,
              expiresAt: new Date(
                sessionKeyData.expiresAt * 1000,
              ).toISOString(),
              permissions: sessionKeyData.permissions.length,
              hasValidPermissions: sessionKeyData.permissions.length > 0,
            },
            message: 'Session key generation successful',
          },
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          results: {
            walletAddress,
            error:
              error instanceof Error
                ? error.message
                : 'Session key generation failed',
          },
        });
      }
    }

    if (action === 'test-wallet-validation') {
      console.log(`Testing wallet validation for: ${walletAddress}`);

      // Check if wallet has contract code
      const hasCode = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [walletAddress, 'latest'],
          id: 1,
        }),
      })
        .then((res) => res.json())
        .then((data) => data.result !== '0x');

      // Test support functions
      const supportsSessionKeys =
        await coinbaseSmartWalletService.supportsSessionKeys(walletAddress);
      const isCoinbaseWallet =
        await coinbaseSmartWalletService.isCoinbaseSmartWallet(walletAddress);

      return NextResponse.json({
        success: true,
        results: {
          walletAddress,
          hasContractCode: hasCode,
          supportsSessionKeys,
          isCoinbaseWallet,
          isActualSmartContract: hasCode,
          message: hasCode
            ? 'Wallet is a deployed smart contract'
            : 'Wallet is not yet deployed (will deploy on first transaction)',
        },
      });
    }

    return NextResponse.json({
      success: false,
      error:
        'Invalid action. Use: test-email-wallet, test-session-key-generation, or test-wallet-validation',
    });
  } catch (error) {
    console.error('Smart wallet test failed:', error);
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
    message: 'Smart Wallet Test Endpoint',
    availableActions: [
      {
        action: 'test-email-wallet',
        description: 'Test smart wallet creation from email',
        requiredFields: ['email'],
      },
      {
        action: 'test-session-key-generation',
        description: 'Test session key generation for a wallet',
        requiredFields: ['walletAddress'],
      },
      {
        action: 'test-wallet-validation',
        description: 'Test wallet validation and smart contract status',
        requiredFields: ['walletAddress'],
      },
    ],
    usage: 'POST with { action, ...requiredFields }',
  });
}
