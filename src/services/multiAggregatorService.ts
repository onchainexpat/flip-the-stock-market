import type { Address } from 'viem';
import { TOKENS } from '../utils/openOceanApi';

export interface SwapQuote {
  aggregator: string;
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  buyAmount: string;
  price: string;
  estimatedPriceImpact: string;
  to: Address;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  protocolFee?: string;
  sources?: Array<{
    name: string;
    proportion: string;
  }>;
  success: boolean;
  error?: string;
  responseTime?: number;
}

export interface BestQuoteResult {
  bestQuote: SwapQuote;
  allQuotes: SwapQuote[];
  savingsVsWorst: {
    amount: string;
    percentage: string;
  };
  metadata: {
    quotesReceived: number;
    averageResponseTime: number;
    fastestAggregator: string;
    bestAggregator: string;
  };
}

/**
 * Multi-aggregator service for finding the best swap rates
 * Compares quotes from OpenOcean, 1inch, and Paraswap
 * Features comprehensive error handling and fallback mechanisms
 */
export class MultiAggregatorService {
  private readonly BASE_CHAIN_ID = 8453;
  private readonly REQUEST_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_RETRIES = 2;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes

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
   * Get quotes from all supported aggregators with error handling and fallbacks
   */
  async getBestSwapQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
  ): Promise<BestQuoteResult> {
    const startTime = Date.now();

    console.log('🔍 Starting multi-aggregator quote comparison...');
    console.log(`   Amount: ${sellAmount}`);
    console.log(`   From: ${sellToken} → To: ${buyToken}`);

    // Check circuit breakers before making calls
    const availableAggregators = this.getAvailableAggregators();
    console.log(`   Available aggregators: ${availableAggregators.join(', ')}`);

    if (availableAggregators.length === 0) {
      throw new Error(
        'All aggregators are currently unavailable due to circuit breaker protection',
      );
    }

    // Run aggregator calls with retry logic
    const quotePromises = [];

    if (availableAggregators.includes('OpenOcean')) {
      quotePromises.push(
        this.getQuoteWithRetry(
          'OpenOcean',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }
    if (availableAggregators.includes('1inch')) {
      quotePromises.push(
        this.getQuoteWithRetry(
          '1inch',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }
    if (availableAggregators.includes('Paraswap')) {
      quotePromises.push(
        this.getQuoteWithRetry(
          'Paraswap',
          sellToken,
          buyToken,
          sellAmount,
          userAddress,
        ),
      );
    }

    const results = await Promise.allSettled(quotePromises);

    // Extract successful quotes and update circuit breakers
    const quotes: SwapQuote[] = [];

    results.forEach((result, index) => {
      const aggregatorName = availableAggregators[index];

      if (result.status === 'fulfilled' && result.value.success) {
        quotes.push(result.value);
        this.recordSuccess(aggregatorName);
        console.log(
          `✅ ${aggregatorName}: Success (${result.value.responseTime}ms)`,
        );
      } else {
        const error =
          result.status === 'rejected' ? result.reason : result.value.error;
        this.recordFailure(aggregatorName);
        console.warn(`❌ ${aggregatorName}: Failed - ${error}`);
      }
    });

    if (quotes.length === 0) {
      const fallbackQuote = await this.getFallbackQuote(
        sellToken,
        buyToken,
        sellAmount,
        userAddress,
      );
      if (fallbackQuote) {
        quotes.push(fallbackQuote);
        console.log('🔄 Using fallback quote mechanism');
      } else {
        throw new Error('All aggregators failed and no fallback available');
      }
    }

    // Find the best quote (highest buyAmount)
    const bestQuote = quotes.reduce((best, current) => {
      const bestAmount = BigInt(best.buyAmount);
      const currentAmount = BigInt(current.buyAmount);
      return currentAmount > bestAmount ? current : best;
    });

    // Calculate savings vs worst quote
    const worstQuote = quotes.reduce((worst, current) => {
      const worstAmount = BigInt(worst.buyAmount);
      const currentAmount = BigInt(current.buyAmount);
      return currentAmount < worstAmount ? current : worst;
    });

    const savingsAmount =
      BigInt(bestQuote.buyAmount) - BigInt(worstQuote.buyAmount);
    const savingsPercentage =
      Number((savingsAmount * 100n) / BigInt(worstQuote.buyAmount)) / 100;

    // Calculate metadata
    const responseTimes = quotes.map((q) => q.responseTime || 0);
    const averageResponseTime =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const fastestAggregator = quotes.reduce((fastest, current) =>
      (current.responseTime || Number.POSITIVE_INFINITY) <
      (fastest.responseTime || Number.POSITIVE_INFINITY)
        ? current
        : fastest,
    ).aggregator;

    const totalTime = Date.now() - startTime;
    console.log(
      `🏆 Best quote: ${bestQuote.aggregator} - ${bestQuote.buyAmount} tokens`,
    );
    console.log(
      `💰 Savings: ${savingsAmount.toString()} tokens (${savingsPercentage.toFixed(4)}%)`,
    );
    console.log(`⏱️  Total comparison time: ${totalTime}ms`);

    return {
      bestQuote,
      allQuotes: quotes,
      savingsVsWorst: {
        amount: savingsAmount.toString(),
        percentage: savingsPercentage.toFixed(4),
      },
      metadata: {
        quotesReceived: quotes.length,
        averageResponseTime: Math.round(averageResponseTime),
        fastestAggregator,
        bestAggregator: bestQuote.aggregator,
      },
    };
  }

  /**
   * Get quote with retry logic
   */
  private async getQuoteWithRetry(
    aggregator: string,
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
    retryCount = 0,
  ): Promise<SwapQuote> {
    try {
      switch (aggregator) {
        case 'OpenOcean':
          return await this.getOpenOceanQuote(
            sellToken,
            buyToken,
            sellAmount,
            userAddress,
          );
        case '1inch':
          return await this.get1inchQuote(
            sellToken,
            buyToken,
            sellAmount,
            userAddress,
          );
        case 'Paraswap':
          return await this.getParaswapQuote(
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
          `🔄 Retrying ${aggregator} (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.getQuoteWithRetry(
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
   * Get quote from OpenOcean
   */
  private async getOpenOceanQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
  ): Promise<SwapQuote> {
    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        chain: this.BASE_CHAIN_ID.toString(),
        inTokenAddress: sellToken,
        outTokenAddress: buyToken,
        amountDecimals: sellAmount,
        account: userAddress || '0x1111111111111111111111111111111111111111',
        slippage: '1.5',
        gasPrice: '1000000000',
      });

      const response = await this.fetchWithTimeout(
        `https://open-api.openocean.finance/v4/${this.BASE_CHAIN_ID}/quote?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FlipTheStockMarket/1.0',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`OpenOcean API error: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Validate response data
      if (!data.outAmount || data.outAmount === '0') {
        throw new Error('OpenOcean returned zero output amount');
      }

      return {
        aggregator: 'OpenOcean',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.outAmount,
        price: data.resPricePerToToken || '0',
        estimatedPriceImpact: data.priceImpact || '0',
        to: data.to || '0x0000000000000000000000000000000000000000',
        data: data.data || '0x',
        value: data.value || '0',
        gas: data.estimatedGas || '200000',
        gasPrice: data.gasPrice || '1000000000',
        sources: data.dexes || [],
        success: true,
        responseTime,
      };
    } catch (error) {
      console.error('OpenOcean quote failed:', error);
      return this.createErrorQuote(
        'OpenOcean',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get quote from 1inch
   */
  private async get1inchQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
  ): Promise<SwapQuote> {
    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        fromTokenAddress: sellToken,
        toTokenAddress: buyToken,
        amount: sellAmount,
        fromAddress:
          userAddress || '0x1111111111111111111111111111111111111111',
        slippage: '1.5',
      });

      const response = await this.fetchWithTimeout(
        `https://api.1inch.dev/swap/v6.0/${this.BASE_CHAIN_ID}/quote?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer demo', // Demo key for testing
          },
        },
      );

      if (!response.ok) {
        throw new Error(`1inch API error: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Validate response data
      if (!data.toTokenAmount || data.toTokenAmount === '0') {
        throw new Error('1inch returned zero output amount');
      }

      return {
        aggregator: '1inch',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.toTokenAmount,
        price:
          data.toTokenAmount && data.fromTokenAmount
            ? (
                (BigInt(data.toTokenAmount) * BigInt('1000000000000000000')) /
                BigInt(data.fromTokenAmount)
              ).toString()
            : '0',
        estimatedPriceImpact: '0', // 1inch doesn't provide this in quote
        to: '0x0000000000000000000000000000000000000000', // Quote doesn't include transaction data
        data: '0x',
        value: '0',
        gas: data.estimatedGas || '200000',
        gasPrice: '1000000000',
        sources: data.protocols || [],
        success: true,
        responseTime,
      };
    } catch (error) {
      console.error('1inch quote failed:', error);
      return this.createErrorQuote(
        '1inch',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get quote from Paraswap
   */
  private async getParaswapQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
  ): Promise<SwapQuote> {
    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        srcToken: sellToken,
        destToken: buyToken,
        srcAmount: sellAmount,
        userAddress:
          userAddress || '0x1111111111111111111111111111111111111111',
        side: 'SELL',
        network: this.BASE_CHAIN_ID.toString(),
        excludeDEXS: 'ParaSwapPool,ParaSwapLimitOrders', // Exclude problematic DEXs
      });

      const response = await this.fetchWithTimeout(
        `https://apiv5.paraswap.io/prices/?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Paraswap API error: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Validate response data
      if (!data.priceRoute?.destAmount || data.priceRoute.destAmount === '0') {
        throw new Error('Paraswap returned zero output amount');
      }

      return {
        aggregator: 'Paraswap',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: data.priceRoute.destAmount,
        price: data.priceRoute?.destUSD || '0',
        estimatedPriceImpact: '0', // Paraswap doesn't provide this in quote
        to: '0x0000000000000000000000000000000000000000', // Quote doesn't include transaction data
        data: '0x',
        value: '0',
        gas: data.priceRoute?.gasCost || '200000',
        gasPrice: '1000000000',
        sources: data.priceRoute?.bestRoute || [],
        success: true,
        responseTime,
      };
    } catch (error) {
      console.error('Paraswap quote failed:', error);
      return this.createErrorQuote(
        'Paraswap',
        sellToken,
        buyToken,
        sellAmount,
        error,
      );
    }
  }

  /**
   * Get SPX6900 price in USDC using multi-aggregator
   */
  async getSPX6900Price(): Promise<{
    price: string;
    bestAggregator: string;
    allPrices: any[];
  }> {
    try {
      const result = await this.getBestSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        '1000000', // 1 USDC
      );

      const allPrices = result.allQuotes.map((quote) => ({
        aggregator: quote.aggregator,
        price: quote.price,
        buyAmount: quote.buyAmount,
        responseTime: quote.responseTime,
      }));

      return {
        price: result.bestQuote.price,
        bestAggregator: result.bestQuote.aggregator,
        allPrices,
      };
    } catch (error) {
      console.error('Failed to get SPX6900 price:', error);
      throw error;
    }
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
   * Create error quote for failed aggregator
   */
  private createErrorQuote(
    aggregator: string,
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    error: any,
  ): SwapQuote {
    return {
      aggregator,
      sellToken,
      buyToken,
      sellAmount,
      buyAmount: '0',
      price: '0',
      estimatedPriceImpact: '0',
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: '0',
      gas: '0',
      gasPrice: '0',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
        // Check if enough time has passed to retry
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
        `🚨 Circuit breaker OPENED for ${aggregator} (${breaker.failures} failures)`,
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
      // Reset failure count on success
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
    console.log(`✅ Circuit breaker RESET for ${aggregator}`);
    this.circuitBreakers.set(aggregator, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    });
  }

  /**
   * Get fallback quote when all aggregators fail
   */
  private async getFallbackQuote(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    userAddress?: Address,
  ): Promise<SwapQuote | null> {
    try {
      console.log('🆘 Attempting fallback quote using CoinGecko price...');

      // Use CoinGecko API directly for price discovery as last resort
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=spx6900&vs_currencies=usd',
      );
      if (!response.ok) throw new Error('CoinGecko API failed');

      const data = await response.json();
      if (!data.spx6900?.usd) throw new Error('No SPX price available');

      // Calculate estimated output based on CoinGecko price
      const usdcAmount = Number(sellAmount) / 1e6; // USDC has 6 decimals
      const spxPrice = data.spx6900.usd;
      const estimatedSpxAmount = Math.floor((usdcAmount / spxPrice) * 1e8); // SPX has 8 decimals

      return {
        aggregator: 'CoinGecko-Fallback',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: estimatedSpxAmount.toString(),
        price: (1 / spxPrice).toString(),
        estimatedPriceImpact: '5.0', // High impact for fallback
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        value: '0',
        gas: '300000',
        gasPrice: '1000000000',
        success: true,
        responseTime: 0,
      };
    } catch (error) {
      console.error('❌ Fallback quote failed:', error);
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
   * Format quote for display
   */
  formatQuoteForDisplay(quote: SwapQuote): string {
    if (!quote.success) {
      return `${quote.aggregator}: Error - ${quote.error}`;
    }

    const buyAmountFormatted = (Number(quote.buyAmount) / 1e18).toFixed(6);
    const priceImpact = Number(quote.estimatedPriceImpact).toFixed(2);

    return `${quote.aggregator}: ${buyAmountFormatted} SPX (${priceImpact}% impact, ${quote.responseTime}ms)`;
  }
}

// Export singleton instance
export const multiAggregatorService = new MultiAggregatorService();
