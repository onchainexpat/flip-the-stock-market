import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { DuneClient } from '../../../utils/DuneClient';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DUNE_QUERY_ID = 4890255;
const CACHE_KEY = 'dune_holders_data_timed';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface CachedHoldersData {
  data: any[];
  timestamp: number;
}

async function fetchFreshHoldersData() {
  console.log('Fetching fresh Dune holders data');
  const duneApiKey = process.env.NEXT_PUBLIC_DUNE_API_KEY;
  if (!duneApiKey) {
    throw new Error('Dune API key is missing');
  }
  const client = new DuneClient(duneApiKey);
  const query_result = await client.getLatestResult({ queryId: DUNE_QUERY_ID });
  
  if (!query_result.result?.rows) {
    console.warn('No results found in Dune query response');
    return [];
  }

  const rows = query_result.result.rows as any[];
  const formattedData = rows.map(row => ({
    date: row.day.split(' ')[0],
    holders: row.total_holders,
    percentChange: Number.parseFloat(row.daily_change_percent)
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  console.log(`Fetched ${formattedData.length} rows from Dune`);
  return formattedData;
}

export async function GET() {
  try {
    const cachedData = await redis.get(CACHE_KEY);
    let cachedResult: CachedHoldersData | null = null;

    if (cachedData) {
      try {
        // If the cached data is already an object, use it directly
        if (typeof cachedData === 'object') {
          cachedResult = cachedData as CachedHoldersData;
        } else if (typeof cachedData === 'string') {
          cachedResult = JSON.parse(cachedData) as CachedHoldersData;
        }
      } catch (parseError) {
        console.error('Failed to parse cached Dune data:', parseError);
      }
    }

    if (cachedResult) {
      const now = Date.now();
      if (now - cachedResult.timestamp < CACHE_EXPIRY_MS) {
        console.log('Returning cached Dune holders data (parsed from string)');
        return NextResponse.json(cachedResult.data);
      }
      console.log('Dune holders cache expired');
    } else {
      console.log('No valid Dune holders cache found or failed to parse');
    }

    const freshData = await fetchFreshHoldersData();

    const dataToCache: CachedHoldersData = {
      data: freshData,
      timestamp: Date.now(),
    };
    await redis.set(CACHE_KEY, JSON.stringify(dataToCache));
    console.log('Dune holders cache updated (stored as string)');

    return NextResponse.json(freshData);

  } catch (error) {
    console.error('Error in Dune Holders API route:', error);
    return NextResponse.json({ error: `Failed to fetch Dune holders data: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 