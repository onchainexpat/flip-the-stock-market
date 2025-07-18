import type { Address } from 'viem';
import { TOKENS } from '../utils/openOceanApi';

export interface ExecutableSwapData {
  aggregator: string;
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  buyAmount: string;
  minimumReceived: string;
  to: Address;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  priceImpact: string;
  success: boolean;
  error?: string;
}

export interface SwapExecutionResult {
  bestSwap: ExecutableSwapData;
  alternativeSwaps: ExecutableSwapData[];
  savings: {
    amount: string;
    percentage: string;
    compared_to: string;
  };
  executionMetadata: {
    totalAggregators: number;
    successfulQuotes: number;
    recommendedGasLimit: string;
    estimatedExecutionTime: number;
  };
}

/**
 * Service for getting executable swap data from multiple aggregators
 * This builds transaction data that can be executed directly
 * Features comprehensive error handling and fallback mechanisms
 */
export class AggregatorExecutionService {
  private readonly BASE_CHAIN_ID = 8453;
  private readonly REQUEST_TIMEOUT = 8000; // 8 seconds for swap data
  private readonly SLIPPAGE = '1.5'; // 1.5% slippage
  private readonly MAX_RETRIES = 2;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3; // Lower threshold for execution
  private readonly CIRCUIT_BREAKER_TIMEOUT = 180000; // 3 minutes

  // Circuit breaker state for each aggregator
  private circuitBreakers = new Map<
    string,
    {
      failures: number;
      lastFailure: number;
      isOpen: boolean;
    }
  >();

