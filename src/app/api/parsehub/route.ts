import { ParseHubClient } from '../../../utils/ParseHubClient';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectToken = searchParams.get('projectToken');
    
    if (!projectToken) {
      return Response.json({ error: 'Project token is required' }, { status: 400 });
    }

    const client = new ParseHubClient({
      apiKey: process.env.NEXT_PUBLIC_PARSEHUB_API_KEY || '',
      projectToken
    });

    const data = await client.getLastReadyData(projectToken);
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching ParseHub data:', error);
    return Response.json({ error: 'Failed to fetch ParseHub data' }, { status: 500 });
  }
} 