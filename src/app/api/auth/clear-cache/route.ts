import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Redis for clearing cache
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis keys
const EMAIL_WALLET_KEY = (email: string) =>
  `email:wallet:${email.toLowerCase()}`;
const WALLET_EMAIL_KEY = (address: string) =>
  `wallet:email:${address.toLowerCase()}`;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Clearing cache for email: ${normalizedEmail}`);

    // Get existing wallet address to clear reverse mapping
    const existingWallet = await redis.get(EMAIL_WALLET_KEY(normalizedEmail));

    // Clear email -> wallet mapping
    await redis.del(EMAIL_WALLET_KEY(normalizedEmail));

    // Clear wallet -> email mapping if it exists
    if (existingWallet) {
      await redis.del(WALLET_EMAIL_KEY(existingWallet as string));
      console.log(`Cleared wallet mapping: ${existingWallet}`);
    }

    console.log(`✅ Cache cleared for ${normalizedEmail}`);

    return NextResponse.json({
      success: true,
      message: `Cache cleared for ${normalizedEmail}`,
      clearedWallet: existingWallet,
    });
  } catch (error) {
    console.error('Cache clear failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
