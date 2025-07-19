// use NODE_ENV to not have to change config based on where it's deployed
export const NEXT_PUBLIC_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://dcaspx.com';

// DCA-specific environment variables
export const NEXT_PUBLIC_PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
export const NEXT_PUBLIC_ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
export const NEXT_PUBLIC_ZERODEV_RPC_URL = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL;
export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const AGENT_KEY_ENCRYPTION_SECRET = process.env.AGENT_KEY_ENCRYPTION_SECRET;
export const CRON_SECRET_KEY = process.env.CRON_SECRET_KEY;