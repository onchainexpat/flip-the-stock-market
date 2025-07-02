import type { Address } from 'viem';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EIP7702Manager } from '../../services/eip7702Manager';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBytecode: vi.fn(),
      getTransactionCount: vi.fn(),
      readContract: vi.fn(),
      estimateGas: vi.fn(),
    })),
  };
});

// Mock chain imports
vi.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

describe('EIP7702Manager', () => {
  let manager: EIP7702Manager;
  const testAddress: Address = '0x1234567890abcdef1234567890abcdef12345678';
  const implementationAddress: Address =
    '0xabcdef1234567890abcdef1234567890abcdef12';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new EIP7702Manager();

    // Reset the public client mock for each test
    const mockPublicClient = (manager as any).publicClient;
    mockPublicClient.getBytecode.mockReset();
    mockPublicClient.getTransactionCount.mockReset();
    mockPublicClient.readContract.mockReset();
    mockPublicClient.estimateGas.mockReset();
  });

  describe('isEOA', () => {
    test('should return true for EOA (no bytecode)', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue(null);

      const result = await manager.isEOA(testAddress);
      expect(result).toBe(true);
    });

    test('should return true for EOA (empty bytecode)', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue('0x');

      const result = await manager.isEOA(testAddress);
      expect(result).toBe(true);
    });

    test('should return false for smart contract', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue(
        '0x608060405234801561001057600080fd5b50...',
      );

      const result = await manager.isEOA(testAddress);
      expect(result).toBe(false);
    });
  });

  describe('hasActiveDelegation', () => {
    test('should return true for EIP-7702 delegated account', async () => {
      const mockPublicClient = (manager as any).publicClient;
      // EIP-7702 delegated accounts have code starting with 0xef0100
      mockPublicClient.getBytecode.mockResolvedValue(
        '0xef0100' + implementationAddress.slice(2),
      );

      const result = await manager.hasActiveDelegation(testAddress);
      expect(result).toBe(true);
    });

    test('should return false for regular EOA', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue(null);
      mockPublicClient.readContract.mockResolvedValue(
        '0x0000000000000000000000000000000000000000',
      );

      const result = await manager.hasActiveDelegation(testAddress);
      expect(result).toBe(false);
    });

    test('should handle errors gracefully', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await manager.hasActiveDelegation(testAddress);
      expect(result).toBe(false);
    });
  });

  describe('generateAuthorizationRequest', () => {
    test('should generate valid authorization request', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getTransactionCount.mockResolvedValue(42);

      const request = await manager.generateAuthorizationRequest(
        testAddress,
        implementationAddress,
      );

      expect(request.chainId).toBe(BigInt(8453)); // Base chain ID
      expect(request.delegateAddress).toBe(implementationAddress);
      expect(request.nonce).toBe(BigInt(42));
      expect(request.expiry).toBeGreaterThan(
        BigInt(Math.floor(Date.now() / 1000)),
      );
    });

    test('should handle nonce fetch error', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getTransactionCount.mockRejectedValue(
        new Error('RPC error'),
      );

      const request = await manager.generateAuthorizationRequest(testAddress);

      expect(request.nonce).toBe(BigInt(0)); // Should fallback to 0
    });
  });

  describe('createAuthorizationMessage', () => {
    test('should create human-readable authorization message', () => {
      const request = {
        chainId: BigInt(8453),
        delegateAddress: implementationAddress,
        nonce: BigInt(42),
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      };

      const message = manager.createAuthorizationMessage(request);

      expect(message).toContain('EIP-7702 Authorization');
      expect(message).toContain('Chain ID: 8453');
      expect(message).toContain(`Delegate To: ${implementationAddress}`);
      expect(message).toContain('Nonce: 42');
      expect(message).toContain('smart wallet features');
    });
  });

  describe('parseAuthorizationFromSignature', () => {
    test('should parse signature correctly', () => {
      const mockSignature = '0x' + 'a'.repeat(64) + 'b'.repeat(64) + '1b';
      const request = {
        chainId: BigInt(8453),
        delegateAddress: implementationAddress,
        nonce: BigInt(42),
      };

      const authorization = manager.parseAuthorizationFromSignature(
        mockSignature,
        request,
      );

      expect(authorization.chainId).toBe(BigInt(8453));
      expect(authorization.address).toBe(implementationAddress);
      expect(authorization.nonce).toBe(BigInt(42));
      expect(authorization.r).toBe('0x' + 'a'.repeat(64));
      expect(authorization.s).toBe('0x' + 'b'.repeat(64));
      expect(authorization.v).toBe(BigInt(27)); // 0x1b converted to decimal and adjusted
    });
  });

  describe('checkImplementationSupport', () => {
    test('should check interface support correctly', async () => {
      const mockPublicClient = (manager as any).publicClient;

      // Mock interface support checks
      mockPublicClient.readContract
        .mockResolvedValueOnce(true) // ERC165
        .mockResolvedValueOnce(true) // ERC1271
        .mockResolvedValueOnce(true) // ERC4337
        .mockResolvedValueOnce(false); // SESSION_KEY

      const support = await manager.checkImplementationSupport(
        implementationAddress,
      );

      expect(support.supportsERC165).toBe(true);
      expect(support.supportsERC1271).toBe(true);
      expect(support.supportsERC4337).toBe(true);
      expect(support.supportsSessionKeys).toBe(false);
    });

    test('should handle interface check errors', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Contract error'),
      );

      const support = await manager.checkImplementationSupport(
        implementationAddress,
      );

      expect(support.supportsERC165).toBe(false);
      expect(support.supportsERC1271).toBe(false);
      expect(support.supportsERC4337).toBe(false);
      expect(support.supportsSessionKeys).toBe(false);
    });
  });

  describe('estimateDelegationGas', () => {
    test('should estimate gas with buffer', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.estimateGas.mockResolvedValue(BigInt(150000));

      const gasEstimate = await manager.estimateDelegationGas(testAddress);

      expect(gasEstimate).toBe(BigInt(200000)); // 150000 + 50000 buffer
    });

    test('should return default gas on estimation error', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.estimateGas.mockRejectedValue(
        new Error('Gas estimation failed'),
      );

      const gasEstimate = await manager.estimateDelegationGas(testAddress);

      expect(gasEstimate).toBe(BigInt(200000)); // Default fallback
    });
  });

  describe('getDelegationInfo', () => {
    test('should return delegation info for active delegation', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue(
        '0xef0100' + implementationAddress.slice(2),
      );

      const info = await manager.getDelegationInfo(testAddress);

      expect(info).not.toBeNull();
      expect(info?.isActive).toBe(true);
      expect(info?.chainId).toBe(BigInt(8453));
    });

    test('should return null for non-delegated account', async () => {
      const mockPublicClient = (manager as any).publicClient;
      mockPublicClient.getBytecode.mockResolvedValue(null);
      mockPublicClient.readContract.mockResolvedValue(
        '0x0000000000000000000000000000000000000000',
      );

      const info = await manager.getDelegationInfo(testAddress);

      expect(info).toBeNull();
    });
  });
});
