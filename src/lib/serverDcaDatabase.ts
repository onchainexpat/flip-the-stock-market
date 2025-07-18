import { Redis } from '@upstash/redis';
import type { Address } from 'viem';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface DCAOrder {
  id: string;
  userAddress: Address;
  sessionKeyAddress: Address;
  sessionKeyData: string; // JSON string of session key permissions and data

  // Order parameters
  fromToken: Address;
  toToken: Address;
  destinationAddress: Address; // Where to send the purchased tokens
  totalAmount: bigint;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: number; // in days

  // Fee tracking
  platformFeePercentage: number;
  totalPlatformFees: bigint;
  netInvestmentAmount: bigint;

  // Execution tracking
  status:
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'insufficient_balance';
  executedAmount: bigint;
  executionsCount: number;
  totalExecutions: number;

  // Price impact tracking
  estimatedPriceImpact?: number;

  // Timestamps
  createdAt: number;
  updatedAt?: number;
  lastExecutedAt?: number;
  nextExecutionAt: number;
  expiresAt: number;

  // Transaction hashes
  creationTxHash?: string;
  executionTxHashes: string[];
}

export interface OpenOceanDCAOrder {
  id: string;
  userAddress: Address;

  // OpenOcean specific fields
  orderHash: string; // OpenOcean order hash
  orderData: any; // OpenOcean order data from SDK

  // Order parameters
  fromToken: Address;
  toToken: Address;
  destinationAddress: Address; // Where to send the purchased tokens
  totalAmount: bigint;
  intervalSeconds: number; // Interval in seconds (OpenOcean uses seconds)
  numberOfBuys: number; // Number of DCA executions

  // Price range constraints (optional)
  minPrice?: string;
  maxPrice?: string;

  // Fee tracking
  platformFeePercentage: number;
  totalPlatformFees: bigint;

  // Execution tracking
  status:
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'expired'
    | 'insufficient_balance';
  executedAmount: bigint;
  executionsCount: number;
  remainingMakerAmount: bigint;

  // OpenOcean status mapping
  openOceanStatus: number; // 1-unfilled, 3-cancel, 4-filled, 5-pending, 6-hash not exist, 7-expire

  // Timestamps
  createdAt: number;
  updatedAt?: number;
  lastExecutedAt?: number;
  nextExecutionAt: number;
  expiresAt: number;

  // OpenOcean specific timestamps
  openOceanCreateDateTime?: string;
  openOceanExpireTime?: string;

  // Transaction hashes
  creationTxHash?: string;
  executionTxHashes: string[];

  // Provider type for unified interface
  provider: 'openocean';
}

// Union type for unified DCA order handling
export type UnifiedDCAOrder =
  | (DCAOrder & { provider: 'smart_wallet' })
  | OpenOceanDCAOrder;

export interface DCAExecution {
  id: string;
  orderId: string;
  txHash: string;

  // Execution details
  amountIn: bigint;
  amountOut: bigint;
  gasUsed: bigint;
  gasPrice: bigint;
  executedAt: number;
  blockNumber: number;

  // Status
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

// Redis keys
const REDIS_KEYS = {
  ORDER: (id: string) => `dca:order:${id}`,
  USER_ORDERS: (address: string) => `dca:user:${address}:orders`,
  EXECUTION: (id: string) => `dca:execution:${id}`,
  ORDER_EXECUTIONS: (orderId: string) => `dca:order:${orderId}:executions`,
  ALL_ORDERS: 'dca:all_orders',

  // OpenOcean specific keys
  OPENOCEAN_ORDER: (id: string) => `dca:openocean:order:${id}`,
  OPENOCEAN_USER_ORDERS: (address: string) =>
    `dca:openocean:user:${address}:orders`,
  OPENOCEAN_ORDER_HASH: (hash: string) => `dca:openocean:hash:${hash}`,
  ALL_OPENOCEAN_ORDERS: 'dca:all_openocean_orders',

  // Unified keys for both order types
  UNIFIED_USER_ORDERS: (address: string) =>
    `dca:unified:user:${address}:orders`,
  ALL_UNIFIED_ORDERS: 'dca:all_unified_orders',
};

class ServerDCADatabase {
  // Serialize/deserialize helpers for BigInt
  private serializeOrder(order: DCAOrder): any {
    return {
      ...order,
      totalAmount: order.totalAmount.toString(),
      totalPlatformFees: order.totalPlatformFees.toString(),
      netInvestmentAmount: order.netInvestmentAmount.toString(),
      executedAmount: order.executedAmount.toString(),
    };
  }

