import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { ParseHubClient } from '../../../utils/ParseHubClient';
import { fallbackLunarcrushData } from '../../../utils/fallbackLunarcrushData';

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

function isValidMarketCapData(data: any): boolean {
  // Check if we have valid market cap data (not blocked by ad blocker, etc.)
  if (!data || typeof data !== 'object') return false;
  if (!data.marketcap || typeof data.marketcap !== 'string') return false;
  
  // Check for invalid responses
  const invalidResponses = [
    'looks like your ad blocker is on',
    'blocked',
    'error',
    'n/a',
    ''
  ];
  
  const marketcapLower = data.marketcap.toLowerCase().trim();
  return !invalidResponses.some(invalid => marketcapLower.includes(invalid));
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
    
    // Validate that we got useful data
    if (!isValidMarketCapData(data)) {
      console.warn(`ParseHub returned invalid/blocked data for ${projectToken}:`, data);
      throw new Error('ParseHub returned invalid or blocked data (possibly ad blocker interference)');
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching ParseHub data for ${projectToken}:`, error);
    throw new Error(`Failed to fetch ParseHub data for ${projectToken}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectToken = searchParams.get('projectToken');

  if (!projectToken) {
    return NextResponse.json({ error: 'Project token is required' }, { status: 400 });
  }

  const cacheKey = `${CACHE_PREFIX}${projectToken}`;

  try {
    const cachedString = await redis.get<string>(cacheKey);
    let cachedResult: CachedParseHubData | null = null;

    if (cachedString) {
      try {
        cachedResult = JSON.parse(cachedString) as CachedParseHubData;
      } catch (parseError) {
        console.error(`Failed to parse cached ParseHub data for ${projectToken}:`, parseError);
      }
    }

    if (cachedResult) {
      const now = Date.now();
      if (now - cachedResult.timestamp < CACHE_EXPIRY_MS) {
        console.log(`Returning cached ParseHub data for ${projectToken}`);
        return NextResponse.json(cachedResult.data);
      }
      console.log(`ParseHub cache expired for ${projectToken}, but keeping it as fallback`);
    } else {
      console.log(`No valid ParseHub cache found for ${projectToken}`);
    }

    // Try to fetch fresh data
    try {
      const freshData = await fetchFreshParseHubData(projectToken);

      const dataToCache: CachedParseHubData = {
        data: freshData,
        timestamp: Date.now(),
      };
      await redis.set(cacheKey, JSON.stringify(dataToCache));
      console.log(`ParseHub cache updated for ${projectToken}`);

      return NextResponse.json(freshData);
    } catch (fetchError) {
      console.error(`Failed to fetch fresh ParseHub data for ${projectToken}:`, fetchError);
      
      // Fallback to cached data if available, even if expired
      if (cachedResult) {
        console.warn(`Using expired cached ParseHub data as fallback for ${projectToken}`);
        return NextResponse.json(cachedResult.data);
      }
      
      // Last resort: use hardcoded fallback data
      if (projectToken === 'tPVGTLBpW623') {
        console.warn(`Using hardcoded S&P 500 market cap as last resort fallback`);
        const fallbackData = {
          marketcap: '$53.033 trillion',
          date: 'As of 2025-07-19'
        };
        return NextResponse.json(fallbackData);
      }
      
      // Fallback for lunarcrush sentiment/engagement data
      if (projectToken === 'tNUpHFbjsmkA') {
        console.warn(`Using hardcoded lunarcrush data as last resort fallback`);
        return NextResponse.json(fallbackLunarcrushData);
      }
      
      // If no cached data available, throw the error
      throw fetchError;
    }

  } catch (error) {
    console.error(`Error in ParseHub API route for ${projectToken}:`, error);
    return NextResponse.json({ error: `Failed to fetch ParseHub data: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
} 