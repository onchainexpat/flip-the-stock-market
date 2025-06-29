import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../../lib/serverDcaDatabase';

export const runtime = 'edge';

// Get execution history for a specific DCA order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  try {
    const { orderId } = params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 },
      );
    }

    // Get the order to verify ownership if userAddress is provided
    if (userAddress) {
      const order = await serverDcaDatabase.getOrder(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Verify the user owns this order
      if (order.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return NextResponse.json(
          {
            error: 'Unauthorized: You can only view your own order executions',
          },
          { status: 403 },
        );
      }
    }

    // Get executions for this order
    const executions = await serverDcaDatabase.getOrderExecutions(orderId);

    // Format executions for frontend
    const formattedExecutions = executions.map((execution) => ({
      id: execution.id,
      orderId: execution.orderId,
      transactionHash: execution.txHash, // Map txHash to transactionHash for frontend
      amountIn: execution.amountIn.toString(),
      amountOut: execution.amountOut.toString(),
      executedAt: new Date(execution.executedAt * 1000).toISOString(), // Convert from seconds to ms
      status: execution.status,
      gasUsed: execution.gasUsed?.toString() || '0',
      gasPrice: execution.gasPrice?.toString() || '0',
    }));

    console.log(
      `Retrieved ${formattedExecutions.length} executions for order ${orderId}`,
    );

    return NextResponse.json({
      success: true,
      orderId,
      executions: formattedExecutions,
      totalExecutions: formattedExecutions.length,
    });
  } catch (error) {
    console.error('Failed to get order executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
