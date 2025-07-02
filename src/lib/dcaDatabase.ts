'use client';
import type { Address } from 'viem';

export interface DCAOrder {
  id: string;
  userAddress: Address;
  sessionKeyAddress: Address;

  // Order parameters
  fromToken: Address;
  toToken: Address;
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

  // Timestamps
  executedAt: number;
  blockNumber: number;

  // Status
  status: 'pending' | 'confirmed' | 'failed';
  errorMessage?: string;
}

class DCADatabase {
  private orders: Map<string, DCAOrder> = new Map();
  private executions: Map<string, DCAExecution> = new Map();
  private userOrders: Map<Address, string[]> = new Map();

  constructor() {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  // Order management
  async createOrder(
    order: Omit<
      DCAOrder,
      | 'id'
      | 'createdAt'
      | 'executedAmount'
      | 'executionsCount'
      | 'executionTxHashes'
    >,
  ): Promise<DCAOrder> {
    const id = this.generateId();
    const now = Math.floor(Date.now() / 1000);

    const newOrder: DCAOrder = {
      ...order,
      id,
      createdAt: now,
      executedAmount: BigInt(0),
      executionsCount: 0,
      executionTxHashes: [],
    };

    this.orders.set(id, newOrder);

    // Update user orders index
    const userOrderIds = this.userOrders.get(order.userAddress) || [];
    userOrderIds.push(id);
    this.userOrders.set(order.userAddress, userOrderIds);

    this.saveToStorage();
    return newOrder;
  }

  async getOrder(id: string): Promise<DCAOrder | null> {
    return this.orders.get(id) || null;
  }

  async getUserOrders(userAddress: Address): Promise<DCAOrder[]> {
    const orderIds = this.userOrders.get(userAddress) || [];
    return orderIds
      .map((id) => this.orders.get(id))
      .filter(Boolean) as DCAOrder[];
  }

  async updateOrder(
    id: string,
    updates: Partial<DCAOrder>,
  ): Promise<DCAOrder | null> {
    const order = this.orders.get(id);
    if (!order) return null;

    const updatedOrder = { ...order, ...updates };
    this.orders.set(id, updatedOrder);
    this.saveToStorage();
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const order = this.orders.get(id);
    if (!order) return false;

    this.orders.delete(id);

    // Remove from user orders index
    const userOrderIds = this.userOrders.get(order.userAddress) || [];
    const filteredIds = userOrderIds.filter((orderId) => orderId !== id);
    this.userOrders.set(order.userAddress, filteredIds);

    this.saveToStorage();
    return true;
  }

  // Execution tracking
  async recordExecution(
    execution: Omit<DCAExecution, 'id'>,
  ): Promise<DCAExecution> {
    const id = this.generateId();
    const newExecution: DCAExecution = { ...execution, id };

    this.executions.set(id, newExecution);

    // Update order execution tracking
    const order = this.orders.get(execution.orderId);
    if (order) {
      order.executionsCount += 1;
      order.executedAmount += execution.amountIn;
      order.lastExecutedAt = execution.executedAt;
      order.executionTxHashes.push(execution.txHash);

      // Calculate next execution time
      order.nextExecutionAt = this.calculateNextExecution(order);

      // Check if order is completed
      if (order.executionsCount >= order.totalExecutions) {
        order.status = 'completed';
      }

      this.orders.set(execution.orderId, order);
    }

    this.saveToStorage();
    return newExecution;
  }

  async getOrderExecutions(orderId: string): Promise<DCAExecution[]> {
    const executions: DCAExecution[] = [];
    for (const execution of this.executions.values()) {
      if (execution.orderId === orderId) {
        executions.push(execution);
      }
    }
    return executions.sort((a, b) => b.executedAt - a.executedAt);
  }

  // Query methods
  async getActiveOrders(): Promise<DCAOrder[]> {
    const now = Math.floor(Date.now() / 1000);
    return Array.from(this.orders.values()).filter(
      (order) => order.status === 'active' && order.expiresAt > now,
    );
  }

  async getOrdersDueForExecution(): Promise<DCAOrder[]> {
    const now = Math.floor(Date.now() / 1000);
    return Array.from(this.orders.values()).filter(
      (order) =>
        order.status === 'active' &&
        order.nextExecutionAt <= now &&
        order.expiresAt > now &&
        order.executionsCount < order.totalExecutions,
    );
  }

  // Statistics
  async getUserStats(userAddress: Address): Promise<{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalInvested: bigint;
    totalExecutions: number;
  }> {
    const userOrders = await this.getUserOrders(userAddress);

    return {
      totalOrders: userOrders.length,
      activeOrders: userOrders.filter((o) => o.status === 'active').length,
      completedOrders: userOrders.filter((o) => o.status === 'completed')
        .length,
      totalInvested: userOrders.reduce(
        (sum, o) => sum + o.executedAmount,
        BigInt(0),
      ),
      totalExecutions: userOrders.reduce(
        (sum, o) => sum + o.executionsCount,
        0,
      ),
    };
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private calculateNextExecution(order: DCAOrder): number {
    const baseTime = order.lastExecutedAt || order.createdAt;
    const intervals = {
      hourly: 60 * 60,
      daily: 24 * 60 * 60,
      weekly: 7 * 24 * 60 * 60,
      monthly: 30 * 24 * 60 * 60,
    };

    return baseTime + intervals[order.frequency];
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const data = {
          orders: Array.from(this.orders.entries()),
          executions: Array.from(this.executions.entries()),
          userOrders: Array.from(this.userOrders.entries()),
        };
        localStorage.setItem(
          'dca-database',
          JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
        );
      } catch (error) {
        console.error('Failed to save DCA database to localStorage:', error);
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dca-database');
        if (stored) {
          const data = JSON.parse(stored, (key, value) => {
            // Convert string numbers back to bigint for specific fields
            if (
              key === 'totalAmount' ||
              key === 'executedAmount' ||
              key === 'amountIn' ||
              key === 'amountOut' ||
              key === 'gasUsed' ||
              key === 'gasPrice'
            ) {
              return BigInt(value);
            }
            return value;
          });

          this.orders = new Map(data.orders || []);
          this.executions = new Map(data.executions || []);
          this.userOrders = new Map(data.userOrders || []);
        }
      } catch (error) {
        console.error('Failed to load DCA database from localStorage:', error);
      }
    }
  }

  // Clear all data (for testing)
  async clearAll(): Promise<void> {
    this.orders.clear();
    this.executions.clear();
    this.userOrders.clear();
    this.saveToStorage();
  }
}

// Singleton instance
export const dcaDatabase = new DCADatabase();
