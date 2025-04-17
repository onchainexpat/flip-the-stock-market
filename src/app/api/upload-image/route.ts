import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { headers } from 'next/headers';
import { RateLimiter } from '../../../utils/rateLimit';
import { ImageCleanup } from '../../../utils/imageCleanup';

// Initialize rate limiter (5 requests per minute)
const rateLimiter = new RateLimiter(5, 60000);

// Initialize image cleanup (1 hour max age, check every 15 minutes)
const tempDir = join(process.cwd(), 'public', 'temp');
const imageCleanup = new ImageCleanup(tempDir, 3600000);
imageCleanup.startPeriodicCleanup(900000);

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

    // Validate image size (max 5MB)
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await image.arrayBuffer());

    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `price-comparison-${timestamp}-${randomString}.png`;

    // Ensure temp directory exists
    const filepath = join(tempDir, filename);
    
    // Save to public directory
    await writeFile(filepath, buffer);

    // Return the URL
    const imageUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/temp/${filename}`;

    // Trigger cleanup
    imageCleanup.cleanup().catch(console.error);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
} 