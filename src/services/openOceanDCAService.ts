import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import axios from 'axios';
import type { ethers } from 'ethers';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const SPX6900_BASE = '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C';
const OPENOCEAN_API_BASE = 'https://open-api.openocean.finance';
const BASE_CHAIN_ID = 8453;

// OpenOcean DCA order statuses
export enum OpenOceanOrderStatus {
  UNFILLED = 1,
  CANCELLED = 3,
  FILLED = 4,
  PENDING = 5,
  HASH_NOT_EXIST = 6,
  EXPIRED = 7,
}

export interface OpenOceanDCAOrderParams {
  provider: ethers.BrowserProvider;
  usdcAmount: number; // Total USDC to spend
  intervalHours: number; // Hours between buys
  numberOfBuys: number; // Number of DCA executions
  minPrice?: string; // Optional minimum price
  maxPrice?: string; // Optional maximum price
}

export interface OpenOceanDCAOrder {
  orderHash: string;
  totalAmount: number;
  perExecution: number;
  intervals: number;
  chainId: number;
  status?: OpenOceanOrderStatus;
  createDateTime?: string;
  expireTime?: string;
  remainingMakerAmount?: string;
  have_filled?: number;
  orderData?: any;
}

export interface OpenOceanOrderResponse {
  code: number;
  data?: any;
  message?: string;
}

export class OpenOceanDCAService {
  async createSPXDCAOrder({
    provider,
    usdcAmount,
    intervalHours,
    numberOfBuys,
    minPrice,
    maxPrice,
  }: OpenOceanDCAOrderParams): Promise<OpenOceanDCAOrder> {
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Configure for DCA mode
    const walletParams = {
      provider,
      signer,
      account: address,
      chainId: BASE_CHAIN_ID,
      chainKey: 'base',
      mode: 'Dca', // Enable DCA mode
    };

    // Calculate per-execution amount
    const perExecutionUSDC = usdcAmount / numberOfBuys;
    const makerAmount = (perExecutionUSDC * 1e6).toString(); // USDC has 6 decimals

    // Generate order data with SDK
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      walletParams,
      {
        makerTokenAddress: USDC_BASE,
        makerTokenDecimals: 6,
        takerTokenAddress: SPX6900_BASE,
        takerTokenDecimals: 18,
        makerAmount: (usdcAmount * 1e6).toString(), // Total amount
        takerAmount: '1', // Let OpenOcean calculate
        gasPrice: await this.getGasPrice(provider),
        expire: this.calculateExpiry(intervalHours, numberOfBuys),
      },
    );

    // Create DCA order
    const dcaOrder = {
      ...orderData,
      expireTime: intervalHours * numberOfBuys * 3600, // seconds
      time: intervalHours * 3600, // interval in seconds
      times: numberOfBuys,
      version: 'v2',
      referrer: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7', // SPX fee address
      referrerFee: '1', // 1% platform fee
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
    };

    // Submit to OpenOcean
    const response = await axios.post(
      `${OPENOCEAN_API_BASE}/v1/${BASE_CHAIN_ID}/dca/swap`,
      dcaOrder,
      { headers: { 'Content-Type': 'application/json' } },
    );

