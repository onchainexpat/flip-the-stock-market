import type { Address } from 'viem';
import { NEXT_PUBLIC_URL } from '../config';
import { multiAggregatorService } from '../services/multiAggregatorService';

export interface SwapQuote {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  buyAmount: string;
  buyTokenToEthRate: string;
  sellTokenToEthRate: string;
  allowanceTarget: Address;
  price: string;
  estimatedPriceImpact: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
  gas: string;
  gasPrice: string;
  grossBuyAmount: string;
  grossSellAmount: string;
  protocolFee: string;
  minimumProtocolFee: string;
  expectedSlippage: string;
}

export interface SwapTransaction {
  to: Address;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
}

export interface SwapParams {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  takerAddress: Address;
  slippagePercentage?: number;
  skipValidation?: boolean;
}

// Platform fee configuration
export const PLATFORM_FEE_PERCENTAGE = 0; // 0% - No platform fee for now
export const PLATFORM_FEE_RECIPIENT =
  '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7' as Address; // Platform fee collection address (unused when fee is 0)

// Common token addresses on Base
export const TOKENS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address,
  WETH: '0x4200000000000000000000000000000000000006' as Address,
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as Address,
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address,
};

export class OpenOceanApi {
  // Get price quote from OpenOcean
  async getPrice(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    takerAddress?: Address,
  ): Promise<{
    price: string;
    estimatedPriceImpact: string;
    buyAmount: string;
    route?: any;
  }> {
    try {
      const params = new URLSearchParams({
        chain: '8453', // Base chain ID
        inTokenAddress: sellToken,
        outTokenAddress: buyToken,
        amountDecimals: sellAmount, // Amount in wei
        account: takerAddress || '0x1111111111111111111111111111111111111111',
        slippage: '0.015', // 1.5% default slippage
        gasPriceDecimals: '1000000000', // 1 GWEI in wei
      });

      const url = `https://open-api.openocean.finance/v4/8453/quote?${params}`;
      console.log('🌊 OpenOcean Price Request:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          DNT: '1',
          Origin: 'https://app.openocean.finance',
          Pragma: 'no-cache',
          Referer: 'https://app.openocean.finance/',
          'Sec-CH-UA':
            '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
          'Sec-CH-UA-Mobile': '?0',
          'Sec-CH-UA-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenOcean Price API Error:', error);
        throw new Error(
          `OpenOcean API request failed: ${response.status} ${error}`,
        );
      }

      const data = await response.json();
      console.log('🌊 OpenOcean Price Response:', data);

      if (data.code !== 200 || !data.data) {
        throw new Error(
          `OpenOcean API error: ${data.error || data.message || 'Unknown error'}`,
        );
      }

      const quoteData = data.data;

      // Calculate price (output/input ratio)
      const inputDecimals = quoteData.inToken?.decimals || 6;
      const outputDecimals = quoteData.outToken?.decimals || 8;

      const humanInputAmount = Number(quoteData.inAmount) / 10 ** inputDecimals;
      const humanOutputAmount =
        Number(quoteData.outAmount) / 10 ** outputDecimals;
      const price = (humanOutputAmount / humanInputAmount).toString();

      // Use OpenOcean's price impact if available, otherwise calculate
      let priceImpact = quoteData.price_impact || '0';

      // OpenOcean returns price impact as a decimal (e.g., 0.015 for 1.5%)
      // Convert to percentage string
      if (typeof priceImpact === 'number') {
        priceImpact = (priceImpact * 100).toFixed(2);
      } else if (
        typeof priceImpact === 'string' &&
        !priceImpact.includes('.')
      ) {
        // If it's already a percentage string, use as is
        priceImpact = Number(priceImpact).toFixed(2);
      } else {
        // Convert decimal string to percentage
        priceImpact = (Number(priceImpact) * 100).toFixed(2);
      }

      return {
        price,
        estimatedPriceImpact: priceImpact,
        buyAmount: quoteData.outAmount,
        route: {
          protocol: 'OpenOcean',
          source: 'OpenOcean V4',
          sources: quoteData.path
            ? [{ name: 'OpenOcean Aggregated DEXs', proportion: '1' }]
            : [],
        },
      };
    } catch (error) {
      console.error('Failed to get OpenOcean price:', error);
      throw error;
    }
  }

  // Get swap transaction from OpenOcean
  async getSwapTransaction(params: SwapParams): Promise<SwapTransaction> {
    try {
      const response = await fetch(`${NEXT_PUBLIC_URL}/api/openocean-swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellToken: params.sellToken,
          buyToken: params.buyToken,
          sellAmount: params.sellAmount,
          takerAddress: params.takerAddress,
          slippagePercentage: params.slippagePercentage || 0.015,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get swap transaction');
      }

      const data = await response.json();

      return {
        to: data.to,
        data: data.data,
        value: data.value || '0',
        gas: data.gas || data.estimatedGas?.toString() || '300000',
        gasPrice: '1000000000', // 1 GWEI
      };
    } catch (error) {
      console.error('Failed to get OpenOcean swap transaction:', error);
      throw error;
    }
  }

  // Get quote (price + transaction data)
  async getQuote(params: SwapParams): Promise<SwapQuote> {
    // First get price data
    const priceData = await this.getPrice(
      params.sellToken,
      params.buyToken,
      params.sellAmount,
      params.takerAddress,
    );

    // Then get transaction data
    const txData = await this.getSwapTransaction(params);

    // Combine into quote format compatible with existing code
    return {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      buyAmount: priceData.buyAmount,
      buyTokenToEthRate: '0', // Not provided by OpenOcean
      sellTokenToEthRate: '0', // Not provided by OpenOcean
      allowanceTarget: txData.to as Address,
      price: priceData.price,
      estimatedPriceImpact: priceData.estimatedPriceImpact,
      sources: priceData.route?.sources || [],
      gas: txData.gas,
      gasPrice: txData.gasPrice,
      grossBuyAmount: priceData.buyAmount,
      grossSellAmount: params.sellAmount,
      protocolFee: '0',
      minimumProtocolFee: '0',
      expectedSlippage: (params.slippagePercentage || 0.01).toString(),
    };
  }

  // Get current SPX6900 price in USDC using multi-aggregator (best rates)
  async getSPX6900Price(): Promise<{
    price: number;
    priceImpact: number;
    bestAggregator?: string;
    savings?: string;
  }> {
    try {
      console.log('🔍 Fetching SPX6900 price from multiple aggregators...');

      // Use multi-aggregator service for best rates
      const result = await multiAggregatorService.getSPX6900Price();

      const price = Number.parseFloat(result.price);

      console.log(
        `✅ Best SPX6900 Price: $${price} (via ${result.bestAggregator})`,
      );
      console.log('📊 All aggregator prices:', result.allPrices);

      return {
        price,
        priceImpact: 0.5, // Default low impact for price display
        bestAggregator: result.bestAggregator,
        savings:
          result.allPrices.length > 1
            ? 'Multi-aggregator comparison'
            : undefined,
      };
    } catch (error) {
      console.error(
        'Multi-aggregator price fetch failed, falling back to OpenOcean only:',
        error,
      );

      // Fallback to OpenOcean only
      try {
        const sellAmount = '1000000'; // 1 USDC (6 decimals)
        const result = await this.getPrice(
          TOKENS.USDC,
          TOKENS.SPX6900,
          sellAmount,
        );

        // Convert the result to SPX6900 price in USD
        const spxPrice = 1 / Number.parseFloat(result.price);

        console.log(`✅ SPX6900 Price (OpenOcean only): $${spxPrice}`);

        return {
          price: spxPrice,
          priceImpact: Number.parseFloat(result.estimatedPriceImpact),
        };
      } catch (openOceanError) {
        console.error(
          'OpenOcean fallback failed, trying CoinGecko:',
          openOceanError,
        );

        // Final fallback to CoinGecko API
        try {
          const response = await fetch(`${NEXT_PUBLIC_URL}/api/coingecko`);
          if (!response.ok) {
            throw new Error(`CoinGecko API failed: ${response.status}`);
          }

          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          if (!data.spx6900?.usd) {
            throw new Error('Invalid CoinGecko response format');
          }

          return {
            price: data.spx6900.usd,
            priceImpact: 0, // CoinGecko doesn't provide price impact
          };
        } catch (fallbackError) {
          console.error('All price sources failed:', fallbackError);
          throw new Error(
            'Failed to fetch SPX6900 price from all sources (Multi-aggregator, OpenOcean, CoinGecko)',
          );
        }
      }
    }
  }

  // Get SPX6900 price with detailed comparison (for advanced users)
  async getSPX6900PriceDetailed(): Promise<{
    bestPrice: number;
    bestAggregator: string;
    allPrices: Array<{
      aggregator: string;
      price: string;
      buyAmount: string;
      responseTime?: number;
    }>;
    savings: {
      amount: string;
      percentage: string;
    };
  }> {
    try {
      const result = await multiAggregatorService.getBestSwapQuote(
        TOKENS.USDC,
        TOKENS.SPX6900,
        '1000000', // 1 USDC
      );

      const bestPrice = Number.parseFloat(result.bestQuote.price);

      return {
        bestPrice,
        bestAggregator: result.bestQuote.aggregator,
        allPrices: result.allQuotes.map((quote) => ({
          aggregator: quote.aggregator,
          price: quote.price,
          buyAmount: quote.buyAmount,
          responseTime: quote.responseTime,
        })),
        savings: {
          amount: result.savingsVsWorst.amount,
          percentage: result.savingsVsWorst.percentage,
        },
      };
    } catch (error) {
      console.error('Failed to get detailed price comparison:', error);
      throw error;
    }
  }

  // Calculate platform fee
  calculatePlatformFee(amount: bigint): {
    feeAmount: bigint;
    netAmount: bigint;
  } {
    const feeAmount =
      (amount * BigInt(Math.floor(PLATFORM_FEE_PERCENTAGE * 100))) /
      BigInt(10000);
    const netAmount = amount - feeAmount;
    return { feeAmount, netAmount };
  }

  // Calculate price impact for a given trade size
  async calculatePriceImpact(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
  ): Promise<{ priceImpact: number; effectivePrice: number }> {
    try {
      const result = await this.getPrice(sellToken, buyToken, sellAmount);
      return {
        priceImpact: Number.parseFloat(result.estimatedPriceImpact),
        effectivePrice: Number.parseFloat(result.price),
      };
    } catch (error) {
      console.warn(
        'Failed to calculate price impact from OpenOcean, using fallback:',
        error,
      );
      // Fallback: estimate based on trade size
      const sellAmountUSD = Number(sellAmount) / 1e6; // USDC has 6 decimals
      let estimatedImpact = 0.3; // Default low impact

      if (sellAmountUSD > 10000) {
        estimatedImpact = 5.0;
      } else if (sellAmountUSD > 5000) {
        estimatedImpact = 3.0;
      } else if (sellAmountUSD > 1000) {
        estimatedImpact = 1.5;
      } else if (sellAmountUSD > 100) {
        estimatedImpact = 0.8;
      }

      return {
        priceImpact: estimatedImpact,
        effectivePrice: 0, // Will be populated from CoinGecko
      };
    }
  }

  // Get quote with platform fee included
  async getQuoteWithFees(params: SwapParams): Promise<
    SwapQuote & {
      platformFee: string;
      netSellAmount: string;
      feeRecipient: Address;
    }
  > {
    const sellAmountBigInt = BigInt(params.sellAmount);
    const { feeAmount, netAmount } =
      this.calculatePlatformFee(sellAmountBigInt);

    // Get quote for the net amount (after platform fee)
    const quote = await this.getQuote({
      ...params,
      sellAmount: netAmount.toString(),
    });

    return {
      ...quote,
      platformFee: feeAmount.toString(),
      netSellAmount: netAmount.toString(),
      feeRecipient: PLATFORM_FEE_RECIPIENT as Address,
    };
  }

  // Calculate DCA order size and slippage
  async calculateDCAOrder(
    totalAmount: string, // Total USDC amount
    numberOfOrders: number,
    fromToken: Address = TOKENS.USDC,
    toToken: Address = TOKENS.SPX6900,
  ): Promise<{
    orderSize: string;
    estimatedTokensPerOrder: string;
    totalEstimatedTokens: string;
    averagePriceImpact: number;
  }> {
    const orderSize = (BigInt(totalAmount) / BigInt(numberOfOrders)).toString();

    try {
      const quote = await this.getPrice(fromToken, toToken, orderSize);
      const tokensPerOrder = quote.buyAmount; // OpenOcean already returns the output amount
      const totalEstimatedTokens = (
        BigInt(tokensPerOrder) * BigInt(numberOfOrders)
      ).toString();

      return {
        orderSize,
        estimatedTokensPerOrder: tokensPerOrder,
        totalEstimatedTokens,
        averagePriceImpact: Number.parseFloat(quote.estimatedPriceImpact),
      };
    } catch (error) {
      console.error('Failed to calculate DCA order:', error);
      throw error;
    }
  }
}

// Create a default instance
export const openOceanApi = new OpenOceanApi();

// Helper function to format token amounts
export function formatTokenAmount(amount: string, decimals = 18): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;

  if (remainder === BigInt(0)) {
    return quotient.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');

  if (trimmedRemainder === '') {
    return quotient.toString();
  }

  return `${quotient}.${trimmedRemainder}`;
}

// Helper function to parse token amounts
export function parseTokenAmount(amount: string, decimals = 18): string {
  const [whole, fractional = ''] = amount.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFractional).toString();
}
