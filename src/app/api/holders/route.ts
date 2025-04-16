import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    const cachedData = await redis.get('cached_holders_data');
    if (!cachedData) {
      return NextResponse.json({ error: 'No cached data available' }, { status: 503 });
    }
    return NextResponse.json(cachedData);
  } catch (error) {
    console.error('Error fetching cached holders data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
} 