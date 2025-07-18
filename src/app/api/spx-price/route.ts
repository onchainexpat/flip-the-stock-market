import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Get SPX6900 price data from CoinGecko
 * This endpoint provides a simplified price response for frontend components
 */
export async function GET() {
  try {
    // Use the existing CoinGecko endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    const coingeckoResponse = await fetch(`${baseUrl}/api/coingecko`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!coingeckoResponse.ok) {
      throw new Error(
        `CoinGecko API failed with status ${coingeckoResponse.status}`,
      );
    }

    const coingeckoData = await coingeckoResponse.json();

    // Extract SPX6900 price data
    if (!coingeckoData?.spx6900?.usd) {
      throw new Error('Invalid price data received from CoinGecko');
    }

    const spxData = coingeckoData.spx6900;

    return NextResponse.json({
      success: true,
      price: spxData.usd.toFixed(6), // Format to 6 decimal places
      marketCap: spxData.usd_market_cap || null,
      change24h: spxData.usd_24h_change || null,
      timestamp: Date.now(),
      source: 'coingecko',
    });
  } catch (error) {
    console.error('Error fetching SPX price:', error);

    // Return fallback response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        price: 'N/A',
        timestamp: Date.now(),
      },
      { status: 500 },
    );
  }
}
