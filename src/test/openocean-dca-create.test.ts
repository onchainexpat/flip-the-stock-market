import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenOceanDCAService } from '../services/openOceanDCAService';

// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock the database
vi.mock('../lib/serverDcaDatabase', () => ({
  serverDcaDatabase: {
    createOpenOceanOrder: vi.fn(),
    getOpenOceanOrderByHash: vi.fn(),
    updateOpenOceanOrder: vi.fn(),
  },
}));

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi
          .fn()
          .mockResolvedValue('0x1234567890123456789012345678901234567890'),
      }),
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: BigInt('20000000000'), // 20 gwei
      }),
    })),
    JsonRpcProvider: vi.fn(),
  },
}));

// Mock the OpenOcean SDK
vi.mock('@openocean.finance/limitorder-sdk', () => ({
  openoceanLimitOrderSdk: {
    createLimitOrder: vi.fn(),
    cancelLimitOrder: vi.fn(),
  },
}));

import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { ethers } from 'ethers';

describe('OpenOcean DCA Order Creation', () => {
  let dcaService: OpenOceanDCAService;
  let mockProvider: any;
  let mockAxios: any;

  beforeEach(() => {
    mockProvider = new ethers.BrowserProvider(null as any);
    dcaService = new OpenOceanDCAService();
    mockAxios = vi.mocked(axios);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a valid DCA order', async () => {
    // Mock SDK response
    const mockOrderData = {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        receiver: '0x0000000000000000000000000000000000000000',
        allowedSender: '0x0000000000000000000000000000000000000000',
        makingAmount: '50000000', // 50 USDC total
        takingAmount: '1000000000000000000', // 1 SPX
        makerAssetData: '0x',
        takerAssetData: '0x',
        getMakerAmount: '0x',
        getTakerAmount: '0x',
        predicate: '0x',
        permit: '0x',
        interaction: '0x',
      },
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(
      mockOrderData,
    );

    // Mock OpenOcean API response
    mockAxios.post.mockResolvedValue({
      data: {
        code: 200,
        data: {
          orderHash:
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
          status: 1,
        },
      },
    });

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 50,
      intervalHours: 24,
      numberOfBuys: 5,
    };

    const order = await dcaService.createSPXDCAOrder(dcaParams);

    expect(order).toBeDefined();
    expect(order.orderHash).toBe(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    );
    expect(order.totalAmount).toBe(50);
    expect(order.perExecution).toBe(10); // 50 / 5 = 10
    expect(order.intervals).toBe(5);
    expect(order.chainId).toBe(8453);
    expect(order.orderData).toBeDefined();

    // Verify SDK was called with correct parameters
    expect(openoceanLimitOrderSdk.createLimitOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: mockProvider,
        chainId: 8453,
        chainKey: 'base',
        mode: 'Dca',
      }),
      expect.objectContaining({
        makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        makerTokenDecimals: 6,
        takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        takerTokenDecimals: 18,
        makerAmount: '50000000', // 50 USDC with 6 decimals
      }),
    );

    // Verify OpenOcean API was called
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://open-api.openocean.finance/v1/8453/dca/swap',
      expect.objectContaining({
        signature: mockOrderData.signature,
        orderHash: mockOrderData.orderHash,
        time: 86400, // 24 hours in seconds
        times: 5,
        version: 'v2',
        referrer: '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7',
        referrerFee: '1',
      }),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('should handle order creation with price range', async () => {
    const mockOrderData = {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '20000000', // 20 USDC
        takingAmount: '1000000000000000000', // 1 SPX
      },
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(
      mockOrderData,
    );
    mockAxios.post.mockResolvedValue({
      data: { code: 200, data: { orderHash: mockOrderData.orderHash } },
    });

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 20,
      intervalHours: 12,
      numberOfBuys: 4,
      minPrice: '0.001',
      maxPrice: '0.005',
    };

    const order = await dcaService.createSPXDCAOrder(dcaParams);

    expect(order).toBeDefined();
    expect(order.orderHash).toBe(mockOrderData.orderHash);

    // Verify API was called with price range
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://open-api.openocean.finance/v1/8453/dca/swap',
      expect.objectContaining({
        minPrice: '0.001',
        maxPrice: '0.005',
      }),
      expect.any(Object),
    );
  });

  it('should validate minimum order amount', async () => {
    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 3, // Below minimum of $5
      intervalHours: 24,
      numberOfBuys: 1,
    };

    const validation = dcaService.validateOrderParams(dcaParams);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Minimum order amount is $5 USD');
  });

  it('should validate minimum interval', async () => {
    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 0.01, // Below minimum of 1 minute
      numberOfBuys: 1,
    };

    const validation = dcaService.validateOrderParams(dcaParams);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Minimum interval is 60 seconds');
  });

  it('should validate number of buys', async () => {
    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 0, // Invalid
    };

    const validation = dcaService.validateOrderParams(dcaParams);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Number of buys must be between 1 and 1000');
  });

  it('should handle SDK errors gracefully', async () => {
    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockRejectedValue(
      new Error('SDK signature generation failed'),
    );

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 1,
    };

    await expect(dcaService.createSPXDCAOrder(dcaParams)).rejects.toThrow(
      'SDK signature generation failed',
    );
  });

  it('should handle OpenOcean API errors', async () => {
    const mockOrderData = {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '10000000',
        takingAmount: '1000000000000000000',
      },
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(
      mockOrderData,
    );

    // Mock API error
    mockAxios.post.mockRejectedValue(new Error('OpenOcean API error'));

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 1,
    };

    await expect(dcaService.createSPXDCAOrder(dcaParams)).rejects.toThrow(
      'OpenOcean API error',
    );
  });

  it('should calculate correct expiry times', async () => {
    const testCases = [
      { hours: 1, times: 1, expected: '1D' },
      { hours: 24, times: 1, expected: '1D' },
      { hours: 24, times: 7, expected: '7D' },
      { hours: 24, times: 30, expected: '30D' },
      { hours: 24, times: 90, expected: '3Month' },
      { hours: 24, times: 180, expected: '6Month' },
    ];

    for (const testCase of testCases) {
      const service = new OpenOceanDCAService();
      const result = (service as any).calculateExpiry(
        testCase.hours,
        testCase.times,
      );
      expect(result).toBe(testCase.expected);
    }
  });

  it('should handle different token pairs', async () => {
    const mockOrderData = {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '10000000',
        takingAmount: '1000000000000000000',
      },
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(
      mockOrderData,
    );
    mockAxios.post.mockResolvedValue({
      data: { code: 200, data: { orderHash: mockOrderData.orderHash } },
    });

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 1,
    };

    const order = await dcaService.createSPXDCAOrder(dcaParams);

    expect(order).toBeDefined();
    expect(order.orderHash).toBe(mockOrderData.orderHash);

    // Verify correct token addresses are used
    expect(openoceanLimitOrderSdk.createLimitOrder).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
        takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
        makerTokenDecimals: 6,
        takerTokenDecimals: 18,
      }),
    );
  });

  it('should handle large order amounts', async () => {
    const mockOrderData = {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        makingAmount: '10000000000', // 10,000 USDC
        takingAmount: '1000000000000000000',
      },
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(
      mockOrderData,
    );
    mockAxios.post.mockResolvedValue({
      data: { code: 200, data: { orderHash: mockOrderData.orderHash } },
    });

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10000, // Large amount
      intervalHours: 24,
      numberOfBuys: 100,
    };

    const order = await dcaService.createSPXDCAOrder(dcaParams);

    expect(order).toBeDefined();
    expect(order.totalAmount).toBe(10000);
    expect(order.perExecution).toBe(100); // 10000 / 100 = 100
    expect(order.intervals).toBe(100);
  });

  it('should handle maximum number of buys', async () => {
    const validation = dcaService.validateOrderParams({
      provider: mockProvider,
      usdcAmount: 1000,
      intervalHours: 1,
      numberOfBuys: 1000, // Maximum allowed
    });

    expect(validation.valid).toBe(true);

    const invalidValidation = dcaService.validateOrderParams({
      provider: mockProvider,
      usdcAmount: 1000,
      intervalHours: 1,
      numberOfBuys: 1001, // Above maximum
    });

    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.error).toBe(
      'Number of buys must be between 1 and 1000',
    );
  });
});
