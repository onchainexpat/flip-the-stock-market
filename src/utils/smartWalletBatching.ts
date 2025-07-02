'use client';

import { type Address, encodeFunctionData } from 'viem';
import { erc20Abi } from 'viem';
import { PLATFORM_FEE_RECIPIENT, TOKENS } from './dexApi';

// ERC20 ABI functions we need
const ERC20_TRANSFER_SELECTOR = '0xa9059cbb'; // transfer(address,uint256)
const ERC20_APPROVE_SELECTOR = '0x095ea7b3'; // approve(address,uint256)

/**
 * Creates a batch of transactions for DCA order setup:
 * 1. Transfer USDC from external wallet to smart wallet
 * 2. Set up session key permissions for automated execution
 */
export const createDCASetupBatch = async (
  externalWalletAddress: Address,
  smartWalletAddress: Address,
  totalUSDCAmount: bigint, // Total amount in USDC (6 decimals)
  zeroXExchangeProxy: Address = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', // 0x Exchange Proxy on Base
) => {
  console.log('🔄 Creating DCA setup batch...');
  console.log('📤 External wallet:', externalWalletAddress);
  console.log('🤖 Smart wallet:', smartWalletAddress);
  console.log('💰 USDC amount:', totalUSDCAmount.toString());

  const transactions = [];

  // Transaction 1: Transfer USDC from external wallet to smart wallet
  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [smartWalletAddress, totalUSDCAmount],
  });

  transactions.push({
    to: TOKENS.USDC,
    value: 0n,
    data: transferData,
    description: 'Transfer USDC to smart wallet for DCA execution',
  });

  // Transaction 2: Approve 0x Exchange Proxy to spend USDC from smart wallet
  // This will be executed by the smart wallet after it receives the USDC
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [zeroXExchangeProxy, totalUSDCAmount],
  });

  transactions.push({
    to: TOKENS.USDC,
    value: 0n,
    data: approveData,
    description: 'Approve 0x Exchange Proxy to spend USDC for swaps',
    executeFrom: 'smart_wallet' as const, // This indicates it should be executed by smart wallet
  });

  console.log('✅ Created batch with', transactions.length, 'transactions');
  return transactions;
};

/**
 * Creates a single swap transaction that:
 * 1. Transfers platform fee to fee recipient
 * 2. Swaps USDC for SPX6900 using 0x API
 * 3. Transfers the received SPX6900 back to external wallet
 */
export const createDCASwapBatch = async (
  smartWalletAddress: Address,
  externalWalletAddress: Address,
  usdcAmount: bigint,
  swapData: string, // 0x API swap transaction data
  minSPX6900Out: bigint,
  platformFeeAmount?: bigint, // Platform fee in USDC (6 decimals)
) => {
  console.log('🔄 Creating DCA swap batch...');
  console.log('🤖 Smart wallet:', smartWalletAddress);
  console.log('📤 External wallet:', externalWalletAddress);
  console.log('💱 USDC amount:', usdcAmount.toString());
  console.log('💰 Platform fee:', platformFeeAmount?.toString() || '0');

  const transactions = [];

  // Transaction 1: Transfer platform fee to fee recipient (if applicable)
  if (platformFeeAmount && platformFeeAmount > 0n) {
    const feeTransferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [PLATFORM_FEE_RECIPIENT, platformFeeAmount],
    });

    transactions.push({
      to: TOKENS.USDC,
      value: 0n,
      data: feeTransferData,
      description: `Transfer platform fee (${platformFeeAmount.toString()} USDC) to fee recipient`,
    });
  }

  // Transaction 2: Execute the 0x swap (USDC → SPX6900)
  // The swapData contains the complete transaction to execute
  transactions.push({
    to: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as Address, // 0x Exchange Proxy
    value: 0n,
    data: swapData,
    description: 'Swap USDC for SPX6900 via 0x',
  });

  // Transaction 3: Transfer all received SPX6900 to external wallet
  // We'll use a max uint256 transfer to send all balance
  const transferSPXData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      externalWalletAddress,
      BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    ], // Max uint256
  });

  transactions.push({
    to: TOKENS.SPX6900,
    value: 0n,
    data: transferSPXData,
    description: 'Transfer received SPX6900 to external wallet',
  });

  console.log(
    '✅ Created swap batch with',
    transactions.length,
    'transactions',
  );
  return transactions;
};

/**
 * Creates a cleanup batch to sweep all remaining tokens back to external wallet
 */
export const createDCACleanupBatch = async (
  smartWalletAddress: Address,
  externalWalletAddress: Address,
) => {
  console.log('🧹 Creating DCA cleanup batch...');
  console.log('🤖 Smart wallet:', smartWalletAddress);
  console.log('📤 External wallet:', externalWalletAddress);

  const transactions = [];

  // Transfer all remaining USDC back to external wallet
  const transferUSDCData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      externalWalletAddress,
      BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    ], // Max uint256
  });

  transactions.push({
    to: TOKENS.USDC,
    value: 0n,
    data: transferUSDCData,
    description: 'Return remaining USDC to external wallet',
  });

  // Transfer all remaining SPX6900 back to external wallet
  const transferSPXData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      externalWalletAddress,
      BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    ], // Max uint256
  });

  transactions.push({
    to: TOKENS.SPX6900,
    value: 0n,
    data: transferSPXData,
    description: 'Return remaining SPX6900 to external wallet',
  });

  console.log(
    '✅ Created cleanup batch with',
    transactions.length,
    'transactions',
  );
  return transactions;
};

/**
 * Creates session key permissions for automated DCA execution
 */
export const createDCASessionPermissions = (
  smartWalletAddress: Address,
  totalUSDCAmount: bigint,
  durationInDays: number,
) => {
  const validUntil =
    Math.floor(Date.now() / 1000) + durationInDays * 24 * 60 * 60;
  const validAfter = Math.floor(Date.now() / 1000);

  return [
    {
      target: TOKENS.USDC,
      valueLimit: totalUSDCAmount,
      functionSelectors: [ERC20_TRANSFER_SELECTOR, ERC20_APPROVE_SELECTOR],
      rules: [],
    },
    {
      target: TOKENS.SPX6900,
      valueLimit: 0n, // No ETH value, just token transfers
      functionSelectors: [ERC20_TRANSFER_SELECTOR],
      rules: [],
    },
    {
      target: '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, // OpenOcean Exchange V2 on Base
      valueLimit: 0n,
      functionSelectors: ['0x'], // Allow all swap functions for OpenOcean aggregation
      rules: [],
    },
  ];
};

/**
 * Estimates gas for a batch of transactions
 */
export const estimateBatchGas = async (
  transactions: Array<{
    to: Address;
    value: bigint;
    data: string;
  }>,
) => {
  // Simple estimation - each transaction uses roughly 50k gas
  // This would be more accurate with actual gas estimation
  const baseGasPerTx = 50000;
  const totalGas = transactions.length * baseGasPerTx;

  console.log('⛽ Estimated gas for batch:', totalGas);
  return totalGas;
};
