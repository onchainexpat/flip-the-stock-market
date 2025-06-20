export const runtime = 'edge';

import { NextResponse } from 'next/server';

// Mock zkp2p offers - in production this would call the actual zkp2p API
const mockOffers = [
  {
    id: '1',
    venmoHandle: '@venmo_user_123',
    rate: '1.00',
    available: 500,
    fees: 0.1,
    reputation: 4.9,
    completedTrades: 156,
  },
  {
    id: '2',
    venmoHandle: '@crypto_trader_456',
    rate: '1.00',
    available: 1000,
    fees: 0.1,
    reputation: 4.8,
    completedTrades: 89,
  },
  {
    id: '3',
    venmoHandle: '@defi_master_789',
    rate: '1.00',
    available: 750,
    fees: 0.15,
    reputation: 4.95,
    completedTrades: 203,
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount');
    const minAmount = amount ? Number.parseFloat(amount) : 0;

    // Filter offers by minimum amount available
    const availableOffers = mockOffers.filter(
      (offer) => offer.available >= minAmount,
    );

    // Sort by best rates and reputation
    const sortedOffers = availableOffers.sort((a, b) => {
      // Primary sort by fees (lower is better)
      if (a.fees !== b.fees) {
        return a.fees - b.fees;
      }
      // Secondary sort by reputation (higher is better)
      return b.reputation - a.reputation;
    });

    return NextResponse.json({
      success: true,
      offers: sortedOffers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching zkp2p offers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch offers',
        offers: mockOffers, // Fallback to mock data
      },
      { status: 500 },
    );
  }
}
