import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchTradeDetails } from '../../../../../../lib/serverTradeApi';

export const runtime = 'edge';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string; executionId: string } },
) {
  try {
    const { orderId, executionId } = params;
    const userAddress = request.nextUrl.searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress' },
        { status: 400 },
      );
    }

    // Get the execution from Redis
    const executionKey = `dca:executions:${userAddress}:${orderId}`;
    const executionData = await redis.zrange(executionKey, 0, -1, {
      withScores: true,
    });

    const execution = executionData.find((e: any) => {
      let parsed;
      try {
        // Handle both string and object formats
        if (typeof e.member === 'object' && e.member !== null) {
          parsed = e.member;
        } else {
          parsed = JSON.parse(e.member as string);
        }
        return parsed.id === executionId;
      } catch (error) {
        console.error('Failed to parse execution member:', e.member, error);
        return false;
      }
    });

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 },
      );
    }

    let parsedExecution;
    try {
      if (
        typeof (execution as any).member === 'object' &&
        (execution as any).member !== null
      ) {
        parsedExecution = (execution as any).member;
      } else {
        parsedExecution = JSON.parse((execution as any).member as string);
      }
    } catch (error) {
      console.error(
        'Failed to parse execution member:',
        (execution as any).member,
        error,
      );
      return NextResponse.json(
        { error: 'Invalid execution data' },
        { status: 500 },
      );
    }

    // Try to fetch trade details from OpenOcean API
    let tradeDetails = null;
    try {
      if (parsedExecution.transactionHash) {
        tradeDetails = await fetchTradeDetails(parsedExecution.transactionHash);
      }
    } catch (error) {
      console.warn('Could not fetch trade details:', error);
      // Continue without trade details - basic execution info is still valuable
    }

    return NextResponse.json({ ...parsedExecution, tradeDetails });
  } catch (error) {
    console.error('Failed to fetch execution details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution details' },
      { status: 500 },
    );
  }
}
