import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { serverZerodevDCAExecutor } from '../../../services/serverZerodevDCAExecutor';

export const runtime = 'nodejs';

// Cancel DCA order and sweep funds back to user wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, userAddress, sweepFunds = true } = body;

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Order ID and user address are required' },
        { status: 400 },
      );
    }

    console.log(`🗑️ Canceling DCA order ${orderId} for user ${userAddress}`);

    // Get the order details
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    // Verify the order belongs to the user
    if (order.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Order does not belong to user',
        },
        { status: 403 },
      );
    }

    // Check if order is already completed
    const executionsRemaining = order.totalExecutions - order.executionsCount;
    if (
      executionsRemaining <= 0 ||
      order.status === 'completed' ||
      order.status === 'cancelled'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Order is already completed or cancelled and cannot be canceled',
        },
        { status: 400 },
      );
    }

    // Parse order data to get agent key and smart wallet info
    let orderData: any;
    try {
      orderData = JSON.parse(order.sessionKeyData);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid order data format' },
        { status: 400 },
      );
    }

    const smartWalletAddress = orderData.smartWalletAddress;
    const agentKeyId = orderData.agentKeyId;

    if (!agentKeyId || !smartWalletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing agent key or smart wallet information',
        },
        { status: 400 },
      );
    }

    let sweepResult = null;

    // Sweep funds if requested
    if (sweepFunds) {
      console.log('💰 Sweeping funds from smart wallet to user wallet...');

      try {
        // Use the DCA executor to sweep funds
        sweepResult = await serverZerodevDCAExecutor.sweepFundsToUser(
          agentKeyId,
          smartWalletAddress,
          userAddress,
        );

        if (!sweepResult.success) {
          console.warn('⚠️ Fund sweep failed:', sweepResult.error);
          // Continue with cancellation even if sweep fails
        }
      } catch (sweepError) {
        console.warn('⚠️ Fund sweep error:', sweepError);
        // Continue with cancellation even if sweep fails
      }
    }

    // Cancel the order by setting executionsRemaining to 0
    await serverDcaDatabase.cancelOrder(orderId);

    console.log(`✅ DCA order ${orderId} canceled successfully`);

    return NextResponse.json({
      success: true,
      message: 'DCA order canceled successfully',
      orderId,
      sweepResult,
      details: {
        orderCanceled: true,
        fundsSwiped: sweepResult?.success || false,
        smartWalletAddress,
        userAddress,
        sweepTxHash: sweepResult?.txHash,
        sweptAmounts: sweepResult?.sweptAmounts,
      },
    });
  } catch (error) {
    console.error('Failed to cancel DCA order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
