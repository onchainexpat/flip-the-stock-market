import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
// import { ParseHubClient } from '../../../../utils/ParseHubClient'; // Removed if no longer needed
// import { DuneClient } from '../../../../utils/DuneClient'; // Already removed

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const runtime = 'edge';

// Removed fetchParseHubData function
// async function fetchParseHubData() { ... }

// Removed fetchHoldersData function
// async function fetchHoldersData() { ... }

export async function GET(request: Request) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Removed ParseHub data fetching and caching
    // const parseHubData = await fetchParseHubData();
    // console.log('About to store ParseHub data:', parseHubData);
    // await redis.set('cached_parsehub_data', parseHubData);
    // console.log('Successfully stored ParseHub data');

    // Removed Holders data fetching and caching
    // const holdersData = await fetchHoldersData();
    // await redis.set('cached_holders_data', holdersData);

    // Store the timestamp of the last update
    // Consider if this is still needed or should be removed too
    // If only used for cron status, keep it.
    // If used to check overall data freshness, its meaning has changed.
    await redis.set('last_data_update', Date.now()); 

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      message: 'Cron job completed (no data fetched directly)' // Updated message
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 