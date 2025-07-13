import { OpenOceanDCAService } from './openOceanDCAService';
import { serverDcaDatabase } from '../lib/serverDcaDatabase';
import axios from 'axios';

export interface OrderSyncResult {
  orderId: string;
  orderHash: string;
  success: boolean;
  previousStatus: string;
  newStatus: string;
  previousExecutions: number;
  newExecutions: number;
  error?: string;
  needsOnChainUpdate?: boolean;
}

export interface BulkSyncResult {
  totalOrders: number;
  syncedOrders: number;
  errorCount: number;
  results: OrderSyncResult[];
  errors: Array<{
    orderId: string;
    orderHash: string;
    error: string;
  }>;
}

/**
 * Service for synchronizing OpenOcean DCA order statuses
 * Provides real-time and batch synchronization capabilities
 */
export class OpenOceanSyncService {
  private openOceanService: OpenOceanDCAService;
  private syncCache: Map<string, { lastSync: number; data: any }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache

  constructor() {
    this.openOceanService = new OpenOceanDCAService();
  }

  /**
   * Sync a single order with OpenOcean API
   */
  async syncOrder(orderHash: string, forceSync: boolean = false): Promise<OrderSyncResult> {
    try {
      // Check cache first (unless force sync)
      if (!forceSync && this.syncCache.has(orderHash)) {
        const cached = this.syncCache.get(orderHash)!;
        if (Date.now() - cached.lastSync < this.CACHE_DURATION) {
          return cached.data;
        }
      }

      // Get local order
      const localOrder = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash);
      if (!localOrder) {
        throw new Error('Order not found in local database');
      }

      // Get current status from OpenOcean
      const openOceanStatus = await this.openOceanService.getOrderStatus(orderHash);
      if (!openOceanStatus) {
        // Order not found in OpenOcean - mark as expired
        await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
          status: 'expired',
          openOceanStatus: 7,
          updatedAt: Date.now()
        });

        const result: OrderSyncResult = {
          orderId: localOrder.id,
          orderHash,
          success: true,
          previousStatus: localOrder.status,
          newStatus: 'expired',
          previousExecutions: localOrder.executionsCount,
          newExecutions: localOrder.executionsCount
        };

