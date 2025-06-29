import type { Address } from 'viem';
import { NEXT_PUBLIC_0X_API_KEY } from '../config';

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

const BASE_0X_API_URL = 'https://api.0x.org';
const BASE_CHAIN_ID = '8453'; // Base chain ID

// Platform fee configuration
export const PLATFORM_FEE_PERCENTAGE = 0.1; // 0.1%
export const PLATFORM_FEE_RECIPIENT =
  '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7' as Address; // Platform fee collection address

// Common token addresses on Base
export const TOKENS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address,
  WETH: '0x4200000000000000000000000000000000000006' as Address,
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as Address,
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address,
};

export class ZeroXApi {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, params: Record<string, string>) {
    // Use our backend proxy instead of calling 0x API directly to avoid CORS issues
    const proxyUrl = new URL('/api/0x-price', window.location.origin);

    // Add query parameters (excluding chainId since it's handled by the proxy)
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'chainId') {
        proxyUrl.searchParams.append(key, value);
      }
    });

    console.log('0x API Request (via proxy):', proxyUrl.toString());

    const response = await fetch(proxyUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('0x API Proxy Error:', error);
      throw new Error(
        `0x API proxy request failed: ${response.status} ${error}`,
      );
    }

    const data = await response.json();
    console.log('0x API Response (via proxy):', data);

    return data;
  }

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    const queryParams = {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      taker: params.takerAddress,
      slippagePercentage: params.slippagePercentage?.toString() || '0.01', // 1% default
      skipValidation: params.skipValidation?.toString() || 'false',
    };

    return this.request('/swap/permit2/quote', queryParams);
  }

  async getSwapTransaction(params: SwapParams): Promise<SwapTransaction> {
    const queryParams = {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      taker: params.takerAddress,
      slippagePercentage: params.slippagePercentage?.toString() || '0.01', // 1% default
      skipValidation: params.skipValidation?.toString() || 'false',
    };

    return this.request('/swap/permit2/quote', queryParams);
  }

  async getPrice(
    sellToken: Address,
    buyToken: Address,
    sellAmount: string,
    takerAddress?: Address,
  ): Promise<{ price: string; estimatedPriceImpact: string }> {
    const queryParams = {
      sellToken,
      buyToken,
      sellAmount,
      // Use provided taker or a valid dummy address for price queries
      taker: takerAddress || '0x1111111111111111111111111111111111111111',
    };

    const data = await this.request('', queryParams); // Empty endpoint since proxy handles the path

    // The proxy already calculates price and priceImpact for us
    return {
      price: data.price,
      estimatedPriceImpact: data.estimatedPriceImpact,
    };
  }

  // Get current SPX6900 price in USDC
  async getSPX6900Price(): Promise<{ price: number; priceImpact: number }> {
    try {
      // Try 0x API first for real-time DEX pricing
      // Sell 1 USDC to get SPX6900, then calculate price per SPX6900
      const sellAmount = '1000000'; // 1 USDC (6 decimals)
      const result = await this.getPrice(
        TOKENS.USDC,
        TOKENS.SPX6900,
        sellAmount,
      );

      // Convert the result to SPX6900 price in USD
      // price returned is SPX6900_amount / USDC_amount, we want USDC / SPX6900
      const spxPrice = 1 / Number.parseFloat(result.price);

      return {
        price: spxPrice,
        priceImpact: Number.parseFloat(result.estimatedPriceImpact), // Already in percentage
      };
    } catch (error) {
      console.error(
        'Failed to get SPX6900 price from 0x, trying CoinGecko fallback:',
        error,
      );

      // Fallback to CoinGecko API
      try {
        const response = await fetch('/api/coingecko');
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
        console.error('CoinGecko fallback also failed:', fallbackError);
        throw new Error(
          'Failed to fetch SPX6900 price from both 0x and CoinGecko',
        );
      }
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
        priceImpact: Number.parseFloat(result.estimatedPriceImpact), // Already in percentage from backend
        effectivePrice: Number.parseFloat(result.price),
      };
    } catch (error) {
      console.warn(
        'Failed to calculate price impact from 0x, using fallback:',
        error,
      );
      // Fallback: estimate 0.5% price impact for mid-sized trades
      return {
        priceImpact: 0.5,
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
      const tokensPerOrder = (
        (BigInt(orderSize) *
          BigInt(Math.floor(Number.parseFloat(quote.price) * 1e18))) /
        BigInt(1e18)
      ).toString();
      const totalEstimatedTokens = (
        BigInt(tokensPerOrder) * BigInt(numberOfOrders)
      ).toString();

      return {
        orderSize,
        estimatedTokensPerOrder: tokensPerOrder,
        totalEstimatedTokens,
        averagePriceImpact: Number.parseFloat(quote.estimatedPriceImpact) * 100,
      };
    } catch (error) {
      console.error('Failed to calculate DCA order:', error);
      throw error;
    }
  }
}

// Create a default instance
export const zeroXApi = new ZeroXApi(NEXT_PUBLIC_0X_API_KEY);

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
