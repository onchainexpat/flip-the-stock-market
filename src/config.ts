// use NODE_ENV to not have to change config based on where it's deployed
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://flipthestockmarket.com';

// Coinbase OnchainKit
export const NEXT_PUBLIC_CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY;
export const NEXT_PUBLIC_WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
export const NEXT_PUBLIC_CDP_PROJECT_ID =
  process.env.NEXT_PUBLIC_CDP_PROJECT_ID;

// Privy Authentication
export const NEXT_PUBLIC_PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// ZeroDev Account Abstraction
export const NEXT_PUBLIC_ZERODEV_PROJECT_ID =
  process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

// Other APIs
export const NEXT_PUBLIC_DUNE_API_KEY = process.env.NEXT_PUBLIC_DUNE_API_KEY;
export const NEXT_PUBLIC_ZKP2P_API_ENDPOINT =
  process.env.NEXT_PUBLIC_ZKP2P_API_ENDPOINT;
