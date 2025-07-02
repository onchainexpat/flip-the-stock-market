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
    await redis.set(REDIS_KEYS.ORDER(id), this.serializeOrder(newOrder));

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
    return data ? this.deserializeOrder(data) : null;
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
    await redis.set(REDIS_KEYS.ORDER(id), this.serializeOrder(updatedOrder));
    return updatedOrder;
  }

  async updateOrderStatus(
    id: string,
    status: DCAOrder['status'],
  ): Promise<DCAOrder | null> {
    return this.updateOrder(id, { status });
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

  // Executions
  async recordExecution(
    execution: Omit<DCAExecution, 'id'>,
  ): Promise<DCAExecution> {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newExecution: DCAExecution = { ...execution, id };

    // Store execution in Redis
    await redis.set(
      REDIS_KEYS.EXECUTION(id),
      this.serializeExecution(newExecution),
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
        executions.push(this.deserializeExecution(data));
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
