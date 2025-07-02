import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';
import { coinbaseSmartWalletService } from '../../../../lib/coinbaseSmartWalletService';

export const runtime = 'edge';

// Initialize Redis for storing email-wallet mappings
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis keys
const EMAIL_WALLET_KEY = (email: string) =>
  `email:wallet:${email.toLowerCase()}`;
const WALLET_EMAIL_KEY = (address: string) =>
  `wallet:email:${address.toLowerCase()}`;
const EMAIL_VERIFICATION_KEY = (email: string) =>
  `email:verify:${email.toLowerCase()}`;

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
    console.log(`Creating smart wallet for email: ${normalizedEmail}`);

    // Check if email already has a wallet
    const existingWallet = await redis.get(EMAIL_WALLET_KEY(normalizedEmail));
    if (existingWallet) {
      console.log(`Email already has wallet: ${existingWallet}`);
      return NextResponse.json({
        success: true,
        walletAddress: existingWallet,
        requiresVerification: false,
        message: 'Welcome back! Your smart wallet is ready.',
      });
    }

    // Create and deploy a real Coinbase Smart Wallet for this email
    console.log('Deploying smart contract wallet...');
    const walletAddress =
      await coinbaseSmartWalletService.createSmartWalletForEmail(
        normalizedEmail,
      );

    console.log(`Smart wallet deployed at: ${walletAddress}`);

    // Store email -> wallet mapping
    await redis.set(EMAIL_WALLET_KEY(normalizedEmail), walletAddress);
    await redis.set(WALLET_EMAIL_KEY(walletAddress), normalizedEmail);

    // In a real implementation, you would:
    // 1. Send verification email
    // 2. Deploy smart contract wallet after verification
    // 3. Set up initial permissions

    // For demo purposes, we'll skip email verification
    const requiresVerification = false; // Set to true to enable email verification

    if (requiresVerification) {
      // Generate verification token
      const verificationToken = crypto.randomUUID();
      await redis.setex(
        EMAIL_VERIFICATION_KEY(normalizedEmail),
        3600, // 1 hour expiry
        JSON.stringify({
          token: verificationToken,
          walletAddress,
          verified: false,
        }),
      );

      // In production, send email here
      console.log(
        `Verification token for ${normalizedEmail}: ${verificationToken}`,
      );
    }

    console.log(
      `✅ Smart wallet created for ${normalizedEmail}: ${walletAddress}`,
    );

    return NextResponse.json({
      success: true,
      walletAddress,
      requiresVerification,
      message: requiresVerification
        ? 'Verification email sent! Please check your inbox.'
        : 'Smart wallet created successfully!',
    });
  } catch (error) {
    console.error('Email login failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
