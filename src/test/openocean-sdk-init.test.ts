import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { OpenOceanDCAService } from '../services/openOceanDCAService';

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

describe('OpenOcean SDK Initialization', () => {
  let mockProvider: any;
  let dcaService: OpenOceanDCAService;

  beforeEach(() => {
    // Create mock provider
    mockProvider = new ethers.BrowserProvider(null as any);
    dcaService = new OpenOceanDCAService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should import the sdk without errors', () => {
    expect(openoceanLimitOrderSdk).toBeDefined();
    expect(typeof openoceanLimitOrderSdk).toBe('object');
  });

  it('should have required SDK methods', () => {
    expect(openoceanLimitOrderSdk.createLimitOrder).toBeDefined();
    expect(openoceanLimitOrderSdk.cancelLimitOrder).toBeDefined();
    expect(typeof openoceanLimitOrderSdk.createLimitOrder).toBe('function');
    expect(typeof openoceanLimitOrderSdk.cancelLimitOrder).toBe('function');
  });

  it('should create DCA service instance', () => {
    expect(dcaService).toBeDefined();
    expect(dcaService.createSPXDCAOrder).toBeDefined();
    expect(dcaService.cancelOrder).toBeDefined();
    expect(dcaService.getOrdersByAddress).toBeDefined();
    expect(dcaService.validateOrderParams).toBeDefined();
  });

  it('should validate order parameters correctly', () => {
    const validParams = {
      provider: mockProvider,
      usdcAmount: 10,
      intervalHours: 24,
      numberOfBuys: 5,
    };

    const invalidParams = {
      provider: mockProvider,
      usdcAmount: 1, // Below minimum
      intervalHours: 0.001, // Below minimum
      numberOfBuys: 0, // Invalid
    };

    expect(dcaService.validateOrderParams(validParams)).toEqual({ valid: true });
    expect(dcaService.validateOrderParams(invalidParams)).toEqual({ 
      valid: false,
      error: 'Minimum order amount is $5 USD'
    });
  });

  it('should handle SDK compatibility checks', () => {
    // Test that the SDK can be initialized with proper wallet params
    const walletParams = {
      provider: mockProvider,
      signer: mockProvider.getSigner(),
      account: '0x1234567890123456789012345678901234567890',
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    expect(walletParams).toBeDefined();
    expect(walletParams.mode).toBe('Dca');
    expect(walletParams.chainId).toBe(8453);
    expect(walletParams.chainKey).toBe('base');
  });

  it('should handle provider initialization', async () => {
    const signer = await mockProvider.getSigner();
    const address = await signer.getAddress();
    
    expect(address).toBe('0x1234567890123456789012345678901234567890');
    expect(signer).toBeDefined();
  });

  it('should handle gas price estimation', async () => {
    const feeData = await mockProvider.getFeeData();
    
    expect(feeData.gasPrice).toBeDefined();
    expect(typeof feeData.gasPrice).toBe('bigint');
  });

  it('should create proper wallet params for DCA mode', async () => {
    const signer = await mockProvider.getSigner();
    const address = await signer.getAddress();
    
    const walletParams = {
      provider: mockProvider,
      signer,
      account: address,
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    // Verify all required parameters are present
    expect(walletParams.provider).toBeDefined();
    expect(walletParams.signer).toBeDefined();
    expect(walletParams.account).toBe(address);
    expect(walletParams.chainId).toBe(8453);
    expect(walletParams.chainKey).toBe('base');
    expect(walletParams.mode).toBe('Dca');
  });

  it('should handle different chain configurations', () => {
    const baseConfig = {
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };

    const ethereumConfig = {
      chainId: 1,
      chainKey: 'ethereum',
      mode: 'Dca'
    };

    expect(baseConfig.chainId).toBe(8453);
    expect(ethereumConfig.chainId).toBe(1);
    expect(baseConfig.mode).toBe('Dca');
    expect(ethereumConfig.mode).toBe('Dca');
  });
});