  private deserializeOrder(data: any): DCAOrder {
    return {
      ...data,
      totalAmount: BigInt(data.totalAmount),
      totalPlatformFees: BigInt(data.totalPlatformFees),
      netInvestmentAmount: BigInt(data.netInvestmentAmount),
      executedAmount: BigInt(data.executedAmount),
    };
  }

  private serializeOpenOceanOrder(order: OpenOceanDCAOrder): any {
    return {
      ...order,
      totalAmount: order.totalAmount.toString(),
      totalPlatformFees: order.totalPlatformFees.toString(),
      executedAmount: order.executedAmount.toString(),
      remainingMakerAmount: order.remainingMakerAmount.toString(),
    };
  }

  private deserializeOpenOceanOrder(data: any): OpenOceanDCAOrder {
    return {
      ...data,
      totalAmount: BigInt(data.totalAmount),
      totalPlatformFees: BigInt(data.totalPlatformFees),
      executedAmount: BigInt(data.executedAmount),
      remainingMakerAmount: BigInt(data.remainingMakerAmount),
    };
  }

  private serializeExecution(execution: DCAExecution): any {
    return {
      ...execution,
      amountIn: execution.amountIn.toString(),
      amountOut: execution.amountOut.toString(),
      gasUsed: execution.gasUsed.toString(),
      gasPrice: execution.gasPrice.toString(),
    };
  }

  private deserializeExecution(data: any): DCAExecution {
    return {
      ...data,
      amountIn: BigInt(data.amountIn),
      amountOut: BigInt(data.amountOut),
      gasUsed: BigInt(data.gasUsed),
      gasPrice: BigInt(data.gasPrice),
    };
  }

  // Orders
  async createOrder(order: Omit<DCAOrder, 'id'>): Promise<DCAOrder> {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: DCAOrder = { ...order, id };

    // Store order in Redis
    await redis.set(
      REDIS_KEYS.ORDER(id),
      JSON.stringify(this.serializeOrder(newOrder)),
    );

    // Add to user orders index
    const userOrderIds =
      (await redis.smembers(REDIS_KEYS.USER_ORDERS(order.userAddress))) || [];
    await redis.sadd(REDIS_KEYS.USER_ORDERS(order.userAddress), id);

    // Add to global orders list for efficient querying
    await redis.sadd(REDIS_KEYS.ALL_ORDERS, id);

    return newOrder;
  }

  async getOrder(id: string): Promise<DCAOrder | null> {
    const data = await redis.get(REDIS_KEYS.ORDER(id));
    if (!data) return null;

    // Handle both string and object responses from Upstash Redis
    let parsedData;
    if (typeof data === 'string') {
      parsedData = JSON.parse(data);
    } else if (typeof data === 'object') {
      parsedData = data;
    } else {
      console.error('Unexpected Redis data type:', typeof data, data);
      return null;
    }

    return this.deserializeOrder(parsedData);
  }

  async getUserOrders(userAddress: Address): Promise<DCAOrder[]> {
    const orderIds = await redis.smembers(REDIS_KEYS.USER_ORDERS(userAddress));
    const orders: DCAOrder[] = [];

    for (const id of orderIds) {
      const order = await this.getOrder(id);
      if (order) orders.push(order);
    }

    return orders;
  }

  async getOrdersDueForExecution(): Promise<DCAOrder[]> {
    const now = Date.now();
    const dueOrders: DCAOrder[] = [];

    // Get all order IDs
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_ORDERS);

    for (const orderId of allOrderIds) {
      const order = await this.getOrder(orderId);
      if (
        order &&
        order.status === 'active' &&
        order.nextExecutionAt <= now &&
        order.executionsCount < order.totalExecutions
      ) {
        dueOrders.push(order);
      }
    }

    return dueOrders;
  }

