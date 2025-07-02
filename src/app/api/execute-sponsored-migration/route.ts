import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// POST: Server-side sponsored migration (not implemented)
// This approach doesn't work because each user's smart wallet is derived from their unique private key
export async function POST(request: NextRequest) {
  try {
    console.log(
      '❌ Server-side sponsored execution not possible for user wallets',
    );
    console.log(
      "💡 Each smart wallet is derived from the user's unique private key",
    );
    console.log('💡 We cannot reconstruct arbitrary user wallets server-side');

    return NextResponse.json(
      {
        error: 'Server-side execution not available for user wallets',
        details:
          "Each smart wallet is uniquely derived from the user's private key. Use client-side execution instead.",
        suggestion: 'Try the direct wallet signing option',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('❌ Sponsored migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
        details: 'Check server logs for more information',
      },
      { status: 500 },
    );
  }
}
