// use NODE_ENV to not have to change config based on where it's deployed
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://flipthestockmarket.com';
// Add your API KEY from the Coinbase Developer Portal
export const NEXT_PUBLIC_CDP_API_KEY = process.env.NEXT_PUBLIC_CDP_API_KEY;
export const NEXT_PUBLIC_WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
export const NEXT_PUBLIC_CDP_PROJECT_ID = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
export const NEXT_PUBLIC_DUNE_API_KEY = process.env.NEXT_PUBLIC_DUNE_API_KEY;