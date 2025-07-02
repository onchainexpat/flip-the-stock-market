import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Make React globally available
global.React = React;

// Mock environment variables for testing
process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-privy-app-id';
process.env.NEXT_PUBLIC_CDP_API_KEY = 'test-cdp-api-key';
process.env.NEXT_PUBLIC_WC_PROJECT_ID = 'test-wc-project-id';
process.env.NEXT_PUBLIC_EIP7702_PROXY_ADDRESS =
  '0x1234567890abcdef1234567890abcdef12345678';
process.env.NEXT_PUBLIC_IMPLEMENTATION_ADDRESS =
  '0xabcdef1234567890abcdef1234567890abcdef12';
process.env.PRIVY_TEST_EMAIL = 'test@example.com';
process.env.PRIVY_TEST_CODE = '123456';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    custom: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    custom: vi.fn(),
  },
}));

// Mock Privy hooks
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    signMessage: vi.fn(),
  }),
  useWallets: () => ({
    wallets: [],
  }),
  useLoginWithEmail: () => ({
    sendCode: vi.fn(),
    loginWithCode: vi.fn(),
    state: {
      status: 'initial',
    },
  }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: null,
    isConnected: false,
  }),
  useWalletClient: () => ({
    data: null,
    isLoading: false,
  }),
  useSignMessage: () => ({
    signMessageAsync: vi.fn(),
  }),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBytecode: vi.fn(),
    getTransactionCount: vi.fn(),
    readContract: vi.fn(),
    estimateGas: vi.fn(),
  })),
  createWalletClient: vi.fn(),
  http: vi.fn(),
  encodeFunctionData: vi.fn(),
  keccak256: vi.fn(),
  toHex: vi.fn(),
  concat: vi.fn(),
  pad: vi.fn(),
  toBytes: vi.fn(),
}));

// Mock viem chains
vi.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

// Mock OnchainKit
vi.mock('@coinbase/onchainkit', () => ({
  OnchainKitProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => children,
  getDefaultConfig: vi.fn(() => ({})),
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock window.crypto for testing
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
