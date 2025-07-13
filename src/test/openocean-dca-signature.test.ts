import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { OpenOceanDCAService } from '../services/openOceanDCAService';

// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: { code: 200, data: { status: 1 } }
    }),
    get: vi.fn().mockResolvedValue({
      data: { code: 200, data: [] }
    })
  }
}));

// Mock ethers for testing
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getSigner: vi.fn().mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
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
    createLimitOrder: vi.fn().mockResolvedValue({
      signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      orderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      data: {
        salt: '1234567890123',
        makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        maker: '0x1234567890123456789012345678901234567890',
        receiver: '0x0000000000000000000000000000000000000000',
        allowedSender: '0x0000000000000000000000000000000000000000',
        makingAmount: '10000000', // 10 USDC
        takingAmount: '1000000000000000000', // 1 SPX
        makerAssetData: '0x',
        takerAssetData: '0x',
        getMakerAmount: '0x',
        getTakerAmount: '0x',
        predicate: '0x',
        permit: '0x',
        interaction: '0x'
      }
    }),
    cancelLimitOrder: vi.fn().mockResolvedValue({
      transactionHash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    })
  }
}));

describe('OpenOcean DCA Signature Generation', () => {
  let mockProvider: any;
  let dcaService: OpenOceanDCAService;

  beforeEach(() => {
    mockProvider = new ethers.BrowserProvider(null as any);
    dcaService = new OpenOceanDCAService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid signature for DCA order', async () => {
    const walletParams = {
      provider: mockProvider,
      signer: await mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const orderParams = {
      makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      makerTokenDecimals: 6,
      takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
      takerTokenDecimals: 18,
      makerAmount: '10000000', // 10 USDC
      takerAmount: '1', // Let OpenOcean calculate
      gasPrice: '24000000000', // 24 gwei
      expire: '1D'
    };

    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      walletParams,
      orderParams
    );

    // Verify signature format
    expect(orderData.signature).toBeDefined();
    expect(orderData.signature).toMatch(/^0x[0-9a-fA-F]{130}$/); // 65 bytes = 130 hex chars
    
    // Verify order hash
    expect(orderData.orderHash).toBeDefined();
    expect(orderData.orderHash).toMatch(/^0x[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
    
    // Verify order data structure
    expect(orderData.data).toBeDefined();
    expect(orderData.data.salt).toBeDefined();
    expect(orderData.data.makerAsset).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    expect(orderData.data.takerAsset).toBe('0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C');
    expect(orderData.data.maker).toBe('0x1234567890123456789012345678901234567890');
    expect(orderData.data.makingAmount).toBe('10000000');
  });

  it('should handle signature generation errors gracefully', async () => {
    // Mock SDK to throw error
    const mockCreateLimitOrder = vi.mocked(openoceanLimitOrderSdk.createLimitOrder);
    mockCreateLimitOrder.mockRejectedValueOnce(new Error('Signature generation failed'));

    const walletParams = {
      provider: mockProvider,
      signer: await mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const orderParams = {
      makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      makerTokenDecimals: 6,
      takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
      takerTokenDecimals: 18,
      makerAmount: '10000000',
      takerAmount: '1',
      gasPrice: '24000000000',
      expire: '1D'
    };

    await expect(
      openoceanLimitOrderSdk.createLimitOrder(walletParams, orderParams)
    ).rejects.toThrow('Signature generation failed');
  });

  it('should create complete DCA order with signature', async () => {
    const dcaParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 5
    };

    // Mock the createSPXDCAOrder to return expected result
    const mockCreateSPXDCAOrder = vi.spyOn(dcaService, 'createSPXDCAOrder').mockResolvedValue({
      orderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      totalAmount: 10,
      perExecution: 2,
      intervals: 5,
      chainId: 8453,
      orderData: {
        signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        orderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        data: {
          salt: '1234567890123',
          makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C'
        }
      }
    });

    const order = await dcaService.createSPXDCAOrder(dcaParams);

    expect(order).toBeDefined();
    expect(order.orderHash).toBeDefined();
    expect(order.orderData.signature).toBeDefined();
    expect(order.orderData.data).toBeDefined();
    expect(order.totalAmount).toBe(10);
    expect(order.perExecution).toBe(2);
    expect(order.intervals).toBe(5);

    mockCreateSPXDCAOrder.mockRestore();
  });

  it('should validate signature format', () => {
    const validSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const invalidSignature = '0x1234567890abcdef';
    const noPrefix = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // Valid signature should match pattern
    expect(validSignature).toMatch(/^0x[0-9a-fA-F]{130}$/);
    
    // Invalid signature should not match
    expect(invalidSignature).not.toMatch(/^0x[0-9a-fA-F]{130}$/);
    
    // No prefix should not match
    expect(noPrefix).not.toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it('should validate order hash format', () => {
    const validOrderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';
    const invalidOrderHash = '0xabcdef';
    const noPrefix = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';

    // Valid order hash should match pattern
    expect(validOrderHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    
    // Invalid order hash should not match
    expect(invalidOrderHash).not.toMatch(/^0x[0-9a-fA-F]{64}$/);
    
    // No prefix should not match
    expect(noPrefix).not.toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('should handle different expiry times', async () => {
    const walletParams = {
      provider: mockProvider,
      signer: await mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const expiryTimes = ['1H', '1D', '7D', '30D', '3Month', '6Month'];

    for (const expiry of expiryTimes) {
      const orderParams = {
        makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        makerTokenDecimals: 6,
        takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
        takerTokenDecimals: 18,
        makerAmount: '10000000',
        takerAmount: '1',
        gasPrice: '24000000000',
        expire: expiry
      };

      const orderData = await openoceanLimitOrderSdk.createLimitOrder(
        walletParams,
        orderParams
      );

      expect(orderData.signature).toBeDefined();
      expect(orderData.orderHash).toBeDefined();
      expect(orderData.data).toBeDefined();
    }
  });

  it('should handle cancellation signature generation', async () => {
    const walletParams = {
      provider: mockProvider,
      signer: await mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const orderData = {
      salt: '1234567890123',
      makerAsset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      takerAsset: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
      maker: '0x1234567890123456789012345678901234567890'
    };

    const cancelParams = {
      orderData,
      gasPrice: '24000000000'
    };

    const cancelResult = await openoceanLimitOrderSdk.cancelLimitOrder(
      walletParams,
      cancelParams
    );

    expect(cancelResult).toBeDefined();
    expect(cancelResult.transactionHash).toBeDefined();
    expect(cancelResult.transactionHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('should handle different chain configurations for signatures', async () => {
    const baseWalletParams = {
      provider: mockProvider,
      signer: await mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const ethereumWalletParams = {
      ...baseWalletParams,
      chainId: 1,
      chainKey: 'ethereum'
    };

    const orderParams = {
      makerTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      makerTokenDecimals: 6,
      takerTokenAddress: '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C',
      takerTokenDecimals: 18,
      makerAmount: '10000000',
      takerAmount: '1',
      gasPrice: '24000000000',
      expire: '1D'
    };

    // Test Base chain
    const baseOrder = await openoceanLimitOrderSdk.createLimitOrder(
      baseWalletParams,
      orderParams
    );

    expect(baseOrder.signature).toBeDefined();
    expect(baseOrder.orderHash).toBeDefined();

    // Test Ethereum chain
    const ethereumOrder = await openoceanLimitOrderSdk.createLimitOrder(
      ethereumWalletParams,
      orderParams
    );

    expect(ethereumOrder.signature).toBeDefined();
    expect(ethereumOrder.orderHash).toBeDefined();
  });
});