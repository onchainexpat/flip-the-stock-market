import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Test execution bypassing agent key checks
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      );
    }

    console.log(`🧪 TEST: Bypassing checks for immediate execution of order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'active') {
      return NextResponse.json(
        { error: 'Order is not active' },
        { status: 400 }
      );
    }

    // Parse order data
    let orderData: any;
    try {
      orderData = JSON.parse(order.sessionKeyData);
    } catch (e) {
      return NextResponse.json({
        error: 'Invalid order data format',
      });
    }

    console.log('📊 Order details:', {
      orderId: order.id,
      userAddress: order.userAddress,
      smartWallet: orderData.smartWalletAddress,
      amount: order.amountPerOrder?.toString(),
      totalAmount: order.totalAmount?.toString(),
    });

    // For testing, we'll just simulate the execution
    const simulatedResult = {
      orderId: order.id,
      userAddress: order.userAddress,
      smartWalletAddress: orderData.smartWalletAddress,
      amountIn: order.amountPerOrder?.toString() || '0',
      estimatedAmountOut: '1000000', // Mock 1 SPX for testing
      status: 'simulated',
      message: 'This is a simulated execution. In production, this would:',
      steps: [
        '1. Use agent key to sign transaction',
        '2. Execute swap on OpenOcean (USDC → SPX)',
        '3. Send SPX to user wallet',
        '4. Update order execution count',
        '5. Schedule next execution',
      ],
      nextSteps: 'To enable real execution, the agent key system needs to be properly configured',
    };

    // Update the order to mark this simulation
    await serverDcaDatabase.updateOrder(orderId, {
      nextExecutionAt: Date.now() + (24 * 60 * 60 * 1000), // Reset to 24 hours from now
    });

    return NextResponse.json({
      success: true,
      message: 'Simulated execution completed',
      result: simulatedResult,
    });

  } catch (error) {
    console.error('Failed to simulate execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}