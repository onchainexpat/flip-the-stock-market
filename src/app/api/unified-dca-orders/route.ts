import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '@/lib/serverDcaDatabase';
import type { Address } from 'viem';

export const runtime = 'edge';

// GET /api/unified-dca-orders - Get all DCA orders (both smart wallet and OpenOcean)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') as Address;
    const status = searchParams.get('status');
    const provider = searchParams.get('provider'); // 'smart_wallet' | 'openocean'
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    // Get unified orders from both providers
    let allOrders = await serverDcaDatabase.getUserUnifiedOrders(userAddress);

    // Apply filters
    if (status) {
      allOrders = allOrders.filter(order => order.status === status);
    }

    if (provider) {
      allOrders = allOrders.filter(order => order.provider === provider);
    }

    // Apply pagination
    const totalCount = allOrders.length;
    const paginatedOrders = allOrders.slice(offset, offset + limit);

    // Transform orders for unified API response
    const transformedOrders = paginatedOrders.map(order => {
      const baseOrder = {
        id: order.id,
        userAddress: order.userAddress,
        provider: order.provider,
        fromToken: order.fromToken,
        toToken: order.toToken,
        destinationAddress: order.destinationAddress,
        totalAmount: order.totalAmount.toString(),
        status: order.status,
        executedAmount: order.executedAmount.toString(),
        executionsCount: order.executionsCount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        lastExecutedAt: order.lastExecutedAt,
        nextExecutionAt: order.nextExecutionAt,
        expiresAt: order.expiresAt,
        executionTxHashes: order.executionTxHashes,
        platformFeePercentage: order.platformFeePercentage || 0,
      };

      if (order.provider === 'openocean') {
        return {
          ...baseOrder,
          orderHash: order.orderHash,
          intervalSeconds: order.intervalSeconds,
          numberOfBuys: order.numberOfBuys,
          remainingMakerAmount: order.remainingMakerAmount.toString(),
          openOceanStatus: order.openOceanStatus,
          minPrice: order.minPrice,
          maxPrice: order.maxPrice,
          openOceanCreateDateTime: order.openOceanCreateDateTime,
          openOceanExpireTime: order.openOceanExpireTime,
        };
      } else {
        return {
          ...baseOrder,
          sessionKeyAddress: order.sessionKeyAddress,
          frequency: order.frequency,
          duration: order.duration,
          totalExecutions: order.totalExecutions,
          totalPlatformFees: order.totalPlatformFees.toString(),
          netInvestmentAmount: order.netInvestmentAmount.toString(),
          estimatedPriceImpact: order.estimatedPriceImpact,
          creationTxHash: order.creationTxHash,
        };
      }
    });

    return NextResponse.json({
      success: true,
      orders: transformedOrders,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary: {
        totalOrders: totalCount,
        smartWalletOrders: transformedOrders.filter(o => o.provider === 'smart_wallet').length,
        openOceanOrders: transformedOrders.filter(o => o.provider === 'openocean').length,
        activeOrders: transformedOrders.filter(o => o.status === 'active').length,
        completedOrders: transformedOrders.filter(o => o.status === 'completed').length,
        cancelledOrders: transformedOrders.filter(o => o.status === 'cancelled').length,
      }
    });
  } catch (error) {
    console.error('Error fetching unified DCA orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unified DCA orders' },
      { status: 500 }
    );
  }
}

// GET /api/unified-dca-orders/stats - Get user DCA statistics
export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') as Address;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    // Get unified orders for stats calculation
    const allOrders = await serverDcaDatabase.getUserUnifiedOrders(userAddress);
    
    // Get traditional smart wallet stats
    const smartWalletStats = await serverDcaDatabase.getUserStats(userAddress);
    
    // Calculate OpenOcean-specific stats
    const openOceanOrders = allOrders.filter(order => order.provider === 'openocean');
    const openOceanStats = {
      totalOrders: openOceanOrders.length,
      activeOrders: openOceanOrders.filter(o => o.status === 'active').length,
      completedOrders: openOceanOrders.filter(o => o.status === 'completed').length,
      cancelledOrders: openOceanOrders.filter(o => o.status === 'cancelled').length,
      totalInvested: openOceanOrders.reduce((sum, order) => sum + order.executedAmount, BigInt(0)),
      totalExecutions: openOceanOrders.reduce((sum, order) => sum + order.executionsCount, 0),
    };

    // Calculate unified stats
    const unifiedStats = {
      totalOrders: allOrders.length,
      smartWalletOrders: allOrders.filter(o => o.provider === 'smart_wallet').length,
      openOceanOrders: openOceanOrders.length,
      activeOrders: allOrders.filter(o => o.status === 'active').length,
      completedOrders: allOrders.filter(o => o.status === 'completed').length,
      cancelledOrders: allOrders.filter(o => o.status === 'cancelled').length,
      totalInvested: allOrders.reduce((sum, order) => sum + order.executedAmount, BigInt(0)),
      totalExecutions: allOrders.reduce((sum, order) => sum + order.executionsCount, 0),
      totalPlatformFees: allOrders.reduce((sum, order) => {
        if (order.provider === 'smart_wallet') {
          return sum + order.totalPlatformFees;
        } else {
          return sum + order.totalPlatformFees;
        }
      }, BigInt(0)),
    };

    return NextResponse.json({
      success: true,
      stats: {
        unified: {
          ...unifiedStats,
          totalInvested: unifiedStats.totalInvested.toString(),
          totalPlatformFees: unifiedStats.totalPlatformFees.toString(),
        },
        smartWallet: {
          ...smartWalletStats,
          totalInvested: smartWalletStats.totalInvested.toString(),
        },
        openOcean: {
          ...openOceanStats,
          totalInvested: openOceanStats.totalInvested.toString(),
        }
      }
    });
  } catch (error) {
    console.error('Error fetching unified DCA stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unified DCA stats' },
      { status: 500 }
    );
  }
}