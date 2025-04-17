import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Add this export to explicitly mark the route as dynamic
export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TOKEN_TO_TITLE_MAP: Record<string, string> = {
  't7Fp0h8ZfxVd': 'investing.com',
  'tNUpHFbjsmkA': 'lunarcrush.com',
  'tPVGTLBpW623': 'slickchart'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectToken = searchParams.get('projectToken');
    
    if (!projectToken) {
      return NextResponse.json({ error: 'Project token is required' }, { status: 400 });
    }

    const cachedData = await redis.get('cached_parsehub_data');
    if (!cachedData) {
      return NextResponse.json({ error: 'No cached data available' }, { status: 503 });
    }

    // Get the title for this project token
    const title = TOKEN_TO_TITLE_MAP[projectToken];
    if (!title) {
      return NextResponse.json({ error: 'Invalid project token' }, { status: 400 });
    }

    // Get the data directly using the title
    const projectData = (cachedData as Record<string, any>)[title];
    if (!projectData) {
      return NextResponse.json({ error: 'Project data not found' }, { status: 404 });
    }

    return NextResponse.json(projectData);
  } catch (error) {
    console.error('Error fetching cached ParseHub data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
} 