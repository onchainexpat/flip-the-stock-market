import type { Address } from 'viem';
import {
  type DCAExecution as DBDCAExecution,
  type DCAOrder as DBDCAOrder,
  dcaDatabase,
} from '../lib/dcaDatabase';
import { type SwapTransaction, dexApi, parseTokenAmount } from './dexApi';

export interface DCAOrder {
  id: string;
  userAddress: Address;
  sessionKeyAddress: Address;
  fromToken: Address;
  toToken: Address;
  totalAmount: string; // Total amount in wei
  amountPerOrder: string; // Amount per order in wei
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  executionsRemaining: number;
  totalExecutions: number;
  executedAmount: string; // Amount already executed in wei
  status:
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'insufficient_balance';
  createdAt: Date;
  updatedAt: Date;
  lastExecutedAt?: Date;
  nextExecutionAt: Date;
}

export interface DCAExecution {
  id: string;
  orderId: string;
  transactionHash: string;
  fromToken: Address;
  toToken: Address;
  amountIn: string; // Amount sold in wei
  amountOut: string; // Amount received in wei
  gasUsed: string;
  gasCost: string;
  executedAt: Date;
  priceImpact: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

export class DCAEngine {
  // Remove in-memory storage, use persistent database instead

  // Create a new DCA order
  async createOrder(
    userAddress: Address,
    sessionKeyAddress: Address,
    params: {
      fromToken: Address;
      toToken: Address;
      totalAmount: string; // In human readable format (e.g., "100")
      frequency: DCAOrder['frequency'];
      startDate: Date;
      numberOfOrders: number;
      platformFeePercentage?: number;
      estimatedPriceImpact?: number;
    },
  ): Promise<DCAOrder> {
    const totalAmountWei = parseTokenAmount(params.totalAmount, 6); // USDC has 6 decimals
    const totalAmountBigInt = BigInt(totalAmountWei);

    // Calculate fees
    const feePercentage = params.platformFeePercentage || 0.1;
    const totalPlatformFees =
      (totalAmountBigInt * BigInt(Math.floor(feePercentage * 100))) /
      BigInt(10000);
    const netInvestmentAmount = totalAmountBigInt - totalPlatformFees;

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(params.startDate.getTime() / 1000);
    const duration = this.calculateDurationInDays(
      params.frequency,
      params.numberOfOrders,
    );
    const expiresAt = startTime + duration * 24 * 60 * 60;

    // Create database order
    const dbOrder = await dcaDatabase.createOrder({
      userAddress,
      sessionKeyAddress,
      fromToken: params.fromToken,
      toToken: params.toToken,
      totalAmount: totalAmountBigInt,
      frequency: params.frequency,
      duration,
      status: 'active',
      totalExecutions: params.numberOfOrders,
      nextExecutionAt: startTime,
      expiresAt,
      platformFeePercentage: feePercentage,
      totalPlatformFees,
      netInvestmentAmount,
      estimatedPriceImpact: params.estimatedPriceImpact,
    });

    // Convert to legacy format for compatibility
    const amountPerOrder =
      dbOrder.totalAmount / BigInt(dbOrder.totalExecutions);
    const order: DCAOrder = {
      id: dbOrder.id,
      userAddress: dbOrder.userAddress,
      sessionKeyAddress: dbOrder.sessionKeyAddress,
      fromToken: dbOrder.fromToken,
      toToken: dbOrder.toToken,
      totalAmount: dbOrder.totalAmount.toString(),
      amountPerOrder: amountPerOrder.toString(),
      frequency: dbOrder.frequency,
      startDate: params.startDate,
      endDate: new Date(dbOrder.expiresAt * 1000),
      executionsRemaining: dbOrder.totalExecutions - dbOrder.executionsCount,
      totalExecutions: dbOrder.totalExecutions,
      executedAmount: dbOrder.executedAmount.toString(),
      status: dbOrder.status,
      createdAt: new Date(dbOrder.createdAt * 1000),
      updatedAt: new Date(dbOrder.createdAt * 1000),
      lastExecutedAt: dbOrder.lastExecutedAt
        ? new Date(dbOrder.lastExecutedAt * 1000)
        : undefined,
      nextExecutionAt: new Date(dbOrder.nextExecutionAt * 1000),
    };

    console.log('Created DCA order:', order);
    return order;
  }

