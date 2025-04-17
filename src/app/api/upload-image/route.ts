import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { put } from '@vercel/blob';
import { RateLimiter } from '../../../utils/rateLimit';

// Initialize rate limiter (5 requests per minute)
const rateLimiter = new RateLimiter(5, 60000);

export async function POST(request: Request) {
  try {
    // Get IP address from headers
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    // Check rate limit
    if (rateLimiter.isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as Blob;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image size (max 5MB - adjust if Vercel Blob has different Hobby limits)
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    // Optional: Prefix with a folder structure, e.g., 'uploads/'
    const filename = `price-comparison-${timestamp}-${randomString}.png`;

    // Save to public directory - Replace with Vercel Blob upload
    const blob = await put(filename, image, {
      access: 'public', // Make the blob publicly accessible
      // Optional: Add cache control headers if needed
      // cacheControlMaxAge: 3600 // Example: Cache for 1 hour
    });

    // Return the URL - Use the URL from the Vercel Blob response
    const imageUrl = blob.url; // Use the direct URL from Vercel Blob

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    // Consider checking error type for more specific messages (e.g., BlobError)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
} 