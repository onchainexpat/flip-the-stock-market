import { DuneClient } from "@duneanalytics/client-sdk";
export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = new DuneClient(process.env.NEXT_PUBLIC_DUNE_API_KEY ?? '');
    
    // Replace with your actual query ID
    const query_result = await client.getLatestResult({queryId: 3177632});
    if (!query_result.result) {
      return Response.json([]);
    }
    const rows = query_result.result.rows;
    
    return Response.json(rows);
  } catch (error) {
    console.error('Error fetching from Dune:', error);
    return Response.error();
  }
} 