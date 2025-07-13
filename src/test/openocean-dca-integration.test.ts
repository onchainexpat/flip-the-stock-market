import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenOceanDCAService } from '../services/openOceanDCAService';
import { openOceanSyncService } from '../services/openOceanSyncService';
import { serverDcaDatabase } from '../lib/serverDcaDatabase';
import axios from 'axios';

// Mock all external dependencies
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

vi.mock('../lib/serverDcaDatabase');
vi.mock('@openocean.finance/limitorder-sdk');
vi.mock('ethers');

import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { ethers } from 'ethers';

describe('OpenOcean DCA Integration Tests', () => {
  let dcaService: OpenOceanDCAService;
  let mockProvider: any;
  let mockAxios: any;

  const mockUserAddress = '0x1234567890123456789012345678901234567890';
  const mockOrderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';
  const mockSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    // Setup mocks
    mockProvider = {
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(mockUserAddress)
      }),
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: BigInt('20000000000')
      })
    };

    mockAxios = vi.mocked(axios);
    dcaService = new OpenOceanDCAService();

    // Mock ethers
    vi.mocked(ethers).BrowserProvider = vi.fn().mockReturnValue(mockProvider);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full DCA order lifecycle', async () => {
    // Step 1: Create order
    const mockOrderData = {
      signature: mockSignature,
      orderHash: mockOrderHash,
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: mockUserAddress,
        makingAmount: '100000000', // 100 USDC
        takingAmount: '1000000000000000000' // 1 SPX
      }
    };

    vi.mocked(openoceanLimitOrderSdk.createLimitOrder).mockResolvedValue(mockOrderData);
    mockAxios.post.mockResolvedValue({
      data: { code: 200, data: { orderHash: mockOrderHash, status: 1 } }
    });

    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 100,
      intervalHours: 24,
      numberOfBuys: 10
    };

    const createdOrder = await dcaService.createSPXDCAOrder(dcaParams);

    expect(createdOrder).toBeDefined();
    expect(createdOrder.orderHash).toBe(mockOrderHash);
    expect(createdOrder.totalAmount).toBe(100);
    expect(createdOrder.perExecution).toBe(10);

    // Step 2: Query order status
    mockAxios.get.mockResolvedValue({
      data: {
        code: 200,
        data: [{
          orderHash: mockOrderHash,
          makerAmount: '100000000',
          remainingMakerAmount: '80000000',
          statuses: 1, // unfilled
          have_filled: 2,
          createDateTime: '2024-01-01T00:00:00.000Z',
          expireTime: '2024-01-11T00:00:00.000Z'
        }]
      }
    });

    const orders = await dcaService.getOrdersByAddress(mockUserAddress);
    expect(orders).toBeDefined();
    expect(orders.length).toBeGreaterThan(0);

    // Step 3: Get order status
    const orderStatus = await dcaService.getOrderStatus(mockOrderHash);
    expect(orderStatus).toBeDefined();
    expect(orderStatus?.status).toBe(1);
    expect(orderStatus?.executionCount).toBe(2);

    // Step 4: Check if order is active
    const isActive = await dcaService.isOrderActive(mockOrderHash);
    expect(isActive).toBe(true);

    // Step 5: Cancel order
    mockAxios.post.mockResolvedValue({
      data: { code: 200, data: { status: 3 } }
    });

    const cancelResult = await dcaService.cancelOrder(mockProvider, mockOrderHash, mockOrderData.data);
    expect(cancelResult).toBeDefined();
    expect(cancelResult.code).toBe(200);
  });

  it('should handle order execution tracking', async () => {
    const mockOrder = {
      id: 'test-order-1',
      orderHash: mockOrderHash,
      userAddress: mockUserAddress,
      totalAmount: BigInt('100000000'),
      executedAmount: BigInt('20000000'),
      remainingMakerAmount: BigInt('80000000'),
      executionsCount: 2,
      numberOfBuys: 10,
      status: 'active',
      openOceanStatus: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValue(mockOrder as any);

    mockAxios.get.mockResolvedValue({
      data: {
        code: 200,
        data: [{
          orderHash: mockOrderHash,
          makerAmount: '100000000',
          remainingMakerAmount: '70000000', // More executed
          statuses: 1,
          have_filled: 3, // More executions
          createDateTime: '2024-01-01T00:00:00.000Z',
          expireTime: '2024-01-11T00:00:00.000Z'
        }]
      }
    });

    const syncResult = await openOceanSyncService.syncOrder(mockOrderHash);
    
    expect(syncResult).toBeDefined();
    expect(syncResult.success).toBe(true);
    expect(syncResult.orderHash).toBe(mockOrderHash);
    expect(syncResult.newExecutions).toBe(3);
  });

  it('should handle order completion', async () => {
    const mockOrder = {
      id: 'test-order-2',
      orderHash: mockOrderHash,
      userAddress: mockUserAddress,
      totalAmount: BigInt('100000000'),
      executedAmount: BigInt('100000000'), // Fully executed
      remainingMakerAmount: BigInt('0'),
      executionsCount: 10,
      numberOfBuys: 10,
      status: 'active',
      openOceanStatus: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValue(mockOrder as any);

    mockAxios.get.mockResolvedValue({
      data: {
        code: 200,
        data: [{
          orderHash: mockOrderHash,
          makerAmount: '100000000',
          remainingMakerAmount: '0', // Fully executed
          statuses: 4, // filled
          have_filled: 10,
          createDateTime: '2024-01-01T00:00:00.000Z',
          expireTime: '2024-01-11T00:00:00.000Z'
        }]
      }
    });

    const syncResult = await openOceanSyncService.syncOrder(mockOrderHash);
    
    expect(syncResult).toBeDefined();
    expect(syncResult.success).toBe(true);
    expect(syncResult.newStatus).toBe('completed');
    expect(syncResult.newExecutions).toBe(10);
  });

  it('should handle order expiration', async () => {
    const mockOrder = {
      id: 'test-order-3',
      orderHash: mockOrderHash,
      userAddress: mockUserAddress,
      totalAmount: BigInt('100000000'),
      executedAmount: BigInt('50000000'),
      remainingMakerAmount: BigInt('50000000'),
      executionsCount: 5,
      numberOfBuys: 10,
      status: 'active',
      openOceanStatus: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValue(mockOrder as any);

    // Mock order not found in API (expired)
    mockAxios.get.mockResolvedValue({
      data: {
        code: 200,
        data: [] // Empty array means order not found
      }
    });

    const syncResult = await openOceanSyncService.syncOrder(mockOrderHash);
    
    expect(syncResult).toBeDefined();
    expect(syncResult.success).toBe(true);
    expect(syncResult.newStatus).toBe('expired');
  });

  it('should handle batch operations', async () => {
    const orderHashes = [
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      '0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
      '0xcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd'
    ];

    // Mock database responses
    orderHashes.forEach((hash, index) => {
      const mockOrder = {
        id: `test-order-${index}`,
        orderHash: hash,
        userAddress: mockUserAddress,
        totalAmount: BigInt('100000000'),
        executedAmount: BigInt('20000000'),
        remainingMakerAmount: BigInt('80000000'),
        executionsCount: 2,
        numberOfBuys: 10,
        status: 'active',
        openOceanStatus: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValueOnce(mockOrder as any);
    });

    // Mock API responses
    mockAxios.get.mockResolvedValue({
      data: {
        code: 200,
        data: orderHashes.map(hash => ({
          orderHash: hash,
          makerAmount: '100000000',
          remainingMakerAmount: '80000000',
          statuses: 1,
          have_filled: 2,
          createDateTime: '2024-01-01T00:00:00.000Z',
          expireTime: '2024-01-11T00:00:00.000Z'
        }))
      }
    });

    const batchResult = await openOceanSyncService.syncOrdersBatch(orderHashes);
    
    expect(batchResult).toBeDefined();
    expect(batchResult.totalOrders).toBe(3);
    expect(batchResult.syncedOrders).toBe(3);
    expect(batchResult.errorCount).toBe(0);
    expect(batchResult.results).toHaveLength(3);
  });

  it('should handle API rate limiting', async () => {
    const orderHashes = Array.from({ length: 10 }, (_, i) => 
      `0x${i.toString().padStart(64, '0')}`
    );

    // Mock rate limiting error
    mockAxios.get.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    const batchResult = await openOceanSyncService.syncOrdersBatch(orderHashes);
    
    expect(batchResult).toBeDefined();
    expect(batchResult.errorCount).toBeGreaterThan(0);
    expect(batchResult.errors).toHaveLength(10); // All orders should have errors
  });

  it('should handle network errors gracefully', async () => {
    const mockOrder = {
      id: 'test-order-network',
      orderHash: mockOrderHash,
      userAddress: mockUserAddress,
      totalAmount: BigInt('100000000'),
      executedAmount: BigInt('20000000'),
      remainingMakerAmount: BigInt('80000000'),
      executionsCount: 2,
      numberOfBuys: 10,
      status: 'active',
      openOceanStatus: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValue(mockOrder as any);

    // Mock network error
    mockAxios.get.mockRejectedValue(new Error('Network error'));

    const syncResult = await openOceanSyncService.syncOrder(mockOrderHash);
    
    expect(syncResult).toBeDefined();
    expect(syncResult.success).toBe(false);
    expect(syncResult.error).toBe('Network error');
  });

  it('should validate order parameters in integration', async () => {
    const invalidParams = {
      provider: mockProvider,
      usdcAmount: 1, // Below minimum
      intervalHours: 0.001, // Below minimum
      numberOfBuys: 0 // Invalid
    };

    const validation = dcaService.validateOrderParams(invalidParams);
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('Minimum order amount is $5 USD');
  });

  it('should handle user order retrieval', async () => {
    const mockOrders = [
      {
        orderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        makerAmount: '100000000',
        remainingMakerAmount: '80000000',
        statuses: 1,
        have_filled: 2,
        createDateTime: '2024-01-01T00:00:00.000Z',
        expireTime: '2024-01-11T00:00:00.000Z'
      },
      {
        orderHash: '0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
        makerAmount: '50000000',
        remainingMakerAmount: '0',
        statuses: 4, // completed
        have_filled: 5,
        createDateTime: '2024-01-01T00:00:00.000Z',
        expireTime: '2024-01-06T00:00:00.000Z'
      }
    ];

    mockAxios.get.mockResolvedValue({
      data: { code: 200, data: mockOrders }
    });

    const orders = await dcaService.getOrdersByAddress(mockUserAddress);
    
    expect(orders).toBeDefined();
    expect(orders).toHaveLength(2);
    expect(orders[0].orderHash).toBe(mockOrders[0].orderHash);
    expect(orders[1].orderHash).toBe(mockOrders[1].orderHash);
  });

  it('should handle concurrent order operations', async () => {
    const orderHashes = [
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      '0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc'
    ];

    // Mock concurrent operations
    const promises = orderHashes.map(async (hash) => {
      const mockOrder = {
        id: `concurrent-${hash}`,
        orderHash: hash,
        userAddress: mockUserAddress,
        totalAmount: BigInt('100000000'),
        executedAmount: BigInt('20000000'),
        remainingMakerAmount: BigInt('80000000'),
        executionsCount: 2,
        numberOfBuys: 10,
        status: 'active',
        openOceanStatus: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      vi.mocked(serverDcaDatabase.getOpenOceanOrderByHash).mockResolvedValue(mockOrder as any);

      mockAxios.get.mockResolvedValue({
        data: {
          code: 200,
          data: [{
            orderHash: hash,
            makerAmount: '100000000',
            remainingMakerAmount: '80000000',
            statuses: 1,
            have_filled: 2,
            createDateTime: '2024-01-01T00:00:00.000Z',
            expireTime: '2024-01-11T00:00:00.000Z'
          }]
        }
      });

      return openOceanSyncService.syncOrder(hash);
    });

    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(2);
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.orderHash).toBe(orderHashes[index]);
    });
  });
});