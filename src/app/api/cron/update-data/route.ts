import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { ParseHubClient } from '../../../../utils/ParseHubClient';
// import { DuneClient } from '../../../../utils/DuneClient'; // Removed if no longer needed elsewhere

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const runtime = 'edge';

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

// Removed fetchHoldersData function
// async function fetchHoldersData() { ... }

export async function GET(request: Request) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch ParseHub data
    const parseHubData = await fetchParseHubData();
    console.log('About to store ParseHub data:', parseHubData);
    await redis.set('cached_parsehub_data', parseHubData);
    console.log('Successfully stored ParseHub data');

    // Removed Holders data fetching and caching
    // const holdersData = await fetchHoldersData();
    // await redis.set('cached_holders_data', holdersData);

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