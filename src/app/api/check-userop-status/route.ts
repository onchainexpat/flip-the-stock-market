import { type NextRequest, NextResponse } from 'next/server';
import { createKernelAccountClient } from '@zerodev/sdk';
import { http } from 'viem';
import { base } from 'viem/chains';

export const runtime = 'nodejs';

const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/8453`;

// Check UserOperation status
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userOpHash = searchParams.get('hash');

    if (!userOpHash) {
      return NextResponse.json({ error: 'Missing userOpHash' }, { status: 400 });
    }

    console.log(`🔍 Checking UserOp status: ${userOpHash}`);

    // Create a minimal kernel client for status checking
    const kernelClient = createKernelAccountClient({
      account: {} as any, // Minimal account for status checking
      chain: base,
      bundlerTransport: http(ZERODEV_RPC_URL),
    });

    try {
      // Try to get the receipt with a short timeout
      const receipt = await Promise.race([
        kernelClient.waitForUserOperationReceipt({
          hash: userOpHash as `0x${string}`,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Status check timeout')), 5000),
        ),
      ]) as any;

      return NextResponse.json({
        success: true,
        status: 'mined',
        userOpHash,
        txHash: receipt.receipt.transactionHash,
        blockNumber: receipt.receipt.blockNumber,
        gasUsed: receipt.receipt.gasUsed.toString(),
      });
    } catch (error) {
      // UserOp might be pending or not found
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      let status = 'unknown';
      if (errorMessage.includes('timeout')) {
        status = 'pending';
      } else if (errorMessage.includes('not found')) {
        status = 'not_found';
      } else {
        status = 'failed';
      }

      return NextResponse.json({
        success: false,
        status,
        userOpHash,
        error: errorMessage,
        message: getStatusMessage(status),
      });
    }
  } catch (error) {
    console.error('Failed to check UserOp status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'mined':
      return 'Transaction has been successfully mined';
    case 'pending':
      return 'Transaction is pending in the mempool';
    case 'not_found':
      return 'UserOperation not found - may have been dropped or invalid';
    case 'failed':
      return 'Transaction failed during execution';
    default:
      return 'Unknown transaction status';
  }
}