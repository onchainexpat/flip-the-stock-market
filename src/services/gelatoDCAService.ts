/**
 * Gelato DCA Integration Service
 *
 * This service manages the integration between our DCA system and Gelato Web3 Functions.
 * It handles task creation, monitoring, and coordination with our existing infrastructure.
 */

import type { Address } from 'viem';

export interface GelatoTask {
  taskId: string;
  name: string;
  execAddress: Address;
  execSelector: string;
  dedicatedMsgSender: boolean;
  useTaskTreasuryFunds: boolean;
  singleExec: boolean;
  web3FunctionHash: string;
  web3FunctionArgsHash: string;
}

export interface DCAExecutionLog {
  taskId: string;
  orderId: string;
  executionTime: number;
  aggregatorUsed: string;
  inputAmount: string;
  outputAmount: string;
  gasUsed: string;
  txHash: string;
  success: boolean;
  error?: string;
}

export interface GelatoIntegrationConfig {
  gelatoApiKey: string;
  web3FunctionHash: string;
  fundingAmount: string; // ETH amount for task funding
  maxExecutionsPerRun: number;
  executionInterval: number; // seconds
}

export class GelatoDCAService {
  private readonly GELATO_API_BASE = 'https://api.gelato.digital';
  private readonly BASE_CHAIN_ID = 8453;

  constructor(private config: GelatoIntegrationConfig) {}

  /**
   * Create a new Gelato task for DCA automation
   */
  async createDCATask(
    taskName: string,
    userArgs: Record<string, any>,
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      console.log('🚀 Creating Gelato DCA task...');

      const taskConfig = {
        name: taskName,
        web3FunctionHash: this.config.web3FunctionHash,
        web3FunctionArgsHash: this.hashUserArgs(userArgs),
        trigger: {
          type: 'time',
          interval: this.config.executionInterval * 1000, // Convert to milliseconds
        },
        dedicatedMsgSender: false,
        useTaskTreasuryFunds: true,
        singleExec: false,
      };

      const response = await fetch(`${this.GELATO_API_BASE}/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.gelatoApiKey}`,
        },
        body: JSON.stringify(taskConfig),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gelato API error: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Gelato task created: ${result.taskId}`);

      return {
        success: true,
        taskId: result.taskId,
      };
    } catch (error) {
      console.error('❌ Failed to create Gelato task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fund a Gelato task with ETH for gas payments
   */
  async fundTask(
    taskId: string,
    amount: string,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      console.log(`💰 Funding Gelato task ${taskId} with ${amount} ETH...`);

      const response = await fetch(
        `${this.GELATO_API_BASE}/tasks/${taskId}/fund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.gelatoApiKey}`,
          },
          body: JSON.stringify({
            amount: amount,
            token: 'ETH',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Funding failed: ${response.status} ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Task funded: ${result.txHash}`);

      return {
        success: true,
        txHash: result.txHash,
      };
    } catch (error) {
      console.error('❌ Failed to fund task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get task execution history and status
   */
  async getTaskStatus(taskId: string): Promise<{
    success: boolean;
    status?: {
      isActive: boolean;
      lastExecution: number;
      executionCount: number;
      balance: string;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.GELATO_API_BASE}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.config.gelatoApiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        status: {
          isActive: result.status === 'active',
          lastExecution: result.lastExecution || 0,
          executionCount: result.executionCount || 0,
          balance: result.balance || '0',
        },
      };
    } catch (error) {
      console.error('❌ Failed to get task status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get task execution logs
   */
  async getExecutionLogs(
    taskId: string,
    limit = 50,
  ): Promise<{
    success: boolean;
    executions?: Array<{
      executionDate: string;
      txHash: string;
      gasUsed: string;
      success: boolean;
      errorMessage?: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.GELATO_API_BASE}/tasks/${taskId}/executions?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.gelatoApiKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Execution logs failed: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        executions: result.executions || [],
      };
    } catch (error) {
      console.error('❌ Failed to get execution logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a Gelato task
   */
  async cancelTask(
    taskId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🛑 Cancelling Gelato task ${taskId}...`);

      const response = await fetch(`${this.GELATO_API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.gelatoApiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.status}`);
      }

      console.log(`✅ Task cancelled: ${taskId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to cancel task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Monitor task health and performance
   */
  async monitorTaskHealth(taskId: string): Promise<{
    success: boolean;
    health?: {
      isHealthy: boolean;
      lastSuccessfulExecution: number;
      failureRate: number;
      averageGasUsed: string;
      balance: string;
      recommendations: string[];
    };
    error?: string;
  }> {
    try {
      // Get task status and recent executions
      const [statusResult, logsResult] = await Promise.all([
        this.getTaskStatus(taskId),
        this.getExecutionLogs(taskId, 20),
      ]);

      if (!statusResult.success || !logsResult.success) {
        throw new Error('Failed to fetch task data for health check');
      }

      const status = statusResult.status!;
      const executions = logsResult.executions!;

      // Calculate health metrics
      const now = Date.now() / 1000;
      const lastSuccessfulExecution =
        executions
          .filter((e) => e.success)
          .map((e) => new Date(e.executionDate).getTime() / 1000)
          .sort((a, b) => b - a)[0] || 0;

      const failureRate =
        executions.length > 0
          ? executions.filter((e) => !e.success).length / executions.length
          : 0;

      const averageGasUsed =
        executions.length > 0
          ? executions.reduce(
              (sum, e) => sum + Number.parseInt(e.gasUsed || '0'),
              0,
            ) / executions.length
          : 0;

      // Generate recommendations
      const recommendations: string[] = [];

      if (failureRate > 0.2) {
        recommendations.push(
          'High failure rate detected - check DCA order conditions',
        );
      }

      if (Number.parseFloat(status.balance) < 0.01) {
        recommendations.push('Low balance - consider adding more ETH for gas');
      }

      if (now - lastSuccessfulExecution > 7200) {
        // 2 hours
        recommendations.push(
          'No successful executions in 2+ hours - check system health',
        );
      }

      const isHealthy =
        failureRate < 0.3 &&
        Number.parseFloat(status.balance) > 0.005 &&
        now - lastSuccessfulExecution < 3600;

      return {
        success: true,
        health: {
          isHealthy,
          lastSuccessfulExecution,
          failureRate: Math.round(failureRate * 100) / 100,
          averageGasUsed: averageGasUsed.toString(),
          balance: status.balance,
          recommendations,
        },
      };
    } catch (error) {
      console.error('❌ Failed to monitor task health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create user args hash for Gelato Web3 Function
   */
  private hashUserArgs(userArgs: Record<string, any>): string {
    // Simple hash function - in production use a proper crypto hash
    const argsString = JSON.stringify(userArgs, Object.keys(userArgs).sort());
    let hash = 0;
    for (let i = 0; i < argsString.length; i++) {
      const char = argsString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(): Promise<{
    activeTasks: number;
    totalExecutions: number;
    successRate: number;
    totalGasSaved: string;
    averageExecutionTime: number;
  }> {
    // This would integrate with your database to get comprehensive stats
    return {
      activeTasks: 0,
      totalExecutions: 0,
      successRate: 0,
      totalGasSaved: '0',
      averageExecutionTime: 0,
    };
  }
}

// Export singleton with default config
export const gelatoDCAService = new GelatoDCAService({
  gelatoApiKey: process.env.GELATO_API_KEY || '',
  web3FunctionHash: process.env.GELATO_WEB3_FUNCTION_HASH || '',
  fundingAmount: '0.1', // 0.1 ETH default
  maxExecutionsPerRun: 5,
  executionInterval: 300, // 5 minutes
});