  /**
   * Get executable swap data from all aggregators and return the best one
   */
  async getBestExecutableSwap(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
  ): Promise<SwapExecutionResult> {
    console.log(`🔄 Getting executable swap data for ${sellAmount} tokens`);
    console.log(`   From: ${sellToken} → To: ${buyToken}`);
    console.log(`   User: ${userAddress}`);

    // Check circuit breakers
    const availableAggregators = this.getAvailableAggregators();
    console.log(`   Available aggregators: ${availableAggregators.join(', ')}`);

    if (availableAggregators.length === 0) {
      throw new Error('All swap aggregators are currently unavailable');
    }

    // Get swap data from available aggregators with retry logic
    const swapPromises = [];

    if (availableAggregators.includes('OpenOcean')) {
      swapPromises.push(
        this.getSwapDataWithRetry(
          'OpenOcean',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }
    if (availableAggregators.includes('1inch')) {
      swapPromises.push(
        this.getSwapDataWithRetry(
          '1inch',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }
    if (availableAggregators.includes('Paraswap')) {
      swapPromises.push(
        this.getSwapDataWithRetry(
          'Paraswap',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }

    const results = await Promise.allSettled(swapPromises);

    // Extract successful swaps and update circuit breakers
    const swaps: ExecutableSwapData[] = [];

    results.forEach((result, index) => {
      const aggregatorName = availableAggregators[index];

      if (result.status === 'fulfilled' && result.value.success) {
        swaps.push(result.value);
        this.recordSuccess(aggregatorName);
        console.log(`✅ ${aggregatorName}: Executable swap data ready`);
      } else {
        const error =
          result.status === 'rejected' ? result.reason : result.value.error;
        this.recordFailure(aggregatorName);
        console.warn(`❌ ${aggregatorName}: Swap data failed - ${error}`);
      }
    });

    if (swaps.length === 0) {
      // Try emergency fallback to OpenOcean API endpoint
      const fallbackSwap = await this.getEmergencyFallbackSwap(
        sellToken,
        buyToken,
        sellAmount,
        userAddress,
      );
      if (fallbackSwap) {
        swaps.push(fallbackSwap);
        console.log('🚨 Using emergency fallback swap data');
      } else {
        throw new Error(
          'All aggregators failed and no fallback swap data available',
        );
      }
    }

    // Find the best swap (highest buyAmount)
    const bestSwap = swaps.reduce((best, current) => {
      const bestAmount = BigInt(best.buyAmount);
      const currentAmount = BigInt(current.buyAmount);
      return currentAmount > bestAmount ? current : best;
    });

    // Calculate savings vs alternatives
    const alternativeSwaps = swaps.filter(
      (swap) => swap.aggregator !== bestSwap.aggregator,
    );
    const nextBestSwap =
      alternativeSwaps.length > 0
        ? alternativeSwaps.reduce((best, current) => {
            const bestAmount = BigInt(best.buyAmount);
            const currentAmount = BigInt(current.buyAmount);
            return currentAmount > bestAmount ? current : best;
          })
        : bestSwap;

    const savingsAmount =
      BigInt(bestSwap.buyAmount) - BigInt(nextBestSwap.buyAmount);
    const savingsPercentage =
      nextBestSwap.buyAmount !== '0'
        ? Number((savingsAmount * 10000n) / BigInt(nextBestSwap.buyAmount)) /
          100
        : 0;

    console.log(
      `✅ Best swap: ${bestSwap.aggregator} - ${bestSwap.buyAmount} tokens`,
    );
    console.log(
      `💰 Savings: ${savingsAmount.toString()} tokens (${savingsPercentage.toFixed(2)}%)`,
    );

    return {
      bestSwap,
      alternativeSwaps,
      savings: {
        amount: savingsAmount.toString(),
        percentage: savingsPercentage.toFixed(4),
        compared_to: nextBestSwap.aggregator,
      },
      executionMetadata: {
        totalAggregators: 3,
        successfulQuotes: swaps.length,
        recommendedGasLimit: bestSwap.gas,
        estimatedExecutionTime: 30, // seconds
      },
    };
  }

  /**
   * Get swap data with retry logic
   */
  private async getSwapDataWithRetry(
    aggregator: string,
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
    retryCount = 0,
  ): Promise<ExecutableSwapData> {
    try {
      switch (aggregator) {
        case 'OpenOcean':
          return await this.getOpenOceanSwapData(
            sellToken,
            buyToken,
            sellAmount,
            userAddress,
          );
        case '1inch':
          return await this.get1inchSwapData(
            sellToken,
            buyToken,
            sellAmount,
            userAddress,
          );
        case 'Paraswap':
          return await this.getParaswapSwapData(
            sellToken,
            buyToken,
            sellAmount,
            userAddress,
          );
        default:
          throw new Error(`Unknown aggregator: ${aggregator}`);
      }
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.log(
          `🔄 Retrying ${aggregator} swap data (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.delay(2000 * (retryCount + 1)); // Longer delay for swap data
        return this.getSwapDataWithRetry(
          aggregator,
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
          retryCount + 1,
        );
      }
      throw error;
    }
  }

  /**
   * Get executable swap data from OpenOcean
   */
  private async getOpenOceanSwapData(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
  ): Promise<ExecutableSwapData> {
    try {
      const params = new URLSearchParams({
        chain: this.BASE_CHAIN_ID.toString(),
        inTokenAddress: sellToken,
        outTokenAddress: buyToken,
        amountDecimals: sellAmount,
        account: userAddress,
        slippage: this.SLIPPAGE,
        gasPrice: '1000000000',
      });

      const response = await this.fetchWithTimeout(
        `https://open-api.openocean.finance/v4/${this.BASE_CHAIN_ID}/swap_quote?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json',
            'DNT': '1',
            'Origin': 'https://app.openocean.finance',
            'Pragma': 'no-cache',
            'Referer': 'https://app.openocean.finance/',
            'Sec-CH-UA': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`OpenOcean swap API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || data.data === '0x') {
        throw new Error('OpenOcean returned no executable swap data');
      }

      if (!data.outAmount || data.outAmount === '0') {
        throw new Error('OpenOcean returned zero output amount');
      }

      if (
        !data.to ||
        data.to === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error('OpenOcean returned invalid target address');
      }

      const minReceived = (BigInt(data.outAmount) * 985n) / 1000n; // 1.5% slippage

      return {
        aggregator: 'OpenOcean',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.outAmount || '0',
        minimumReceived: minReceived.toString(),
        to: data.to || '0x0000000000000000000000000000000000000000',
        data: data.data || '0x',
        value: data.value || '0',
        gas: data.estimatedGas || '300000',
        gasPrice: data.gasPrice || '1000000000',
        priceImpact: data.priceImpact || '0',
        success: true,
      };
    } catch (error) {
      console.error('OpenOcean swap data failed:', error);
      return this.createErrorSwap(
        'OpenOcean',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get executable swap data from 1inch
   */
  private async get1inchSwapData(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
  ): Promise<ExecutableSwapData> {
    try {
      const params = new URLSearchParams({
        fromTokenAddress: sellToken,
        toTokenAddress: buyToken,
        amount: sellAmount,
        fromAddress: userAddress,
        slippage: this.SLIPPAGE,
        disableEstimate: 'false',
      });

      const response = await this.fetchWithTimeout(
        `https://api.1inch.dev/swap/v6.0/${this.BASE_CHAIN_ID}/swap?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer demo', // Demo key for testing
          },
        },
      );

      if (!response.ok) {
        throw new Error(`1inch swap API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.tx || !data.tx.data || data.tx.data === '0x') {
        throw new Error('1inch returned no executable transaction data');
      }

      if (!data.toTokenAmount || data.toTokenAmount === '0') {
        throw new Error('1inch returned zero output amount');
      }

      if (
        !data.tx.to ||
        data.tx.to === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error('1inch returned invalid target address');
      }

      const minReceived = (BigInt(data.toTokenAmount) * 985n) / 1000n; // 1.5% slippage

      return {
        aggregator: '1inch',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.toTokenAmount || '0',
        minimumReceived: minReceived.toString(),
        to: data.tx.to || '0x0000000000000000000000000000000000000000',
        data: data.tx.data || '0x',
        value: data.tx.value || '0',
        gas: data.tx.gas || '300000',
        gasPrice: data.tx.gasPrice || '1000000000',
        priceImpact: '0', // 1inch doesn't provide this
        success: true,
      };
    } catch (error) {
      console.error('1inch swap data failed:', error);
      return this.createErrorSwap(
        '1inch',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get executable swap data from Paraswap
   */
  private async getParaswapSwapData(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
  ): Promise<ExecutableSwapData> {
    try {
      // First get the price route
      const priceParams = new URLSearchParams({
        srcToken: sellToken,
        destToken: buyToken,
        srcAmount: sellAmount,
        userAddress,
        side: 'SELL',
        network: this.BASE_CHAIN_ID.toString(),
      });

      const priceResponse = await this.fetchWithTimeout(
        `https://apiv5.paraswap.io/prices/?${priceParams}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!priceResponse.ok) {
        throw new Error(`Paraswap price API error: ${priceResponse.status}`);
      }

      const priceData = await priceResponse.json();

      if (!priceData.priceRoute) {
        throw new Error('Paraswap returned no price route');
      }

      // Then get the transaction data
      const txResponse = await this.fetchWithTimeout(
        'https://apiv5.paraswap.io/transactions/8453',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srcToken: sellToken,
            destToken: buyToken,
            srcAmount: sellAmount,
            destAmount: priceData.priceRoute.destAmount,
            userAddress,
            priceRoute: priceData.priceRoute,
            slippage: Number(this.SLIPPAGE) * 100, // Paraswap expects basis points
          }),
        },
      );

      if (!txResponse.ok) {
        throw new Error(`Paraswap transaction API error: ${txResponse.status}`);
      }

      const txData = await txResponse.json();

      if (!txData.data || txData.data === '0x') {
        throw new Error('Paraswap returned no executable transaction data');
      }

      if (
        !priceData.priceRoute.destAmount ||
        priceData.priceRoute.destAmount === '0'
      ) {
        throw new Error('Paraswap returned zero output amount');
      }

      if (
        !txData.to ||
        txData.to === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error('Paraswap returned invalid target address');
      }

      const minReceived =
        (BigInt(priceData.priceRoute.destAmount) * 985n) / 1000n;

      return {
        aggregator: 'Paraswap',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: priceData.priceRoute.destAmount || '0',
        minimumReceived: minReceived.toString(),
        to: txData.to || '0x0000000000000000000000000000000000000000',
        data: txData.data || '0x',
        value: txData.value || '0',
        gas: txData.gas || '300000',
        gasPrice: txData.gasPrice || '1000000000',
        priceImpact: '0', // Paraswap doesn't provide this directly
        success: true,
      };
    } catch (error) {
      console.error('Paraswap swap data failed:', error);
      return this.createErrorSwap(
        'Paraswap',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get the best swap for SPX6900 DCA execution
   */
  async getBestSPXSwap(
    usdcAmount: string,
    userAddress: Address,
  ): Promise<SwapExecutionResult> {
    return this.getBestExecutableSwap(
      TOKENS.USDC,
      TOKENS.SPX6900,
      usdcAmount,
      userAddress,
    );
  }

  /**
   * Validate swap data before execution
   */
  validateSwapData(swapData: ExecutableSwapData): {
    valid: boolean;
    error?: string;
  } {
    if (!swapData.success) {
      return {
        valid: false,
        error: swapData.error || 'Swap data indicates failure',
      };
    }

    if (
      !swapData.to ||
      swapData.to === '0x0000000000000000000000000000000000000000'
    ) {
      return { valid: false, error: 'Invalid target address' };
    }

    if (!swapData.data || swapData.data === '0x') {
      return { valid: false, error: 'No transaction data' };
    }

    if (swapData.buyAmount === '0') {
      return { valid: false, error: 'Zero output amount' };
    }

    const priceImpact = Number(swapData.priceImpact);
    if (priceImpact > 5) {
      // More than 5% price impact
      return { valid: false, error: `Price impact too high: ${priceImpact}%` };
    }

    return { valid: true };
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT,
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get available aggregators (not in circuit breaker open state)
   */
  private getAvailableAggregators(): string[] {
    const allAggregators = ['OpenOcean', '1inch', 'Paraswap'];
    const now = Date.now();

    return allAggregators.filter((aggregator) => {
      const breaker = this.circuitBreakers.get(aggregator);
      if (!breaker) return true;

      if (breaker.isOpen) {
        if (now - breaker.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
          this.resetCircuitBreaker(aggregator);
          return true;
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Record aggregator failure for circuit breaker
   */
  private recordFailure(aggregator: string): void {
    const breaker = this.circuitBreakers.get(aggregator) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    breaker.failures += 1;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      console.warn(
        `🚨 Execution circuit breaker OPENED for ${aggregator} (${breaker.failures} failures)`,
      );
    }

    this.circuitBreakers.set(aggregator, breaker);
  }

  /**
   * Record aggregator success for circuit breaker
   */
  private recordSuccess(aggregator: string): void {
    const breaker = this.circuitBreakers.get(aggregator);
    if (breaker && breaker.failures > 0) {
      breaker.failures = Math.max(0, breaker.failures - 1);
      if (breaker.failures === 0 && breaker.isOpen) {
        this.resetCircuitBreaker(aggregator);
      }
      this.circuitBreakers.set(aggregator, breaker);
    }
  }

  /**
   * Reset circuit breaker for aggregator
   */
  private resetCircuitBreaker(aggregator: string): void {
    console.log(`✅ Execution circuit breaker RESET for ${aggregator}`);
    this.circuitBreakers.set(aggregator, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    });
  }

  /**
   * Emergency fallback using direct OpenOcean API call
   */
  private async getEmergencyFallbackSwap(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress: Address,
  ): Promise<ExecutableSwapData | null> {
    try {
      console.log('🚨 Attempting emergency fallback to OpenOcean API...');

      // Use OpenOcean API directly instead of local endpoint
      const params = new URLSearchParams({
        chain: this.BASE_CHAIN_ID.toString(),
        inTokenAddress: sellToken,
        outTokenAddress: buyToken,
        amountDecimals: sellAmount,
        account: userAddress,
        slippage: '5.0', // 5% slippage for emergency
        gasPrice: '2000000000', // Higher gas price for emergency
      });

      const response = await fetch(
        `https://open-api.openocean.finance/v4/${this.BASE_CHAIN_ID}/swap_quote?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FlipTheStockMarket/1.0',
          },
        },
      );

      if (!response.ok)
        throw new Error(`Emergency API failed: ${response.status}`);

      const data = await response.json();

      if (!data.data || !data.to || !data.outAmount) {
        throw new Error('Emergency API returned incomplete data');
      }

      const minReceived = (BigInt(data.outAmount) * 95n) / 100n; // 5% slippage

      return {
        aggregator: 'OpenOcean-Emergency',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.outAmount,
        minimumReceived: minReceived.toString(),
        to: data.to,
        data: data.data,
        value: data.value || '0',
        gas: data.estimatedGas || '400000', // Higher gas for emergency
        gasPrice: '2000000000', // Higher gas price for emergency
        priceImpact: '5.0', // High impact warning
        success: true,
      };
    } catch (error) {
      console.error('❌ Emergency fallback failed:', error);
      return null;
    }
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    this.circuitBreakers.forEach((breaker, aggregator) => {
      status[aggregator] = {
        isOpen: breaker.isOpen,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure
          ? new Date(breaker.lastFailure).toISOString()
          : null,
      };
    });
    return status;
  }

  /**
   * Create error swap data
   */
  private createErrorSwap(
    aggregator: string,
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    error: any,
  ): ExecutableSwapData {
    return {
      aggregator,
      sellToken,
      buyToken,
      sellAmount,
      buyAmount: '0',
      minimumReceived: '0',
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: '0',
      gas: '0',
      gasPrice: '0',
      priceImpact: '0',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export singleton instance
export const aggregatorExecutionService = new AggregatorExecutionService();