    return {
      orderHash: orderData.orderHash,
      totalAmount: usdcAmount,
      perExecution: perExecutionUSDC,
      intervals: numberOfBuys,
      chainId: BASE_CHAIN_ID,
      orderData: orderData,
      ...response.data,
    };
  }

  /**
   * Cancel an existing OpenOcean DCA order
   */
  async cancelOrder(
    provider: ethers.BrowserProvider,
    orderHash: string,
    orderData?: any,
  ): Promise<OpenOceanOrderResponse> {
    try {
      // Try API cancellation first
      const response = await axios.post(
        `${OPENOCEAN_API_BASE}/v1/${BASE_CHAIN_ID}/dca/cancel`,
        { orderHash },
        { headers: { 'Content-Type': 'application/json' } },
      );

      // If API cancellation failed and we have order data, try on-chain cancellation
      if (
        response.data?.data?.status &&
        ![OpenOceanOrderStatus.CANCELLED, OpenOceanOrderStatus.FILLED].includes(
          response.data.data.status,
        )
      ) {
        if (orderData) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();

          const walletParams = {
            provider,
            signer,
            account: address,
            chainId: BASE_CHAIN_ID,
            chainKey: 'base',
            mode: 'Dca',
          };

          await openoceanLimitOrderSdk.cancelLimitOrder(walletParams, {
            orderData: orderData,
            gasPrice: await this.getGasPrice(provider),
          });
        }
      }

      return response.data;
    } catch (error) {
      console.error('Error cancelling OpenOcean DCA order:', error);
      throw error;
    }
  }

  /**
   * Get orders by wallet address
   */
  async getOrdersByAddress(
    address: string,
    page = 1,
    limit = 10,
    statuses: OpenOceanOrderStatus[] = [
      OpenOceanOrderStatus.UNFILLED,
      OpenOceanOrderStatus.PENDING,
    ],
  ): Promise<OpenOceanDCAOrder[]> {
    try {
      const statusesParam = statuses.join(',');
      const response = await axios.get(
        `${OPENOCEAN_API_BASE}/v1/${BASE_CHAIN_ID}/dca/address/${address}`,
        {
          params: {
            page,
            limit,
            statuses: `[${statusesParam}]`,
            sortBy: 'createDateTime',
          },
        },
      );

      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching OpenOcean DCA orders:', error);
      throw error;
    }
  }

  /**
   * Get a single order by hash
   */
  async getOrderByHash(orderHash: string): Promise<OpenOceanDCAOrder | null> {
    try {
      // OpenOcean doesn't have a direct single order endpoint, so we'll use the all orders endpoint
      const response = await axios.get(
        `${OPENOCEAN_API_BASE}/v1/${BASE_CHAIN_ID}/dca/all`,
        {
          params: {
            limit: 1,
            statuses: '[1,3,4,5,6,7]', // All statuses
          },
        },
      );

      const orders = response.data?.data || [];
      return orders.find((order: any) => order.orderHash === orderHash) || null;
    } catch (error) {
      console.error('Error fetching OpenOcean DCA order:', error);
      return null;
    }
  }

  /**
   * Check if an order is still active
   */
  async isOrderActive(orderHash: string): Promise<boolean> {
    const order = await this.getOrderByHash(orderHash);
    return (
      order?.statuses === OpenOceanOrderStatus.UNFILLED ||
      order?.statuses === OpenOceanOrderStatus.PENDING
    );
  }

  /**
   * Get order execution history/status
   */
  async getOrderStatus(orderHash: string): Promise<{
    status: OpenOceanOrderStatus;
    remainingAmount: string;
    executedAmount: string;
    executionCount: number;
    nextExecution?: string;
  } | null> {
    const order = await this.getOrderByHash(orderHash);
    if (!order) return null;

    const executedAmount =
      order.makerAmount && order.remainingMakerAmount
        ? (
            BigInt(order.makerAmount) - BigInt(order.remainingMakerAmount)
          ).toString()
        : '0';

    return {
      status: order.statuses as OpenOceanOrderStatus,
      remainingAmount: order.remainingMakerAmount || '0',
      executedAmount,
      executionCount: order.have_filled || 0,
      nextExecution: order.expireTime,
    };
  }

  /**
   * Validate order parameters before creation
   */
  validateOrderParams(params: OpenOceanDCAOrderParams): {
    valid: boolean;
    error?: string;
  } {
    const { usdcAmount, intervalHours, numberOfBuys } = params;

    // Minimum amount check ($5 for Base)
    if (usdcAmount < 5) {
      return { valid: false, error: 'Minimum order amount is $5 USD' };
    }

    // Minimum interval check (60 seconds = 1/60 hour)
    if (intervalHours < 1 / 60) {
      return { valid: false, error: 'Minimum interval is 60 seconds' };
    }

    // Maximum interval check (reasonable limit)
    if (intervalHours > 24 * 30) {
      // 30 days max
      return { valid: false, error: 'Maximum interval is 30 days' };
    }

    // Number of buys check
    if (numberOfBuys < 1 || numberOfBuys > 1000) {
      return {
        valid: false,
        error: 'Number of buys must be between 1 and 1000',
      };
    }

    return { valid: true };
  }

  private async getGasPrice(provider: ethers.BrowserProvider) {
    const feeData = await provider.getFeeData();
    return (Number(feeData.gasPrice) * 1.2).toString();
  }

  private calculateExpiry(hours: number, times: number): string {
    const totalHours = hours * times;
    if (totalHours <= 24) return '1D';
    if (totalHours <= 168) return '7D';
    if (totalHours <= 720) return '30D';
    if (totalHours <= 2160) return '3Month';
    return '6Month';
  }
}
