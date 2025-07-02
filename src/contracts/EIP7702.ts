import type { Address, Hex } from 'viem';

// EIP-7702 Contract Addresses
export const EIP7702_PROXY_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_EIP7702_PROXY_ADDRESS as Address) ||
  '0x0000000000000000000000000000000000000000'; // Replace with actual deployed address
export const DEFAULT_IMPLEMENTATION_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_IMPLEMENTATION_ADDRESS as Address) ||
  '0x0000000000000000000000000000000000'; // Replace with actual implementation

// EIP-7702 Authorization structure
export interface EIP7702Authorization {
  chainId: bigint;
  address: Address;
  nonce: bigint;
  v: bigint;
  r: Hex;
  s: Hex;
}

// EIP7702Proxy ABI - Based on Base's implementation
export const EIP7702ProxyABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'initData',
        type: 'bytes',
      },
      {
        internalType: 'address',
        name: 'accountStateValidator',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'signature',
        type: 'bytes',
      },
      {
        internalType: 'bool',
        name: 'crossChain',
        type: 'bool',
      },
    ],
    name: 'setImplementation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'getImplementation',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proxyStorage',
    outputs: [
      {
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'fallback',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
] as const;

// NonceTracker ABI
export const NonceTrackerABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'getNonce',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'incrementNonce',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Default smart wallet implementation ABI (minimal interface)
export const SmartWalletImplementationABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'execute',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        internalType: 'struct Call[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'executeBatch',
    outputs: [
      {
        internalType: 'bytes[]',
        name: '',
        type: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Types for function parameters
export interface SetImplementationParams {
  implementation: Address;
  initData: Hex;
  accountStateValidator: Address;
  signature: Hex;
  crossChain: boolean;
}

export interface Call {
  to: Address;
  value: bigint;
  data: Hex;
}

// EIP-7702 specific types
export interface EIP7702DelegationInfo {
  isActive: boolean;
  implementation: Address;
  chainId: bigint;
  validUntil?: bigint;
}

export interface EIP7702SignatureRequest {
  chainId: bigint;
  delegateAddress: Address;
  nonce: bigint;
  expiry?: bigint;
}

// Helper function to encode EIP-7702 authorization
export function encodeEIP7702Authorization(auth: EIP7702Authorization): Hex {
  // Implementation would encode the authorization according to EIP-7702 spec
  // This is a placeholder - actual implementation depends on the exact encoding format
  return '0x' as Hex;
}

// Interface IDs for smart wallet features
export const INTERFACE_IDS = {
  ERC165: '0x01ffc9a7',
  ERC1271: '0x1626ba7e',
  ERC4337: '0x6faff5f1',
  SESSION_KEY: '0x51945447',
} as const;
