import type { ethers } from 'ethers';
import type { Address } from 'viem';
import {
  type OpenOceanDCAOrder,
  type OpenOceanDCAOrderParams,
  OpenOceanDCAService,
} from './openOceanDCAService';
import { openOceanErrorHandler } from './openOceanErrorHandler';
import { openOceanSyncService } from './openOceanSyncService';

/**
 * Resilient wrapper around OpenOcean DCA service with comprehensive error handling
 * and fallback mechanisms
 */
export class ResilientOpenOceanService {
  private dcaService: OpenOceanDCAService;
  private healthStatus: Map<string, { isHealthy: boolean; lastCheck: number }> =
    new Map();
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.dcaService = new OpenOceanDCAService();
  }

  /**
   * Create DCA order with comprehensive error handling
   */
  async createDCAOrder(params: OpenOceanDCAOrderParams): Promise<{
    success: boolean;
    order?: OpenOceanDCAOrder;
    error?: string;
    fallbackUsed?: boolean;
    retryCount?: number;
  }> {
    try {
      // Validate parameters first
      const validation = this.dcaService.validateOrderParams(params);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          fallbackUsed: false,
          retryCount: 0,
        };
      }

      // Check service health
      const isHealthy = await this.checkServiceHealth('openocean-api');
      if (!isHealthy) {
        return {
          success: false,
          error:
            'OpenOcean service is currently unavailable. Please try again later.',
          fallbackUsed: true,
          retryCount: 0,
        };
      }

      // Attempt order creation
      const order = await this.dcaService.createSPXDCAOrder(params);

      return {
        success: true,
        order,
        fallbackUsed: false,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error creating DCA order:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'createDCAOrder',
        userAddress: (await params.provider
          .getSigner()
          .getAddress()) as Address,
        serviceKey: 'openocean-api',
        retryOperation: async () => {
          return await this.dcaService.createSPXDCAOrder(params);
        },
      });

      return {
        success: result.success,
        order: result.data,
        error: result.error,
        fallbackUsed: result.fallbackUsed,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Cancel DCA order with error handling
   */
  async cancelDCAOrder(
    provider: ethers.BrowserProvider,
    orderHash: string,
    orderData?: any,
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    fallbackUsed?: boolean;
    retryCount?: number;
  }> {
    try {
      const userAddress = (await provider.getSigner().getAddress()) as Address;

      // Check if order exists and is cancellable
      const orderStatus = await this.dcaService.getOrderStatus(orderHash);
      if (!orderStatus) {
        return {
          success: false,
          error: 'Order not found or already processed',
          fallbackUsed: false,
          retryCount: 0,
        };
      }

      if (orderStatus.status === 4) {
        // Already filled
        return {
          success: false,
          error: 'Order is already completed and cannot be cancelled',
          fallbackUsed: false,
          retryCount: 0,
        };
      }

      // Attempt cancellation
      const result = await this.dcaService.cancelOrder(
        provider,
        orderHash,
        orderData,
      );

      return {
        success: true,
        data: result,
        fallbackUsed: false,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error cancelling DCA order:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'cancelDCAOrder',
        userAddress: (await provider.getSigner().getAddress()) as Address,
        orderHash,
        serviceKey: 'openocean-api',
        retryOperation: async () => {
          return await this.dcaService.cancelOrder(
            provider,
            orderHash,
            orderData,
          );
        },
      });

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        fallbackUsed: result.fallbackUsed,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Get orders with error handling and caching
   */
  async getUserOrders(
    userAddress: Address,
    page = 1,
    limit = 10,
  ): Promise<{
    success: boolean;
    orders?: any[];
    error?: string;
    cached?: boolean;
    retryCount?: number;
  }> {
    try {
      // Check cache first
      const cacheKey = `orders_${userAddress}_${page}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          orders: cached,
          cached: true,
          retryCount: 0,
        };
      }

      // Fetch from API
      const orders = await this.dcaService.getOrdersByAddress(
        userAddress,
        page,
        limit,
      );

      // Cache the result
      this.setCache(cacheKey, orders, 30000); // Cache for 30 seconds

      return {
        success: true,
        orders,
        cached: false,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error fetching user orders:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'getUserOrders',
        userAddress,
        endpoint: 'dca/address',
        serviceKey: 'openocean-api',
        retryOperation: async () => {
          return await this.dcaService.getOrdersByAddress(
            userAddress,
            page,
            limit,
          );
        },
      });

      // If error handling fails, try to return cached data
      if (!result.success) {
        const cacheKey = `orders_${userAddress}_${page}_${limit}`;
        const cached = this.getFromCache(cacheKey, true); // Get even stale cache
        if (cached) {
          return {
            success: true,
            orders: cached,
            cached: true,
            error: 'Using cached data due to API error',
            retryCount: result.retryCount,
          };
        }
      }

      return {
        success: result.success,
        orders: result.data,
        error: result.error,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Get order status with error handling
   */
  async getOrderStatus(orderHash: string): Promise<{
    success: boolean;
    status?: any;
    error?: string;
    retryCount?: number;
  }> {
    try {
      // Try sync service first (has caching)
      const syncResult = await openOceanSyncService.syncOrder(orderHash);
      if (syncResult.success) {
        return {
          success: true,
          status: {
            status: this.mapInternalToOpenOceanStatus(syncResult.newStatus),
            executionCount: syncResult.newExecutions,
            remainingAmount: '0', // Would need to get from sync result
            executedAmount: '0',
          },
          retryCount: 0,
        };
      }

      // Fallback to direct API call
      const status = await this.dcaService.getOrderStatus(orderHash);

      return {
        success: true,
        status,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error getting order status:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'getOrderStatus',
        orderHash,
        serviceKey: 'openocean-api',
        retryOperation: async () => {
          return await this.dcaService.getOrderStatus(orderHash);
        },
      });

      return {
        success: result.success,
        status: result.data,
        error: result.error,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Sync order with error handling
   */
  async syncOrder(orderHash: string): Promise<{
    success: boolean;
    syncResult?: any;
    error?: string;
    retryCount?: number;
  }> {
    try {
      const syncResult = await openOceanSyncService.syncOrder(orderHash);

      return {
        success: syncResult.success,
        syncResult,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error syncing order:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'syncOrder',
        orderHash,
        serviceKey: 'openocean-sync',
        retryOperation: async () => {
          return await openOceanSyncService.syncOrder(orderHash);
        },
      });

      return {
        success: result.success,
        syncResult: result.data,
        error: result.error,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Batch sync orders with error handling
   */
  async syncOrdersBatch(orderHashes: string[]): Promise<{
    success: boolean;
    results?: any;
    error?: string;
    retryCount?: number;
  }> {
    try {
      const results = await openOceanSyncService.syncOrdersBatch(orderHashes);

      return {
        success: true,
        results,
        retryCount: 0,
      };
    } catch (error) {
      console.error('Error batch syncing orders:', error);

      // Handle the error through the error handler
      const result = await openOceanErrorHandler.handleError(error as Error, {
        operation: 'syncOrdersBatch',
        serviceKey: 'openocean-sync',
        retryOperation: async () => {
          return await openOceanSyncService.syncOrdersBatch(orderHashes);
        },
      });

      return {
        success: result.success,
        results: result.data,
        error: result.error,
        retryCount: result.retryCount,
      };
    }
  }

  /**
   * Check service health
   */
  async checkServiceHealth(serviceKey: string): Promise<boolean> {
    const cached = this.healthStatus.get(serviceKey);
    if (cached && Date.now() - cached.lastCheck < this.HEALTH_CHECK_INTERVAL) {
      return cached.isHealthy;
    }

    try {
      // Simple health check - try to fetch orders for a known address
      const testAddress = '0x0000000000000000000000000000000000000000';
      await this.dcaService.getOrdersByAddress(testAddress, 1, 1);

      this.healthStatus.set(serviceKey, {
        isHealthy: true,
        lastCheck: Date.now(),
      });

      return true;
    } catch (error) {
      console.warn(`Health check failed for ${serviceKey}:`, error);

      this.healthStatus.set(serviceKey, {
        isHealthy: false,
        lastCheck: Date.now(),
      });

      return false;
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    healthStatus: Record<string, { isHealthy: boolean; lastCheck: number }>;
    errorStats: any;
    cacheStats: { size: number; hitRate: number };
  } {
    const healthStatus = Object.fromEntries(this.healthStatus.entries());
    const errorStats = openOceanErrorHandler.getErrorStats();
    const cacheStats = this.getCacheStats();

    return {
      healthStatus,
      errorStats,
      cacheStats,
    };
  }

  /**
   * Reset service state
   */
  resetService(): void {
    this.healthStatus.clear();
    this.clearCache();
    openOceanErrorHandler.clearErrorHistory();
  }

  // Cache implementation
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> =
    new Map();
  private cacheHits = 0;
  private cacheRequests = 0;

  private getFromCache(key: string, allowStale = false): any {
    this.cacheRequests++;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (!allowStale && now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    this.cacheHits++;
    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup old entries
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  private clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheRequests = 0;
  }

  private getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0,
    };
  }

  private mapInternalToOpenOceanStatus(status: string): number {
    const statusMap: Record<string, number> = {
      active: 1,
      cancelled: 3,
      completed: 4,
      paused: 5,
      expired: 7,
    };
    return statusMap[status] || 1;
  }
}

// Export singleton instance
export const resilientOpenOceanService = new ResilientOpenOceanService();
