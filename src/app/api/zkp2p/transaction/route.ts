export const runtime = 'edge';

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { offerId, amount, userAddress, venmoHandle, memo } = body;

    // Validate required fields
    if (!offerId || !amount || !userAddress || !venmoHandle || !memo) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Generate transaction ID
    const transactionId = `zkp2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create transaction record
    const transaction = {
      id: transactionId,
      offerId,
      amount: Number.parseFloat(amount),
      userAddress,
      venmoHandle,
      memo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      zkProofStatus: 'waiting_for_payment',
    };

    // Store transaction in KV (in production, this would integrate with zkp2p API)
    await kv.set(`zkp2p:transaction:${transactionId}`, transaction, {
      ex: 86400,
    }); // 24 hour expiry

    return NextResponse.json({
      success: true,
      transaction,
      instructions: {
        step1: `Send $${amount} to ${venmoHandle} on Venmo`,
        step2: `Use memo: "${memo}"`,
        step3: 'Wait for zero-knowledge proof generation (2-5 minutes)',
        step4: 'USDC will arrive in your wallet automatically',
      },
    });
  } catch (error) {
    console.error('Error creating zkp2p transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 },
      );
    }

    // Get transaction from KV
    const transaction = await kv.get(`zkp2p:transaction:${transactionId}`);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // Simulate transaction progress
    const now = Date.now();
    const transactionData = transaction as any;
    const createdAt = new Date(transactionData.createdAt).getTime();
    const elapsed = now - createdAt;

    // Update status based on elapsed time (for demo purposes)
    if (elapsed > 30000 && transactionData.status === 'pending') {
      // 30 seconds
      transactionData.status = 'processing';
      transactionData.zkProofStatus = 'generating_proof';
      await kv.set(`zkp2p:transaction:${transactionId}`, transactionData, {
        ex: 86400,
      });
    } else if (elapsed > 60000 && transactionData.status === 'processing') {
      // 1 minute
      transactionData.status = 'completed';
      transactionData.zkProofStatus = 'verified';
      transactionData.completedAt = new Date().toISOString();
      transactionData.txHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      await kv.set(`zkp2p:transaction:${transactionId}`, transactionData, {
        ex: 86400,
      });
    }

    return NextResponse.json({
      success: true,
      transaction: transactionData,
    });
  } catch (error) {
    console.error('Error fetching zkp2p transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transaction' },
      { status: 500 },
    );
  }
}
