#!/usr/bin/env node

// Generate transaction data for sweeping USDC from old smart wallet

import { encodeFunctionData } from 'viem';

const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

// ERC-20 transfer function ABI
const transferAbi = {
  name: 'transfer',
  type: 'function',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};

try {
  // Encode the transfer function call
  const transferData = encodeFunctionData({
    abi: [transferAbi],
    functionName: 'transfer',
    args: [EXTERNAL_WALLET, BigInt(USDC_AMOUNT)],
  });

  console.log('🔧 Basescan Contract Interaction Parameters:');
  console.log('');
  console.log('Function: execute');
  console.log('Parameters:');
  console.log('  to: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  console.log('  value: 0');
  console.log(`  data: ${transferData}`);
  console.log('');
  console.log('This will transfer 2.00 USDC to your external wallet');
  console.log(`Target: ${EXTERNAL_WALLET}`);
  console.log(`Amount: ${USDC_AMOUNT} (2.00 USDC)`);
} catch (error) {
  console.error('Error generating data:', error);
}
