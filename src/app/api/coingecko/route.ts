import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv'; // Assuming KV is used elsewhere, or replace if not needed

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=spx6900&vs_currencies=usd&include_market_cap=true&include_24hr_change=true';
const CACHE_KEY = 'coingecko_price_data'; // Use a new key for structured data
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface CachedData {
  data: any;
  timestamp: number;
}

export async function GET() {
  try {
    // 1. Try fetching from cache
    const cachedString = await redis.get<string>(CACHE_KEY);
    let cachedResult: CachedData | null = null;

    if (cachedString) {
      try {
        cachedResult = JSON.parse(cachedString) as CachedData;
      } catch (parseError) {
        console.error('Failed to parse cached CoinGecko data:', parseError);
        // Optionally delete the invalid cache entry: await redis.del(CACHE_KEY);
      }
    }

    if (cachedResult) {
      const now = Date.now();
      // 2. Check if cache is still valid (within 10 minutes)
      if (now - cachedResult.timestamp < CACHE_EXPIRY_MS) {
        console.log('Returning cached CoinGecko data (parsed from string)');
        return NextResponse.json(cachedResult.data);
      }
      console.log('CoinGecko cache expired');
    } else {
      console.log('No valid CoinGecko cache found or failed to parse');
    }

    // 3. Fetch fresh data if cache is missing or expired
    console.log('Fetching fresh CoinGecko data');
    const response = await fetch(COINGECKO_API_URL);
    if (!response.ok) {
      throw new Error(`CoinGecko API request failed with status ${response.status}`);
    }
    const freshData = await response.json();

    // Basic validation
    if (!freshData || !freshData.spx6900 || typeof freshData.spx6900.usd !== 'number') {
        throw new Error('Invalid data format received from CoinGecko');
    }


    // 4. Update cache
    const dataToCache: CachedData = {
      data: freshData,
      timestamp: Date.now(),
    };
    await redis.set(CACHE_KEY, JSON.stringify(dataToCache)); // Store as stringified JSON
    console.log('CoinGecko cache updated (stored as string)');


    return NextResponse.json(freshData);

  } catch (error) {
    console.error('Error in CoinGecko API route:', error);
    // Return stale data if available during an error? Optional.
    // For now, just return error
    return NextResponse.json({ error: `Failed to fetch CoinGecko data: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 