  async updateOrder(
    id: string,
    updates: Partial<DCAOrder>,
  ): Promise<DCAOrder | null> {
    const order = await this.getOrder(id);
    if (!order) return null;

    const updatedOrder = { ...order, ...updates, updatedAt: Date.now() };
    await redis.set(
      REDIS_KEYS.ORDER(id),
      JSON.stringify(this.serializeOrder(updatedOrder)),
    );
    return updatedOrder;
  }

  async updateOrderStatus(
    id: string,
    status: DCAOrder['status'],
  ): Promise<DCAOrder | null> {
    return this.updateOrder(id, { status });
  }

  async cancelOrder(id: string): Promise<DCAOrder | null> {
    const order = await this.getOrder(id);
    if (!order) {
      return null;
    }

    // Update order to canceled status
    const canceledOrder = {
      ...order,
      status: 'cancelled' as const,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    await redis.set(
      REDIS_KEYS.ORDER(id),
      JSON.stringify(this.serializeOrder(canceledOrder)),
    );

    return canceledOrder;
  }

  async getAllActiveOrders(): Promise<DCAOrder[]> {
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_ORDERS);
    const activeOrders: DCAOrder[] = [];

    for (const orderId of allOrderIds) {
      const order = await this.getOrder(orderId);
      if (order && order.status === 'active') {
        activeOrders.push(order);
      }
    }

    return activeOrders;
  }

  async getOrdersByStatus(status: DCAOrder['status']): Promise<DCAOrder[]> {
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_ORDERS);
    const filteredOrders: DCAOrder[] = [];

    for (const orderId of allOrderIds) {
      const order = await this.getOrder(orderId);
      if (order && order.status === status) {
        filteredOrders.push(order);
      }
    }

