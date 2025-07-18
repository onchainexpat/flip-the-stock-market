import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'edge';

function getIntervalSeconds(frequency: string): number {
  switch (frequency) {
    case 'hourly':
      return 3600;
    case 'daily':
      return 86400;
    case 'weekly':
      return 604800;
    case 'monthly':
      return 2592000;
    default:
      return 86400; // Default to daily
  }
}

// Get DCA order history with pagination and sorting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const page = Number.parseInt(searchParams.get('page') || '1');
    const limit = Number.parseInt(searchParams.get('limit') || '5');

    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'User address is required' },
        { status: 400 },
      );
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Get all orders for the user
    const allOrders = await serverDcaDatabase.getUserOrders(
      userAddress as `0x${string}`,
    );

    // Sort orders: active first, then by creation date (newest first)
    const sortedOrders = allOrders.sort((a, b) => {
      // Check if orders are active (executionsRemaining > 0)
      const aExecutionsRemaining = a.totalExecutions - a.executionsCount;
      const bExecutionsRemaining = b.totalExecutions - b.executionsCount;
      const aActive = aExecutionsRemaining > 0 && a.status === 'active';
      const bActive = bExecutionsRemaining > 0 && b.status === 'active';

      // Active orders come first
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // Within same status, sort by creation date (newest first)
      return b.createdAt - a.createdAt;
    });

    // Apply pagination
    const paginatedOrders = sortedOrders.slice(offset, offset + limit);

    // Calculate next execution times and format order data
    const ordersWithDetails = await Promise.all(
      paginatedOrders.map(async (order) => {
        try {
          // Get execution history for this order
          const executions = await serverDcaDatabase.getOrderExecutions(
            order.id,
          );

          // Calculate next execution time
          const lastExecutionTime =
            executions.length > 0
              ? Math.max(...executions.map((e) => e.executedAt))
              : order.createdAt;

          const executionsRemaining =
            order.totalExecutions - order.executionsCount;
          const intervalSeconds = getIntervalSeconds(order.frequency);
          const nextExecutionAt =
            executionsRemaining > 0 && order.status === 'active'
              ? lastExecutionTime + intervalSeconds
              : null;

          // Parse session key data for additional details
          let orderDetails: any = {};
          try {
            // Check if sessionKeyData is already an object or needs parsing
            if (typeof order.sessionKeyData === 'string') {
              // Handle case where sessionKeyData might be "[object Object]" string
              if (order.sessionKeyData === '[object Object]') {
                console.warn(
                  `Order ${order.id} has corrupted sessionKeyData: "[object Object]"`,
                );
                orderDetails = {};
              } else {
                orderDetails = JSON.parse(order.sessionKeyData);
              }
            } else if (
              typeof order.sessionKeyData === 'object' &&
              order.sessionKeyData !== null
            ) {
              orderDetails = order.sessionKeyData;
            } else {
              console.warn(
                `Order ${order.id} has invalid sessionKeyData type:`,
                typeof order.sessionKeyData,
              );
              orderDetails = {};
            }
          } catch (e) {
            console.error(
              `Failed to parse sessionKeyData for order ${order.id}:`,
              e,
            );
            console.error(`Raw sessionKeyData:`, order.sessionKeyData);
            // Handle legacy format or corrupted data
            orderDetails = {};
          }

          return {
            id: order.id,
            userAddress: order.userAddress,
            smartWalletAddress: orderDetails.smartWalletAddress || 'Unknown',
            totalAmount: order.totalAmount.toString(),
            amountPerExecution: (
              order.totalAmount / BigInt(order.totalExecutions)
            ).toString(),
            totalExecutions: order.totalExecutions,
            executionsCompleted: order.executionsCount,
            executionsRemaining,
            intervalSeconds,
            nextExecutionAt,
            expiresAt: order.expiresAt,
            createdAt: order.createdAt,
            status:
              executionsRemaining > 0 && order.status === 'active'
                ? 'active'
                : order.status,
            agentKeyId: orderDetails.agentKeyId,
            lastExecutionHash:
              executions.length > 0
                ? executions[executions.length - 1].txHash
                : null,
            totalSpxReceived: executions
              .reduce((sum, e) => sum + BigInt(e.amountOut || 0), 0n)
              .toString(),
          };
        } catch (orderError) {
          console.error(`Error processing order ${order.id}:`, orderError);
          // Return a safe fallback order object
          return {
            id: order.id,
            userAddress: order.userAddress,
            smartWalletAddress: 'Unknown',
            totalAmount: order.totalAmount.toString(),
            amountPerExecution: (
              order.totalAmount / BigInt(order.totalExecutions)
            ).toString(),
            totalExecutions: order.totalExecutions,
            executionsCompleted: 0,
            executionsRemaining: order.totalExecutions,
            intervalSeconds: 3600,
            nextExecutionAt: order.createdAt,
            expiresAt: order.expiresAt,
            createdAt: order.createdAt,
            status: 'error',
            agentKeyId: 'unknown',
            lastExecutionHash: null,
            totalSpxReceived: '0',
          };
        }
      }),
    );

    // Calculate pagination info
    const totalOrders = sortedOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      success: true,
      orders: ordersWithDetails,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        hasNextPage,
        hasPrevPage,
        limit,
      },
    };

    // Test JSON serialization before returning
    try {
      JSON.stringify(response);
      return NextResponse.json(response);
    } catch (jsonError) {
      console.error('JSON serialization error:', jsonError);
      console.error('Response object:', response);

      // Return a safe fallback response
      return NextResponse.json({
        success: false,
        error: 'JSON serialization failed',
        orders: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalOrders: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit,
        },
      });
    }
  } catch (error) {
    console.error('Failed to fetch DCA order history:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
