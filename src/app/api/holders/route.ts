import { DuneClient } from "@duneanalytics/client-sdk";
export const runtime = 'nodejs';

interface DuneRow {
  day: string;
  total_holders: number;
  daily_change_percent: string;
  daily_holder_change: number;
  base_holders: number;
  eth_holders: number;
  sol_holders: number;
}

export async function GET() {
  try {
    const client = new DuneClient(process.env.NEXT_PUBLIC_DUNE_API_KEY ?? '');
    
    // Replace with your actual query ID
    const query_result = await client.getLatestResult({queryId: 4890255});
    if (!query_result.result) {
      return Response.json([]);
    }
    
    // Safe type casting
    const rows = query_result.result.rows as unknown as DuneRow[];
    
    // Transform the data to match the expected format for your chart
    const formattedData = rows.map(row => ({
      date: row.day.split(' ')[0], // Use 'day' instead of 'date' and strip the time part
      holders: row.total_holders, // Use 'total_holders' field
      percentChange: parseFloat(row.daily_change_percent) // Use 'daily_change_percent' field and convert to number
    }));
    
    // Sort the data chronologically (oldest first)
    const sortedData = formattedData.sort((a, b) => {
      // Parse the dates and compare them
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime(); // Ascending order (oldest first)
    });
    
    return Response.json(sortedData);
  } catch (error) {
    console.error('Error fetching from Dune:', error);
    return Response.error();
  }
} 