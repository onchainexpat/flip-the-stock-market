import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Assume Redis client is configured via environment variables
const redis = Redis.fromEnv();

// New cache key and keep 1-hour TTL
const CACHE_KEY = 'sp500_yahoo_data';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// Interface for the expected structure within Yahoo's response
interface YahooChartMeta {
  regularMarketPrice: number;
  chartPreviousClose: number;
  // Add other fields if needed later
}

interface YahooChartResult {
  meta: YahooChartMeta;
  // Add other result fields if needed later
}

interface YahooFinanceResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: any | null;
  };
}

// Interface for our cached data (structure remains the same)
interface CachedData {
  price: number;
  changePercent: number;
  timestamp: number;
}

export async function GET() {
  try {
    // 1. Check cache
    const cachedResult = await redis.get<CachedData>(CACHE_KEY);
    const now = Date.now();

    if (cachedResult && (now - cachedResult.timestamp) < CACHE_TTL_SECONDS * 1000) {
      console.log(`Returning cached Yahoo S&P 500 data (valid for ${CACHE_TTL_SECONDS}s).`);
      return NextResponse.json(cachedResult);
    }

    console.log('Cache stale or missing. Fetching fresh Yahoo S&P 500 data.');
    // 2. Fetch from Yahoo Finance URL
    const yahooUrl = 'https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC';
    // Add cache-busting query param to potentially help avoid stale browser/intermediate caches
    const response = await fetch(`${yahooUrl}?_=${Date.now()}`, { cache: 'no-store' }); // Prevent fetch caching

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yahoo Finance API request failed with status ${response.status}. Body: ${errorText}`);
      throw new Error(`Yahoo Finance API request failed with status ${response.status}`);
    }

    const data: YahooFinanceResponse = await response.json();
    console.log('Raw Yahoo Finance response:', JSON.stringify(data, null, 2)); // Log raw response

    // Validate the structure
    if (data.chart.error) {
        console.error('Yahoo Finance API returned an error:', data.chart.error);
        throw new Error(`Yahoo Finance API error: ${JSON.stringify(data.chart.error)}`);
    }

    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number' || typeof meta.chartPreviousClose !== 'number') {
      console.error('Unexpected Yahoo Finance API response format. Required fields missing in chart.result[0].meta:', meta);
      // Try returning stale data if format is invalid
      if (cachedResult) {
        console.warn('Yahoo Finance response format error, returning stale cache data.');
        return NextResponse.json(cachedResult);
      }
      throw new Error('Invalid data format received from Yahoo Finance API and no stale cache available.');
    }

    // Parse data and calculate change
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose;

    if (previousClose === 0) {
       console.warn('Previous close price from Yahoo is 0, cannot calculate percentage change.');
        // Handle division by zero - maybe return 0% change or throw specific error
       if (cachedResult) {
         console.warn('Yahoo previous close is 0, returning stale cache data.');
         return NextResponse.json(cachedResult);
       }
       throw new Error('Previous close price is 0, cannot calculate percentage change.');
    }

    const changePercent = ((price - previousClose) / previousClose) * 100;

    const newData: CachedData = {
      price,
      changePercent,
      timestamp: now,
    };

    // 3. Update cache
    await redis.set(CACHE_KEY, JSON.stringify(newData), { ex: CACHE_TTL_SECONDS });
    console.log(`Updated Yahoo S&P 500 cache. TTL: ${CACHE_TTL_SECONDS}s`);

    return NextResponse.json(newData);

  } catch (error) {
    console.error('Error in GET /api/sp500:', error);
    // Attempt to return stale data on error
    try {
      const cachedResult = await redis.get<CachedData>(CACHE_KEY);
      if (cachedResult) {
        console.warn('API fetch or processing failed, returning stale cache data due to error.');
        return NextResponse.json(cachedResult);
      }
    } catch (cacheError) {
      console.error('Error fetching stale cache data during error handling:', cacheError);
    }
    // If no stale data available or cache fetch fails, return error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch or process S&P 500 data', details: errorMessage }, { status: 500 });
  }
}

// Optional: Add edge runtime configuration if preferred, but ensure Redis client compatibility
// export const runtime = 'edge'; 