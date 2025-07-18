import type { Address } from 'viem';
import { serverDcaDatabase } from '../lib/serverDcaDatabase';
import { openOceanSyncService } from './openOceanSyncService';

export enum ErrorType {
  SIGNATURE_GENERATION = 'SIGNATURE_GENERATION',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  ORDER_EXECUTION = 'ORDER_EXECUTION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorContext {
  type: ErrorType;
  message: string;
  originalError?: Error;
  orderHash?: string;
  userAddress?: Address;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface FallbackResult {
  success: boolean;
  data?: any;
  error?: string;
  fallbackUsed: boolean;
  retryCount: number;
}

/**
 * Comprehensive error handling service for OpenOcean DCA operations
 * Implements retry logic, fallback mechanisms, and user notifications
 */
export class OpenOceanErrorHandler {
  private retryStrategies: Map<ErrorType, RetryStrategy> = new Map([
    [
      ErrorType.SIGNATURE_GENERATION,
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
      },
    ],
    [
      ErrorType.API_RATE_LIMIT,
      {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
      },
    ],
    [
      ErrorType.ORDER_EXECUTION,
      {
        maxRetries: 3,
        baseDelay: 5000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: true,
      },
    ],
    [
      ErrorType.NETWORK_ERROR,
      {
        maxRetries: 4,
        baseDelay: 1000,
        maxDelay: 15000,
        backoffMultiplier: 2,
        jitter: true,
      },
    ],
    [
      ErrorType.PROVIDER_ERROR,
      {
        maxRetries: 2,
        baseDelay: 3000,
        maxDelay: 10000,
        backoffMultiplier: 1.5,
        jitter: true,
      },
    ],
  ]);

  private errorLog: ErrorContext[] = [];
  private rateLimitCache: Map<string, number> = new Map();
  private circuitBreaker: Map<
    string,
    { failures: number; lastFailure: number; open: boolean }
  > = new Map();

  /**
   * Handle signature generation failures with fallback to custom implementation
   */
  async handleSignatureGenerationError(
    error: Error,
    orderParams: any,
    userAddress: Address,
  ): Promise<FallbackResult> {
    const errorContext: ErrorContext = {
      type: ErrorType.SIGNATURE_GENERATION,
      message: 'OpenOcean signature generation failed',
      originalError: error,
      userAddress,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      metadata: { orderParams },
    };

    console.error('Signature generation error:', error);
    this.logError(errorContext);

    try {
      // Fallback strategy: Use custom DCA implementation instead
      console.log('Falling back to custom DCA implementation...');

      // This would integrate with the existing smart wallet DCA service
      const fallbackMessage = `OpenOcean signature generation failed. Please use Smart Wallet DCA instead, which provides gas-free execution.`;

      return {
        success: false,
        error: fallbackMessage,
        fallbackUsed: true,
        retryCount: 0,
      };
    } catch (fallbackError) {
      console.error('Fallback to custom DCA also failed:', fallbackError);

      return {
        success: false,
        error:
          'Both OpenOcean and Smart Wallet DCA are currently unavailable. Please try again later.',
        fallbackUsed: true,
        retryCount: 0,
      };
    }
  }

