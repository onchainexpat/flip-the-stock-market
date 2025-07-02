#!/usr/bin/env node

// Generate corrected calldata for the smart wallet

import { encodeFunctionData } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

try {
  // Just the USDC transfer function call data
  const transferAbi = {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  };

  const transferCalldata = encodeFunctionData({
    abi: [transferAbi],
    functionName: 'transfer',
    args: [EXTERNAL_WALLET, BigInt(USDC_AMOUNT)],
  });

  console.log('🔧 Corrected Basescan Parameters:');
  console.log('');
  console.log('Try Method 1 - Simple execution:');
  console.log(`execute: ${USDC_CONTRACT}`);
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log(`executionCalldata: ${transferCalldata}`);
  console.log('');

  console.log('Try Method 2 - If above fails, use different execMode:');
  console.log(`execute: ${USDC_CONTRACT}`);
  console.log(
    'execMode: 0x0000000000000000000000000000000000000000000000000000000000000001',
  );
  console.log(`executionCalldata: ${transferCalldata}`);
  console.log('');

  console.log('Raw transfer data (if you need it):');
  console.log(`${transferCalldata}`);
  console.log('');
  console.log(`This transfers 2.00 USDC to: ${EXTERNAL_WALLET}`);
} catch (error) {
  console.error('Error:', error);
}