        // Cache the result
        this.syncCache.set(orderHash, { lastSync: Date.now(), data: result });
        return result;
      }

      // Map OpenOcean status to internal status
      let newStatus = this.mapOpenOceanStatusToInternal(openOceanStatus.status);
      const newExecutions = openOceanStatus.executionCount;
      const remainingAmount = BigInt(openOceanStatus.remainingAmount);
      const executedAmount = BigInt(openOceanStatus.executedAmount);

      // Check if update is needed
      const hasChanges = 
        newStatus !== localOrder.status ||
        openOceanStatus.status !== localOrder.openOceanStatus ||
        executedAmount !== localOrder.executedAmount ||
        newExecutions !== localOrder.executionsCount;

      if (hasChanges) {
        await serverDcaDatabase.updateOpenOceanOrder(localOrder.id, {
          status: newStatus,
          openOceanStatus: openOceanStatus.status,
          executedAmount,
          executionsCount: newExecutions,
          remainingMakerAmount: remainingAmount,
          updatedAt: Date.now()
        });
      }

      const result: OrderSyncResult = {
        orderId: localOrder.id,
        orderHash,
        success: true,
        previousStatus: localOrder.status,
        newStatus,
        previousExecutions: localOrder.executionsCount,
        newExecutions,
        needsOnChainUpdate: openOceanStatus.status === 3 && newStatus === 'cancelled'
      };

      // Cache the result
      this.syncCache.set(orderHash, { lastSync: Date.now(), data: result });
      return result;

    } catch (error) {
      const result: OrderSyncResult = {
        orderId: '',
        orderHash,
        success: false,
        previousStatus: '',
        newStatus: '',
        previousExecutions: 0,
        newExecutions: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      return result;
    }
  }

  /**
   * Sync multiple orders efficiently
   */
  async syncOrdersBatch(orderHashes: string[], forceSync: boolean = false): Promise<BulkSyncResult> {
    const results: OrderSyncResult[] = [];
    const errors: Array<{ orderId: string; orderHash: string; error: string }> = [];

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < orderHashes.length; i += batchSize) {
      const batch = orderHashes.slice(i, i + batchSize);
      
      const batchPromises = batch.map(orderHash => this.syncOrder(orderHash, forceSync));
      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value);
          } else {
            errors.push({
              orderId: result.value.orderId,
              orderHash: batch[j],
              error: result.value.error || 'Unknown error'
            });
          }
        } else {
          errors.push({
            orderId: '',
            orderHash: batch[j],
            error: result.reason?.message || 'Promise rejected'
          });
        }
      }

      // Rate limiting - wait between batches
      if (i + batchSize < orderHashes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      totalOrders: orderHashes.length,
      syncedOrders: results.length,
      errorCount: errors.length,
      results,
      errors
    };
  }

  /**
   * Sync all orders for a specific user
   */
  async syncUserOrders(userAddress: string, forceSync: boolean = false): Promise<BulkSyncResult> {
    try {
      const userOrders = await serverDcaDatabase.getUserOpenOceanOrders(userAddress);
      const orderHashes = userOrders.map(order => order.orderHash);
      
      return await this.syncOrdersBatch(orderHashes, forceSync);
    } catch (error) {
      return {
        totalOrders: 0,
        syncedOrders: 0,
        errorCount: 1,
        results: [],
        errors: [{
          orderId: '',
          orderHash: '',
          error: error instanceof Error ? error.message : 'Failed to fetch user orders'
        }]
      };
    }
  }

  /**
   * Get sync status for orders without triggering sync
   */
  async getOrderSyncStatus(orderHashes: string[]): Promise<Array<{
    orderHash: string;
    lastSyncAt: number;
    timeSinceLastSync: number;
    needsSync: boolean;
    status: string;
    openOceanStatus: number;
  }>> {
    const results = [];
    
    for (const orderHash of orderHashes) {
      try {
        const order = await serverDcaDatabase.getOpenOceanOrderByHash(orderHash);
        if (order) {
          const timeSinceLastSync = Date.now() - (order.updatedAt || order.createdAt);
          const needsSync = timeSinceLastSync > 5 * 60 * 1000; // 5 minutes

          results.push({
            orderHash,
            lastSyncAt: order.updatedAt || order.createdAt,
            timeSinceLastSync,
            needsSync,
            status: order.status,
            openOceanStatus: order.openOceanStatus
          });
        }
      } catch (error) {
        // Skip orders that can't be retrieved
        continue;
      }
    }

    return results;
  }

  /**
   * Clear sync cache
   */
  clearCache(): void {
    this.syncCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.syncCache.size,
      entries: Array.from(this.syncCache.keys())
    };
  }

  /**
   * Map OpenOcean status to internal status
   */
  private mapOpenOceanStatusToInternal(openOceanStatus: number): string {
    switch (openOceanStatus) {
      case 1: // unfilled
        return 'active';
      case 3: // cancelled
        return 'cancelled';
      case 4: // filled
        return 'completed';
      case 5: // pending
        return 'active';
      case 6: // hash not exist
        return 'cancelled';
      case 7: // expired
        return 'expired';
      default:
        return 'active';
    }
  }

  /**
   * Start periodic sync for active orders
   */
  async startPeriodicSync(intervalMs: number = 5 * 60 * 1000): Promise<void> {
    console.log('Starting periodic OpenOcean order sync...');
    
    const syncActiveOrders = async () => {
      try {
        const activeOrders = await serverDcaDatabase.getAllActiveOpenOceanOrders();
        if (activeOrders.length === 0) return;

        console.log(`Syncing ${activeOrders.length} active OpenOcean orders...`);
        
        const orderHashes = activeOrders.map(order => order.orderHash);
        const result = await this.syncOrdersBatch(orderHashes);
        
        console.log(`Sync completed: ${result.syncedOrders} synced, ${result.errorCount} errors`);
      } catch (error) {
        console.error('Error in periodic sync:', error);
      }
    };

    // Initial sync
    await syncActiveOrders();

    // Set up periodic sync
    setInterval(syncActiveOrders, intervalMs);
  }
}

// Export singleton instance
export const openOceanSyncService = new OpenOceanSyncService();