    return filteredOrders;
  }

  async getOrdersDueForExecution(): Promise<DCAOrder[]> {
    const activeOrders = await this.getAllActiveOrders();
    const ordersReady: DCAOrder[] = [];
    const now = new Date();

    for (const order of activeOrders) {
      try {
        // Parse order data to get agent key info
        const orderData =
          typeof order.sessionKeyData === 'string'
            ? JSON.parse(order.sessionKeyData)
            : order.sessionKeyData;

        // Check if order has agent key (automated orders)
        if (!orderData.agentKeyId) continue;

        // Get frequency from the main order object (not sessionKeyData)
        const frequency = order.frequency || 'daily';
        const frequencyMs = this.getFrequencyInMs(frequency);

        // Check if order is ready based on stored nextExecutionAt
        const nextExecutionTime = new Date(order.nextExecutionAt);

        // Check if enough time has passed and order has remaining executions
        const executionsCompleted = order.executionsCount || 0;
        if (
          now >= nextExecutionTime &&
          executionsCompleted < order.totalExecutions
        ) {
          console.log(`📅 Order ${order.id} is ready for execution`);
          console.log(`   Frequency: ${frequency} (${frequencyMs}ms)`);
          console.log(`   Next execution: ${nextExecutionTime.toISOString()}`);
          console.log(`   Current time: ${now.toISOString()}`);
          console.log(
            `   Executions: ${executionsCompleted}/${order.totalExecutions}`,
          );
          ordersReady.push(order);
        } else {
          console.log(`⏳ Order ${order.id} not ready yet`);
          console.log(`   Next execution: ${nextExecutionTime.toISOString()}`);
          console.log(`   Current time: ${now.toISOString()}`);
        }
      } catch (error) {
        console.error(
          `❌ Error checking order ${order.id} for execution:`,
          error,
        );
      }
    }

    return ordersReady;
  }

  private getFrequencyInMs(frequency: string): number {
    switch (frequency.toLowerCase()) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  // OpenOcean DCA Orders
  async createOpenOceanOrder(
    order: Omit<OpenOceanDCAOrder, 'id'>,
  ): Promise<OpenOceanDCAOrder> {
    const id = `ooorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: OpenOceanDCAOrder = { ...order, id };

    // Store order in Redis
    await redis.set(
      REDIS_KEYS.OPENOCEAN_ORDER(id),
      JSON.stringify(this.serializeOpenOceanOrder(newOrder)),
    );

    // Add to user orders index
    await redis.sadd(REDIS_KEYS.OPENOCEAN_USER_ORDERS(order.userAddress), id);

    // Add to global OpenOcean orders list
    await redis.sadd(REDIS_KEYS.ALL_OPENOCEAN_ORDERS, id);

    // Add to unified orders list
    await redis.sadd(
      REDIS_KEYS.UNIFIED_USER_ORDERS(order.userAddress),
      `openocean:${id}`,
    );
    await redis.sadd(REDIS_KEYS.ALL_UNIFIED_ORDERS, `openocean:${id}`);

    // Create order hash mapping for quick lookup
    await redis.set(REDIS_KEYS.OPENOCEAN_ORDER_HASH(order.orderHash), id);

    return newOrder;
  }

  async getOpenOceanOrder(id: string): Promise<OpenOceanDCAOrder | null> {
    const data = await redis.get(REDIS_KEYS.OPENOCEAN_ORDER(id));
    if (!data) return null;

    // Handle both string and object responses from Upstash Redis
    let parsedData;
    if (typeof data === 'string') {
      parsedData = JSON.parse(data);
    } else if (typeof data === 'object') {
      parsedData = data;
    } else {
      console.error('Unexpected Redis data type:', typeof data, data);
      return null;
    }

    return this.deserializeOpenOceanOrder(parsedData);
  }

  async getOpenOceanOrderByHash(
    orderHash: string,
  ): Promise<OpenOceanDCAOrder | null> {
    const id = await redis.get(REDIS_KEYS.OPENOCEAN_ORDER_HASH(orderHash));
    if (!id) return null;

    return this.getOpenOceanOrder(id as string);
  }

  async getUserOpenOceanOrders(
    userAddress: Address,
  ): Promise<OpenOceanDCAOrder[]> {
    const orderIds = await redis.smembers(
      REDIS_KEYS.OPENOCEAN_USER_ORDERS(userAddress),
    );
    const orders: OpenOceanDCAOrder[] = [];

    for (const id of orderIds) {
      const order = await this.getOpenOceanOrder(id);
      if (order) orders.push(order);
    }

    return orders;
  }

  async updateOpenOceanOrder(
    id: string,
    updates: Partial<OpenOceanDCAOrder>,
  ): Promise<OpenOceanDCAOrder | null> {
    const order = await this.getOpenOceanOrder(id);
    if (!order) return null;

    const updatedOrder = { ...order, ...updates, updatedAt: Date.now() };
    await redis.set(
      REDIS_KEYS.OPENOCEAN_ORDER(id),
      JSON.stringify(this.serializeOpenOceanOrder(updatedOrder)),
    );
    return updatedOrder;
  }

  async updateOpenOceanOrderStatus(
    id: string,
    status: OpenOceanDCAOrder['status'],
    openOceanStatus?: number,
  ): Promise<OpenOceanDCAOrder | null> {
    const updates: Partial<OpenOceanDCAOrder> = { status };
    if (openOceanStatus !== undefined) {
      updates.openOceanStatus = openOceanStatus;
    }
    return this.updateOpenOceanOrder(id, updates);
  }

  async updateOpenOceanOrderByHash(
    orderHash: string,
    updates: Partial<OpenOceanDCAOrder>,
  ): Promise<OpenOceanDCAOrder | null> {
    const id = await redis.get(REDIS_KEYS.OPENOCEAN_ORDER_HASH(orderHash));
    if (!id) return null;

    return this.updateOpenOceanOrder(id as string, updates);
  }

  async getAllActiveOpenOceanOrders(): Promise<OpenOceanDCAOrder[]> {
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_OPENOCEAN_ORDERS);
    const activeOrders: OpenOceanDCAOrder[] = [];

    for (const orderId of allOrderIds) {
      const order = await this.getOpenOceanOrder(orderId);
      if (order && order.status === 'active') {
        activeOrders.push(order);
      }
    }

    return activeOrders;
  }

  async getOpenOceanOrdersByStatus(
    status: OpenOceanDCAOrder['status'],
  ): Promise<OpenOceanDCAOrder[]> {
    const allOrderIds = await redis.smembers(REDIS_KEYS.ALL_OPENOCEAN_ORDERS);
    const filteredOrders: OpenOceanDCAOrder[] = [];

    for (const orderId of allOrderIds) {
      const order = await this.getOpenOceanOrder(orderId);
      if (order && order.status === status) {
        filteredOrders.push(order);
      }
    }

    return filteredOrders;
  }

  // Unified DCA Orders (both smart wallet and OpenOcean)
  async getUserUnifiedOrders(userAddress: Address): Promise<UnifiedDCAOrder[]> {
    const [smartWalletOrders, openOceanOrders] = await Promise.all([
      this.getUserOrders(userAddress),
      this.getUserOpenOceanOrders(userAddress),
    ]);

    const unifiedOrders: UnifiedDCAOrder[] = [
      ...smartWalletOrders.map((order) => ({
        ...order,
        provider: 'smart_wallet' as const,
      })),
      ...openOceanOrders,
    ];

    return unifiedOrders.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getAllUnifiedActiveOrders(): Promise<UnifiedDCAOrder[]> {
    const [smartWalletOrders, openOceanOrders] = await Promise.all([
      this.getAllActiveOrders(),
      this.getAllActiveOpenOceanOrders(),
    ]);

    const unifiedOrders: UnifiedDCAOrder[] = [
      ...smartWalletOrders.map((order) => ({
        ...order,
        provider: 'smart_wallet' as const,
      })),
      ...openOceanOrders,
    ];

    return unifiedOrders.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Executions
  async recordExecution(
    execution: Omit<DCAExecution, 'id'>,
  ): Promise<DCAExecution> {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newExecution: DCAExecution = { ...execution, id };

    // Store execution in Redis
    await redis.set(
      REDIS_KEYS.EXECUTION(id),
      JSON.stringify(this.serializeExecution(newExecution)),
    );
    await redis.sadd(REDIS_KEYS.ORDER_EXECUTIONS(execution.orderId), id);

    // Update the order's execution count and next execution time
    const order = await this.getOrder(execution.orderId);
    if (order) {
      const frequencyMs = this.getFrequencyInMs(order.frequency);
      const updatedOrder = {
        ...order,
        executionsCount: order.executionsCount + 1,
        executedAmount: order.executedAmount + execution.amountIn,
        lastExecutedAt: execution.executedAt * 1000, // Convert to ms
        nextExecutionAt: execution.executedAt * 1000 + frequencyMs,
        executionTxHashes: [...order.executionTxHashes, execution.txHash],
      };

      // Mark as completed if all executions are done
      if (updatedOrder.executionsCount >= updatedOrder.totalExecutions) {
        updatedOrder.status = 'completed';
      }

      await this.updateOrder(execution.orderId, updatedOrder);
    }

    return newExecution;
  }

  async getOrderExecutions(orderId: string): Promise<DCAExecution[]> {
    const executionIds = await redis.smembers(
      REDIS_KEYS.ORDER_EXECUTIONS(orderId),
    );
    const executions: DCAExecution[] = [];

    for (const id of executionIds) {
      const data = await redis.get(REDIS_KEYS.EXECUTION(id));
      if (data) {
        executions.push(this.deserializeExecution(JSON.parse(data as string)));
      }
    }

    return executions.sort((a, b) => a.executedAt - b.executedAt);
  }

  // Helper methods
  private getFrequencyInMs(frequency: DCAOrder['frequency']): number {
    switch (frequency) {
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 day
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 1 week
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  // Statistics
  async getUserStats(userAddress: Address) {
    const userOrderList = await this.getUserOrders(userAddress);

    const totalOrders = userOrderList.length;
    const activeOrders = userOrderList.filter(
      (order) => order.status === 'active',
    ).length;
    const completedOrders = userOrderList.filter(
      (order) => order.status === 'completed',
    ).length;

    const totalInvested = userOrderList.reduce(
      (sum, order) => sum + order.executedAmount,
      BigInt(0),
    );
    const totalExecutions = userOrderList.reduce(
      (sum, order) => sum + order.executionsCount,
      0,
    );

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalInvested,
      totalExecutions,
    };
  }
}

// Export a singleton instance
export const serverDcaDatabase = new ServerDCADatabase();
