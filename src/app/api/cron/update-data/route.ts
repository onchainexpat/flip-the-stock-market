import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { ParseHubClient } from '../../../../utils/ParseHubClient';
import { DuneClient } from '../../../../utils/DuneClient';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const runtime = 'edge';

async function fetchCoinGeckoData() {
  const apiKey = process.env.COINGECKO_API;
  if (!apiKey) {
    throw new Error('CoinGecko API key is missing');
  }

  const baseUrl = 'https://api.coingecko.com';
  const apiPath = '/api/v3/simple/price';
  const params = new URLSearchParams({
    ids: 'spx6900',
    vs_currencies: 'usd',
    include_24hr_change: 'true',
    include_market_cap: 'true',
    x_cg_demo_api_key: apiKey
  });

  const response = await fetch(`${baseUrl}${apiPath}?${params}`);
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchParseHubData() {
  const projectTokens = [
    { token: 't7Fp0h8ZfxVd', title: 'investing.com' },
    { token: 'tNUpHFbjsmkA', title: 'lunarcrush.com' },
    { token: 'tPVGTLBpW623', title: 'slickchart' }
  ];

  const client = new ParseHubClient({
    apiKey: process.env.PARSEHUB_API_KEY || '',
  });

  const results = await Promise.all(
    projectTokens.map(async (project) => {
      try {
        const data = await client.getLastReadyData(project.token);
        console.log(`Fetched data for ${project.title}:`, data);
        return { [project.title]: data };
      } catch (error) {
        console.error(`Error fetching data for ${project.title}:`, error);
        return { [project.title]: null };
      }
    })
  );

  const combinedData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  console.log('Combined ParseHub data:', combinedData);
  return combinedData;
}

async function fetchHoldersData() {
  const client = new DuneClient(process.env.NEXT_PUBLIC_DUNE_API_KEY ?? '');
  const query_result = await client.getLatestResult({ queryId: 4890255 });
  
  if (!query_result.result) {
    return [];
  }

  const rows = query_result.result.rows as any[];
  return rows.map(row => ({
    date: row.day.split(' ')[0],
    holders: row.total_holders,
    percentChange: parseFloat(row.daily_change_percent)
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function GET(request: Request) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch CoinGecko data
    const coingeckoData = await fetchCoinGeckoData();
    await redis.set('cached_coingecko_data', coingeckoData);
    console.log('Stored CoinGecko data:', coingeckoData);

    // Fetch ParseHub data
    const parseHubData = await fetchParseHubData();
    console.log('About to store ParseHub data:', parseHubData);
    await redis.set('cached_parsehub_data', parseHubData);
    console.log('Successfully stored ParseHub data');

    // Fetch Holders data
    const holdersData = await fetchHoldersData();
    await redis.set('cached_holders_data', holdersData);

    // Store the timestamp of the last update
    await redis.set('last_data_update', Date.now());

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      message: 'Data successfully updated'
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 