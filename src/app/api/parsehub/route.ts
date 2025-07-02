import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { ParseHubClient } from '../../../utils/ParseHubClient';

// Add this export to explicitly mark the route as dynamic
export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_PREFIX = 'parsehub_data_timed:';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface CachedParseHubData {
  data: any;
  timestamp: number;
}

async function fetchFreshParseHubData(projectToken: string) {
  console.log(`Fetching fresh ParseHub data for token: ${projectToken}`);
  const parsehubApiKey = process.env.PARSEHUB_API_KEY;
  if (!parsehubApiKey) {
    throw new Error('ParseHub API key is missing');
  }
  const client = new ParseHubClient({ apiKey: parsehubApiKey });

  try {
    const data = await client.getLastReadyData(projectToken);
    console.log(`Fetched data for ${projectToken}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching ParseHub data for ${projectToken}:`, error);
    throw new Error(
      `Failed to fetch ParseHub data for ${projectToken}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectToken = searchParams.get('projectToken');

  if (!projectToken) {
    return NextResponse.json(
      { error: 'Project token is required' },
      { status: 400 },
    );
  }

  const cacheKey = `${CACHE_PREFIX}${projectToken}`;

  try {
    const cachedString = await redis.get<string>(cacheKey);
    let cachedResult: CachedParseHubData | null = null;

    if (cachedString) {
      try {
        cachedResult = JSON.parse(cachedString) as CachedParseHubData;
      } catch (parseError) {
        console.error(
          `Failed to parse cached ParseHub data for ${projectToken}:`,
          parseError,
        );
      }
    }

    if (cachedResult) {
      const now = Date.now();
      if (now - cachedResult.timestamp < CACHE_EXPIRY_MS) {
        console.log(`Returning cached ParseHub data for ${projectToken}`);
        return NextResponse.json(cachedResult.data);
      }
      console.log(`ParseHub cache expired for ${projectToken}`);
    } else {
      console.log(`No valid ParseHub cache found for ${projectToken}`);
    }

    const freshData = await fetchFreshParseHubData(projectToken);

    const dataToCache: CachedParseHubData = {
      data: freshData,
      timestamp: Date.now(),
    };
    await redis.set(cacheKey, JSON.stringify(dataToCache));
    console.log(`ParseHub cache updated for ${projectToken}`);

    return NextResponse.json(freshData);
  } catch (error) {
    console.error(`Error in ParseHub API route for ${projectToken}:`, error);
    return NextResponse.json(
      {
        error: `Failed to fetch ParseHub data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
}
