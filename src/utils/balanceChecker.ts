import { http, createPublicClient, erc20Abi } from 'viem';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import { serverDcaDatabase } from '../lib/serverDcaDatabase';
import { TOKENS } from './dexApi';

// Create public client for blockchain queries
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export interface BalanceCheckResult {
  userAddress: Address;
  currentBalance: bigint;
  requiredBalance: bigint;
  hasInsufficientBalance: boolean;
  ordersAffected: string[];
}

export class BalanceChecker {
  /**
   * Check USDC balance for a specific user and their active DCA orders
   */
  async checkUserBalance(userAddress: Address): Promise<BalanceCheckResult> {
    try {
      // Get current USDC balance
      const currentBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      // Get user's active DCA orders
      const orders = await serverDcaDatabase.getUserOrders(userAddress);
      const activeOrders = orders.filter((order) => order.status === 'active');

      if (activeOrders.length === 0) {
        return {
          userAddress,
          currentBalance,
          requiredBalance: BigInt(0),
          hasInsufficientBalance: false,
          ordersAffected: [],
        };
      }

      // Calculate required balance for next executions
      let totalRequiredBalance = BigInt(0);
      const ordersAffected: string[] = [];

      for (const order of activeOrders) {
        // Calculate amount needed for next execution
        const amountPerOrder =
          order.totalAmount / BigInt(order.totalExecutions);

        // Check if order has remaining executions
        const executionsRemaining =
          order.totalExecutions - order.executionsCount;
        if (executionsRemaining > 0) {
          totalRequiredBalance += amountPerOrder;

          // If balance is insufficient for this specific order, mark it
          if (currentBalance < amountPerOrder) {
            ordersAffected.push(order.id);
          }
        }
      }

      const hasInsufficientBalance =
        currentBalance < totalRequiredBalance || ordersAffected.length > 0;

      return {
        userAddress,
        currentBalance,
        requiredBalance: totalRequiredBalance,
        hasInsufficientBalance,
        ordersAffected,
      };
    } catch (error) {
      console.error(`Failed to check balance for user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Check balances for all users with active DCA orders
   */
  async checkAllUserBalances(): Promise<BalanceCheckResult[]> {
    try {
      // Get all active orders to find unique users
      const allOrders = await serverDcaDatabase.getAllActiveOrders();
      const uniqueUsers = [
        ...new Set(allOrders.map((order) => order.userAddress)),
      ];

      console.log(
        `Checking balances for ${uniqueUsers.length} users with active DCA orders`,
      );

      const results: BalanceCheckResult[] = [];

      // Check balance for each user
      for (const userAddress of uniqueUsers) {
        try {
          const result = await this.checkUserBalance(userAddress);
          results.push(result);

          if (result.hasInsufficientBalance) {
            console.log(
              `Insufficient balance detected for user ${userAddress}:`,
              {
                currentBalance: result.currentBalance.toString(),
                requiredBalance: result.requiredBalance.toString(),
                ordersAffected: result.ordersAffected,
              },
            );
          }
        } catch (error) {
          console.error(
            `Failed to check balance for user ${userAddress}:`,
            error,
          );
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to check all user balances:', error);
      throw error;
    }
  }

  /**
   * Update orders with insufficient balance status
   */
  async updateInsufficientBalanceOrders(
    balanceResults: BalanceCheckResult[],
  ): Promise<void> {
    try {
      for (const result of balanceResults) {
        if (result.hasInsufficientBalance && result.ordersAffected.length > 0) {
          console.log(
            `Updating ${result.ordersAffected.length} orders to insufficient_balance status for user ${result.userAddress}`,
          );

          for (const orderId of result.ordersAffected) {
            await serverDcaDatabase.updateOrderStatus(
              orderId,
              'insufficient_balance',
            );
            console.log(
              `Updated order ${orderId} to insufficient_balance status`,
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to update insufficient balance orders:', error);
      throw error;
    }
  }

  /**
   * Check for orders that have regained sufficient balance
   */
  async checkRecoveredBalances(): Promise<void> {
    try {
      // Get all orders with insufficient_balance status
      const insufficientBalanceOrders =
        await serverDcaDatabase.getOrdersByStatus('insufficient_balance');

      if (insufficientBalanceOrders.length === 0) {
        return;
      }

      console.log(
        `Checking ${insufficientBalanceOrders.length} orders with insufficient balance for recovery`,
      );

      // Group orders by user
      const ordersByUser = insufficientBalanceOrders.reduce(
        (acc, order) => {
          if (!acc[order.userAddress]) {
            acc[order.userAddress] = [];
          }
          acc[order.userAddress].push(order);
          return acc;
        },
        {} as Record<string, typeof insufficientBalanceOrders>,
      );

      // Check each user's balance
      for (const [userAddress, userOrders] of Object.entries(ordersByUser)) {
        try {
          const balanceResult = await this.checkUserBalance(
            userAddress as Address,
          );

          // Find orders that now have sufficient balance
          const recoveredOrders = userOrders.filter((order) => {
            const amountPerOrder =
              order.totalAmount / BigInt(order.totalExecutions);
            return balanceResult.currentBalance >= amountPerOrder;
          });

          // Reactivate recovered orders
          for (const order of recoveredOrders) {
            await serverDcaDatabase.updateOrderStatus(order.id, 'active');
            console.log(`Reactivated order ${order.id} - balance recovered`);
          }

          if (recoveredOrders.length > 0) {
            console.log(
              `Reactivated ${recoveredOrders.length} orders for user ${userAddress}`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to check recovery for user ${userAddress}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error('Failed to check recovered balances:', error);
      throw error;
    }
  }

  /**
   * Run complete balance check cycle
   */
  async runBalanceCheck(): Promise<void> {
    try {
      console.log('Starting balance check cycle...');

      // Check all user balances
      const balanceResults = await this.checkAllUserBalances();

      // Update orders with insufficient balance
      await this.updateInsufficientBalanceOrders(balanceResults);

      // Check for recovered balances
      await this.checkRecoveredBalances();

      console.log('Balance check cycle completed');
    } catch (error) {
      console.error('Balance check cycle failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const balanceChecker = new BalanceChecker();