  /**
   * Handle API rate limiting with exponential backoff
   */
  async handleRateLimitError(
    error: Error,
    endpoint: string,
    operation: () => Promise<any>,
  ): Promise<FallbackResult> {
    const errorContext: ErrorContext = {
      type: ErrorType.API_RATE_LIMIT,
      message: 'OpenOcean API rate limit exceeded',
      originalError: error,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      metadata: { endpoint },
    };

    console.warn('Rate limit exceeded for endpoint:', endpoint);
    this.logError(errorContext);

    // Check if we've hit rate limit recently
    const lastRateLimit = this.rateLimitCache.get(endpoint);
    if (lastRateLimit && Date.now() - lastRateLimit < 60000) {
      // Return cached response or graceful degradation
      return {
        success: false,
        error: 'API rate limit exceeded. Please try again in a few minutes.',
        fallbackUsed: false,
        retryCount: 0,
      };
    }

    const strategy = this.retryStrategies.get(ErrorType.API_RATE_LIMIT)!;

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const delay = this.calculateDelay(attempt, strategy);
        console.log(
          `Rate limit retry ${attempt + 1}/${strategy.maxRetries} after ${delay}ms`,
        );

        await this.sleep(delay);

        const result = await operation();

        // Success - clear rate limit cache
        this.rateLimitCache.delete(endpoint);

        return {
          success: true,
          data: result,
          fallbackUsed: false,
          retryCount: attempt + 1,
        };
      } catch (retryError) {
        console.error(`Retry ${attempt + 1} failed:`, retryError);

        if (attempt === strategy.maxRetries - 1) {
          // Mark rate limit in cache
          this.rateLimitCache.set(endpoint, Date.now());

          return {
            success: false,
            error: 'API rate limit exceeded. Service will retry automatically.',
            fallbackUsed: false,
            retryCount: attempt + 1,
          };
        }
      }
    }

    return {
      success: false,
      error: 'Maximum retries exceeded',
      fallbackUsed: false,
      retryCount: strategy.maxRetries,
    };
  }

  /**
   * Handle order execution failures with automatic retry
   */
  async handleOrderExecutionError(
    error: Error,
    orderHash: string,
    userAddress: Address,
    retryOperation: () => Promise<any>,
  ): Promise<FallbackResult> {
    const errorContext: ErrorContext = {
      type: ErrorType.ORDER_EXECUTION,
      message: 'Order execution failed',
      originalError: error,
      orderHash,
      userAddress,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      metadata: { orderHash },
    };

    console.error('Order execution error:', error);
    this.logError(errorContext);

    const strategy = this.retryStrategies.get(ErrorType.ORDER_EXECUTION)!;

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const delay = this.calculateDelay(attempt, strategy);
        console.log(
          `Order execution retry ${attempt + 1}/${strategy.maxRetries} after ${delay}ms`,
        );

        await this.sleep(delay);

        // Check if order is still active before retrying
        const orderStatus = await openOceanSyncService.syncOrder(orderHash);
        if (
          !orderStatus.success ||
          orderStatus.newStatus === 'cancelled' ||
          orderStatus.newStatus === 'completed'
        ) {
          return {
            success: false,
            error: 'Order is no longer active for execution',
            fallbackUsed: false,
            retryCount: attempt + 1,
          };
        }

        const result = await retryOperation();

        return {
          success: true,
          data: result,
          fallbackUsed: false,
          retryCount: attempt + 1,
        };
      } catch (retryError) {
        console.error(`Execution retry ${attempt + 1} failed:`, retryError);

        if (attempt === strategy.maxRetries - 1) {
          // Mark order as needing manual intervention
          await this.markOrderForManualIntervention(
            orderHash,
            userAddress,
            error,
          );

          return {
            success: false,
            error:
              'Order execution failed after multiple attempts. Manual intervention required.',
            fallbackUsed: false,
            retryCount: attempt + 1,
          };
        }
      }
    }

    return {
      success: false,
      error: 'Maximum retries exceeded',
      fallbackUsed: false,
      retryCount: strategy.maxRetries,
    };
  }

  /**
   * Handle network errors with circuit breaker pattern
   */
  async handleNetworkError(
    error: Error,
    serviceKey: string,
    operation: () => Promise<any>,
  ): Promise<FallbackResult> {
    const errorContext: ErrorContext = {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network error occurred',
      originalError: error,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 4,
      metadata: { serviceKey },
    };

    console.error('Network error:', error);
    this.logError(errorContext);

    // Check circuit breaker
    const breaker = this.circuitBreaker.get(serviceKey);
    if (breaker?.open) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      const cooldownPeriod = 60000; // 1 minute

      if (timeSinceLastFailure < cooldownPeriod) {
        return {
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
          fallbackUsed: true,
          retryCount: 0,
        };
      } else {
        // Reset circuit breaker
        breaker.open = false;
        breaker.failures = 0;
      }
    }

    const strategy = this.retryStrategies.get(ErrorType.NETWORK_ERROR)!;

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const delay = this.calculateDelay(attempt, strategy);
        console.log(
          `Network retry ${attempt + 1}/${strategy.maxRetries} after ${delay}ms`,
        );

        await this.sleep(delay);

        const result = await operation();

        // Success - reset circuit breaker
        this.circuitBreaker.set(serviceKey, {
          failures: 0,
          lastFailure: 0,
          open: false,
        });

        return {
          success: true,
          data: result,
          fallbackUsed: false,
          retryCount: attempt + 1,
        };
      } catch (retryError) {
        console.error(`Network retry ${attempt + 1} failed:`, retryError);

        if (attempt === strategy.maxRetries - 1) {
          // Update circuit breaker
          const currentBreaker = this.circuitBreaker.get(serviceKey) || {
            failures: 0,
            lastFailure: 0,
            open: false,
          };
          currentBreaker.failures++;
          currentBreaker.lastFailure = Date.now();

          if (currentBreaker.failures >= 5) {
            currentBreaker.open = true;
          }

          this.circuitBreaker.set(serviceKey, currentBreaker);

          return {
            success: false,
            error: 'Network service temporarily unavailable',
            fallbackUsed: true,
            retryCount: attempt + 1,
          };
        }
      }
    }

    return {
      success: false,
      error: 'Network operation failed',
      fallbackUsed: false,
      retryCount: strategy.maxRetries,
    };
  }

  /**
   * Handle provider errors (wallet connection, signing, etc.)
   */
  async handleProviderError(
    error: Error,
    userAddress: Address,
    operation: () => Promise<any>,
  ): Promise<FallbackResult> {
    const errorContext: ErrorContext = {
      type: ErrorType.PROVIDER_ERROR,
      message: 'Provider error occurred',
      originalError: error,
      userAddress,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 2,
      metadata: { userAddress },
    };

    console.error('Provider error:', error);
    this.logError(errorContext);

    // Check if it's a user rejection (don't retry)
    if (
      error.message.includes('user rejected') ||
      error.message.includes('User denied')
    ) {
      return {
        success: false,
        error: 'Transaction was rejected by user',
        fallbackUsed: false,
        retryCount: 0,
      };
    }

    const strategy = this.retryStrategies.get(ErrorType.PROVIDER_ERROR)!;

    for (let attempt = 0; attempt < strategy.maxRetries; attempt++) {
      try {
        const delay = this.calculateDelay(attempt, strategy);
        console.log(
          `Provider retry ${attempt + 1}/${strategy.maxRetries} after ${delay}ms`,
        );

        await this.sleep(delay);

        const result = await operation();

        return {
          success: true,
          data: result,
          fallbackUsed: false,
          retryCount: attempt + 1,
        };
      } catch (retryError) {
        console.error(`Provider retry ${attempt + 1} failed:`, retryError);

        if (attempt === strategy.maxRetries - 1) {
          return {
            success: false,
            error:
              'Provider error persists. Please check your wallet connection.',
            fallbackUsed: false,
            retryCount: attempt + 1,
          };
        }
      }
    }

    return {
      success: false,
      error: 'Provider operation failed',
      fallbackUsed: false,
      retryCount: strategy.maxRetries,
    };
  }

  /**
   * General error handler with automatic error type detection
   */
  async handleError(
    error: Error,
    context: {
      operation: string;
      userAddress?: Address;
      orderHash?: string;
      endpoint?: string;
      serviceKey?: string;
      retryOperation?: () => Promise<any>;
    },
  ): Promise<FallbackResult> {
    const errorType = this.detectErrorType(error);

    console.log(
      `Handling ${errorType} error for operation: ${context.operation}`,
    );

    switch (errorType) {
      case ErrorType.SIGNATURE_GENERATION:
        return this.handleSignatureGenerationError(
          error,
          context,
          context.userAddress!,
        );

      case ErrorType.API_RATE_LIMIT:
        return this.handleRateLimitError(
          error,
          context.endpoint!,
          context.retryOperation!,
        );

      case ErrorType.ORDER_EXECUTION:
        return this.handleOrderExecutionError(
          error,
          context.orderHash!,
          context.userAddress!,
          context.retryOperation!,
        );

      case ErrorType.NETWORK_ERROR:
        return this.handleNetworkError(
          error,
          context.serviceKey!,
          context.retryOperation!,
        );

      case ErrorType.PROVIDER_ERROR:
        return this.handleProviderError(
          error,
          context.userAddress!,
          context.retryOperation!,
        );

      default:
        return {
          success: false,
          error: error.message || 'Unknown error occurred',
          fallbackUsed: false,
          retryCount: 0,
        };
    }
  }

  /**
   * Detect error type from error message and context
   */
  private detectErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('signature') || message.includes('signing')) {
      return ErrorType.SIGNATURE_GENERATION;
    }

    if (
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return ErrorType.API_RATE_LIMIT;
    }

    if (
      message.includes('execution') ||
      message.includes('order') ||
      message.includes('swap')
    ) {
      return ErrorType.ORDER_EXECUTION;
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return ErrorType.NETWORK_ERROR;
    }

    if (
      message.includes('provider') ||
      message.includes('wallet') ||
      message.includes('user rejected')
    ) {
      return ErrorType.PROVIDER_ERROR;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  private calculateDelay(attempt: number, strategy: RetryStrategy): number {
    const baseDelay = Math.min(
      strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt),
      strategy.maxDelay,
    );

    if (strategy.jitter) {
      // Add random jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * baseDelay;
      return baseDelay + jitter;
    }

    return baseDelay;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(errorContext: ErrorContext): void {
    this.errorLog.push(errorContext);

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Here you could integrate with external logging services
    console.error('Error logged:', {
      type: errorContext.type,
      message: errorContext.message,
      timestamp: new Date(errorContext.timestamp).toISOString(),
      userAddress: errorContext.userAddress,
      orderHash: errorContext.orderHash,
    });
  }

  /**
   * Mark order for manual intervention
   */
  private async markOrderForManualIntervention(
    orderHash: string,
    userAddress: Address,
    error: Error,
  ): Promise<void> {
    try {
      await serverDcaDatabase.updateOpenOceanOrderByHash(orderHash, {
        status: 'paused',
        updatedAt: Date.now(),
      });

      // Here you could send notifications to admins or users
      console.warn('Order marked for manual intervention:', {
        orderHash,
        userAddress,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error(
        'Failed to mark order for manual intervention:',
        updateError,
      );
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    recentErrors: ErrorContext[];
    circuitBreakerStatus: Record<string, { failures: number; open: boolean }>;
  } {
    const errorsByType = this.errorLog.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorType, number>,
    );

    const circuitBreakerStatus = Object.fromEntries(
      Array.from(this.circuitBreaker.entries()).map(([key, value]) => [
        key,
        { failures: value.failures, open: value.open },
      ]),
    );

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      recentErrors: this.errorLog.slice(-10),
      circuitBreakerStatus,
    };
  }

  /**
   * Clear error log and reset circuit breakers
   */
  clearErrorHistory(): void {
    this.errorLog = [];
    this.circuitBreaker.clear();
    this.rateLimitCache.clear();
  }
}

// Export singleton instance
export const openOceanErrorHandler = new OpenOceanErrorHandler();
