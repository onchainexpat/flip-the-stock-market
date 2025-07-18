// use NODE_ENV to not have to change config based on where it's deployed
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://flipthestockmarket.com';
// Add your API KEY from the Coinbase Developer Portal
export const NEXT_PUBLIC_CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY;
export const NEXT_PUBLIC_WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
export const NEXT_PUBLIC_CDP_PROJECT_ID =
  process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
export const NEXT_PUBLIC_DUNE_API_KEY = process.env.NEXT_PUBLIC_DUNE_API_KEY;

// Privy Configuration
export const NEXT_PUBLIC_PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// ZeroDev Configuration
export const NEXT_PUBLIC_ZERODEV_PROJECT_ID =
  process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
export const NEXT_PUBLIC_ZERODEV_API_KEY =
  process.env.NEXT_PUBLIC_ZERODEV_API_KEY;
export const NEXT_PUBLIC_ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL;
export const NEXT_PUBLIC_BASE_BUNDLER_URL =
  process.env.NEXT_PUBLIC_BASE_BUNDLER_URL;
export const NEXT_PUBLIC_BASE_PAYMASTER_URL =
  process.env.NEXT_PUBLIC_BASE_PAYMASTER_URL;

// 0x API removed - using OpenOcean exclusively for security
// export const NEXT_PUBLIC_0X_API_KEY = process.env.NEXT_PUBLIC_0X_API_KEY;

// Gelato Configuration
export const GELATO_SPONSOR_API_KEY = process.env.GELATO_SPONSOR_API_KEY;