  // Get all orders for a user
  async getUserOrders(userAddress: Address): Promise<DCAOrder[]> {
    const dbOrders = await dcaDatabase.getUserOrders(userAddress);
    return dbOrders.map(this.convertDbOrderToLegacy);
  }

  // Get order by ID
  async getOrder(orderId: string): Promise<DCAOrder | null> {
    const dbOrder = await dcaDatabase.getOrder(orderId);
    return dbOrder ? this.convertDbOrderToLegacy(dbOrder) : null;
  }

  // Get executions for an order
  async getOrderExecutions(orderId: string): Promise<DCAExecution[]> {
    const dbExecutions = await dcaDatabase.getOrderExecutions(orderId);
    return dbExecutions.map(this.convertDbExecutionToLegacy);
  }

  // Execute a single DCA order
  async executeOrder(
    orderId: string,
    executeTransaction: (tx: SwapTransaction) => Promise<string>,
  ): Promise<DCAExecution> {
    const dbOrder = await dcaDatabase.getOrder(orderId);
    if (!dbOrder) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (dbOrder.status !== 'active') {
      throw new Error(`Order ${orderId} is not active`);
    }

    if (dbOrder.executionsCount >= dbOrder.totalExecutions) {
      throw new Error(`Order ${orderId} has no remaining executions`);
    }

    const amountPerOrder =
      dbOrder.totalAmount / BigInt(dbOrder.totalExecutions);
    const now = Math.floor(Date.now() / 1000);

    try {
      // Get swap transaction from DEX API (Uniswap/OpenOcean)
      const swapTx = await dexApi.getSwapTransaction({
        sellToken: dbOrder.fromToken,
        buyToken: dbOrder.toToken,
        sellAmount: amountPerOrder.toString(),
        takerAddress: dbOrder.sessionKeyAddress,
        slippagePercentage: 0.02, // 2% slippage tolerance
      });

      // Execute the transaction
      const transactionHash = await executeTransaction(swapTx);

      // Record execution in database
      const dbExecution = await dcaDatabase.recordExecution({
        orderId,
        txHash: transactionHash,
        amountIn: amountPerOrder,
        amountOut: BigInt(0), // Will be updated when transaction is confirmed
        gasUsed: BigInt(swapTx.gas),
        gasPrice: BigInt(swapTx.gasPrice),
        executedAt: now,
        blockNumber: 0, // Will be updated when confirmed
        status: 'pending',
      });

      console.log('Executed DCA order:', {
        orderId,
        executionId: dbExecution.id,
        transactionHash,
      });

      return this.convertDbExecutionToLegacy(dbExecution);
    } catch (error) {
      console.error('Failed to execute DCA order:', error);

      // Record failed execution
      const dbExecution = await dcaDatabase.recordExecution({
        orderId,
        txHash: '0x',
        amountIn: amountPerOrder,
        amountOut: BigInt(0),
        gasUsed: BigInt(0),
        gasPrice: BigInt(0),
        executedAt: now,
        blockNumber: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // Get orders ready for execution
  async getOrdersReadyForExecution(): Promise<DCAOrder[]> {
    const dbOrders = await dcaDatabase.getOrdersDueForExecution();
    return dbOrders.map(this.convertDbOrderToLegacy);
  }

  // Cancel an order
  async cancelOrder(orderId: string): Promise<void> {
    await dcaDatabase.updateOrder(orderId, { status: 'cancelled' });
  }

  // Pause an order
  async pauseOrder(orderId: string): Promise<void> {
    await dcaDatabase.updateOrder(orderId, { status: 'paused' });
  }

  // Resume an order
  async resumeOrder(orderId: string): Promise<void> {
    await dcaDatabase.updateOrder(orderId, { status: 'active' });
  }

  // Conversion methods
  private convertDbOrderToLegacy = (dbOrder: DBDCAOrder): DCAOrder => {
    const amountPerOrder =
      dbOrder.totalAmount / BigInt(dbOrder.totalExecutions);
    return {
      id: dbOrder.id,
      userAddress: dbOrder.userAddress,
      sessionKeyAddress: dbOrder.sessionKeyAddress,
      fromToken: dbOrder.fromToken,
      toToken: dbOrder.toToken,
      totalAmount: dbOrder.totalAmount.toString(),
      amountPerOrder: amountPerOrder.toString(),
      frequency: dbOrder.frequency,
      startDate: new Date(dbOrder.createdAt * 1000),
      endDate: new Date(dbOrder.expiresAt * 1000),
      executionsRemaining: dbOrder.totalExecutions - dbOrder.executionsCount,
      totalExecutions: dbOrder.totalExecutions,
      executedAmount: dbOrder.executedAmount.toString(),
      status: dbOrder.status,
      createdAt: new Date(dbOrder.createdAt * 1000),
      updatedAt: new Date(dbOrder.createdAt * 1000),
      lastExecutedAt: dbOrder.lastExecutedAt
        ? new Date(dbOrder.lastExecutedAt * 1000)
        : undefined,
      nextExecutionAt: new Date(dbOrder.nextExecutionAt * 1000),
    };
  };

  private convertDbExecutionToLegacy = (
    dbExecution: DBDCAExecution,
  ): DCAExecution => {
    return {
      id: dbExecution.id,
      orderId: dbExecution.orderId,
      transactionHash: dbExecution.txHash,
      fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address, // USDC
      toToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address, // SPX6900
      amountIn: dbExecution.amountIn.toString(),
      amountOut: dbExecution.amountOut.toString(),
      gasUsed: dbExecution.gasUsed.toString(),
      gasCost: (dbExecution.gasUsed * dbExecution.gasPrice).toString(),
      executedAt: new Date(dbExecution.executedAt * 1000),
      priceImpact: 0,
      status:
        dbExecution.status === 'confirmed' ? 'completed' : dbExecution.status,
      errorMessage: dbExecution.errorMessage,
    };
  };

  // Helper methods
  private calculateDurationInDays(
    frequency: DCAOrder['frequency'],
    numberOfOrders: number,
  ): number {
    switch (frequency) {
      case 'hourly':
        return Math.ceil(numberOfOrders / 24);
      case 'daily':
        return numberOfOrders;
      case 'weekly':
        return numberOfOrders * 7;
      case 'monthly':
        return numberOfOrders * 30;
      default:
        return numberOfOrders;
    }
  }

  // Get user statistics
  async getUserStats(userAddress: Address): Promise<{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalInvested: string;
    totalExecutions: number;
  }> {
    const stats = await dcaDatabase.getUserStats(userAddress);
    return {
      ...stats,
      totalInvested: stats.totalInvested.toString(),
    };
  }

  // Get order statistics
  async getOrderStats(orderId: string): Promise<{
    totalInvested: string;
    totalReceived: string;
    averagePrice: number;
    executionCount: number;
    successRate: number;
  } | null> {
    const executions = await dcaDatabase.getOrderExecutions(orderId);

    if (!executions || executions.length === 0) {
      return null;
    }

    const completedExecutions = executions.filter(
      (e) => e.status === 'confirmed',
    );
    const totalInvested = completedExecutions
      .reduce((sum, e) => sum + e.amountIn, BigInt(0))
      .toString();
    const totalReceived = completedExecutions
      .reduce((sum, e) => sum + e.amountOut, BigInt(0))
      .toString();

    const averagePrice =
      completedExecutions.length > 0
        ? Number(totalInvested) / Number(totalReceived)
        : 0;

    return {
      totalInvested,
      totalReceived,
      averagePrice,
      executionCount: completedExecutions.length,
      successRate:
        executions.length > 0
          ? (completedExecutions.length / executions.length) * 100
          : 0,
    };
  }
}

// Create a default instance
export const dcaEngine = new DCAEngine();
