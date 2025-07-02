import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const EMAIL_VERIFICATION_KEY = (email: string) =>
  `email:verify:${email.toLowerCase()}`;

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get verification data
    const verificationData = await redis.get(
      EMAIL_VERIFICATION_KEY(normalizedEmail),
    );

    if (!verificationData) {
      return NextResponse.json(
        { error: 'No verification request found for this email' },
        { status: 404 },
      );
    }

    const {
      token: storedToken,
      walletAddress,
      verified,
    } = JSON.parse(verificationData as string);

    // If no token provided, just check verification status
    if (!token) {
      return NextResponse.json({
        success: verified,
        walletAddress: verified ? walletAddress : undefined,
        message: verified
          ? 'Email verified successfully!'
          : 'Email not yet verified',
      });
    }

    // Verify token
    if (token !== storedToken) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 },
      );
    }

    // Mark as verified
    await redis.set(
      EMAIL_VERIFICATION_KEY(normalizedEmail),
      JSON.stringify({
        token: storedToken,
        walletAddress,
        verified: true,
      }),
    );

    console.log(`✅ Email verified: ${normalizedEmail} -> ${walletAddress}`);

    return NextResponse.json({
      success: true,
      walletAddress,
      message: 'Email verified successfully! Your smart wallet is ready.',
    });
  } catch (error) {
    console.error('Email verification failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Handle GET requests for email verification links
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 },
      );
    }

    // Verify the email using the same logic as POST
    const normalizedEmail = email.toLowerCase().trim();
    const verificationData = await redis.get(
      EMAIL_VERIFICATION_KEY(normalizedEmail),
    );

    if (!verificationData) {
      return NextResponse.json(
        { error: 'Invalid verification link' },
        { status: 404 },
      );
    }

    const { token: storedToken, walletAddress } = JSON.parse(
      verificationData as string,
    );

    if (token !== storedToken) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 },
      );
    }

    // Mark as verified
    await redis.set(
      EMAIL_VERIFICATION_KEY(normalizedEmail),
      JSON.stringify({
        token: storedToken,
        walletAddress,
        verified: true,
      }),
    );

    console.log(
      `✅ Email verified via link: ${normalizedEmail} -> ${walletAddress}`,
    );

    // Redirect to app with success message
    return NextResponse.redirect(
      new URL(`/invest?verified=true&wallet=${walletAddress}`, request.url),
    );
  } catch (error) {
    console.error('Email verification via link failed:', error);
    return NextResponse.redirect(
      new URL('/invest?error=verification_failed', request.url),
    );
  }
}
