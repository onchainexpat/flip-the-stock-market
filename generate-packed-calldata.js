#!/usr/bin/env node

import { encodeFunctionData, parseAbi } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

console.log('🔧 Generating packed execution calldata...');
console.log('');

try {
  // Generate the transfer calldata
  const transferAbi = parseAbi([
    'function transfer(address to, uint256 amount) external returns (bool)',
  ]);

  const transferCalldata = encodeFunctionData({
    abi: transferAbi,
    functionName: 'transfer',
    args: [EXTERNAL_WALLET, BigInt(USDC_AMOUNT)],
  });

  // Method 4: Pack target address + value + calldata
  // Format: [20 bytes target][32 bytes value][remaining bytes calldata]
  const targetBytes = USDC_CONTRACT.toLowerCase(); // 20 bytes (40 hex chars)
  const valueBytes = '0'.repeat(64); // 32 bytes of zeros (no ETH value)
  const calldataBytes = transferCalldata.slice(2); // Remove 0x prefix

  const packedCalldata = `0x${targetBytes.slice(2)}${valueBytes}${calldataBytes}`;

  console.log('Method 4 - Packed execution (target + value + calldata):');
  console.log('execute: 0');
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log('executionCalldata:', packedCalldata);
  console.log('');
  console.log('Calldata breakdown:');
  console.log('- Target (20 bytes):', targetBytes);
  console.log('- Value (32 bytes):', `0x${valueBytes}`);
  console.log('- Calldata:', transferCalldata);
  console.log('');

  // Method 5: Try executeFromExecutor function if available
  console.log('Method 5 - Alternative: Look for executeFromExecutor function');
  console.log('If you see executeFromExecutor in the contract functions, use:');
  console.log('payableAmount: 0');
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log('executionCalldata:', packedCalldata);
} catch (error) {
  console.error('Error:', error);
}
