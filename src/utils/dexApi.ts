/**
 * Unified DEX API constants and utilities
 * Provides token addresses and formatting functions for DCA operations
 */

import type { Address } from 'viem';

// Token addresses on Base chain
export const TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address,
  WETH: '0x4200000000000000000000000000000000000006' as Address,
} as const;

// Platform configuration
export const PLATFORM_FEE_PERCENTAGE = 0.1; // 0.1% platform fee
export const PLATFORM_FEE_RECIPIENT =
  '0x52C8FF44260056f896e20D8a43610dd88f05701b' as Address;

// OpenOcean API configuration
export const OPENOCEAN_BASE_URL = 'https://open-api.openocean.finance/v3';
export const OPENOCEAN_CHAIN_ID = 8453; // Base chain

/**
 * Format token amount from raw units to human readable
 * @param amount - Raw token amount (e.g., 1000000 for 1 USDC)
 * @param decimals - Token decimals (default 6 for USDC)
 * @returns Formatted string with proper decimal places
 */
export function formatTokenAmount(
  amount: bigint | string | number,
  decimals = 6,
): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  // Format fractional part with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

  // Remove trailing zeros and decimal point if not needed
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  if (trimmedFractional === '') {
    return wholePart.toString();
  }

  return `${wholePart}.${trimmedFractional}`;
}

/**
 * Parse human readable amount to raw token units
 * @param amount - Human readable amount (e.g., "1.5")
 * @param decimals - Token decimals (default 6 for USDC)
 * @returns Raw token amount as bigint
 */
export function parseTokenAmount(
  amount: string | number,
  decimals = 6,
): bigint {
  const [wholePart, fractionalPart = ''] = amount.toString().split('.');
  const paddedFractional = fractionalPart
    .padEnd(decimals, '0')
    .slice(0, decimals);
  const rawAmount = `${wholePart}${paddedFractional}`;
  return BigInt(rawAmount);
}

/**
 * Calculate price impact color based on percentage
 * @param impact - Price impact percentage
 * @returns Tailwind color class
 */
export function getPriceImpactColor(impact: number): string {
  if (impact < 0.1) return 'text-green-400';
  if (impact < 0.5) return 'text-yellow-400';
  if (impact < 1) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Format USD value
 * @param value - Value in USD
 * @returns Formatted string with $ symbol
 */
export function formatUsdValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Get token symbol from address
 * @param address - Token contract address
 * @returns Token symbol or shortened address
 */
export function getTokenSymbol(address: string): string {
  const normalizedAddress = address.toLowerCase();

  if (normalizedAddress === TOKENS.USDC.toLowerCase()) return 'USDC';
  if (normalizedAddress === TOKENS.SPX6900.toLowerCase()) return 'SPX6900';
  if (normalizedAddress === TOKENS.WETH.toLowerCase()) return 'WETH';

  // Return shortened address for unknown tokens
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
