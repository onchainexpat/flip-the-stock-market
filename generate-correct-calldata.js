#!/usr/bin/env node

import { encodeFunctionData, parseAbi } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

console.log(
  '🔧 Generating different execution formats for the smart wallet...',
);
console.log('');

try {
  // Method 1: Direct USDC transfer calldata (what we tried)
  const transferAbi = parseAbi([
    'function transfer(address to, uint256 amount) external returns (bool)',
  ]);

  const transferCalldata = encodeFunctionData({
    abi: transferAbi,
    functionName: 'transfer',
    args: [EXTERNAL_WALLET, BigInt(USDC_AMOUNT)],
  });

  console.log('Method 1 - Direct call to USDC contract:');
  console.log('execute: 0');
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log('executionCalldata:', transferCalldata);
  console.log('');

  // Method 2: Try different execMode (single execution mode)
  console.log('Method 2 - Different execMode:');
  console.log('execute: 0');
  console.log(
    'execMode: 0x0000000000000000000000000000000000000000000000000000000000000001',
  );
  console.log('executionCalldata:', transferCalldata);
  console.log('');

  // Method 3: Try with target address in the execute field
  console.log('Method 3 - USDC contract in execute field:');
  console.log(`execute: ${USDC_CONTRACT}`);
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log('executionCalldata:', transferCalldata);
  console.log('');

  // Method 4: Try packed execution data (target + value + calldata)
  const packedCalldata = `${USDC_CONTRACT.slice(2).toLowerCase()}${'0'.repeat(64)}${transferCalldata.slice(2)}`;
  console.log('Method 4 - Packed execution:');
  console.log('execute: 0');
  console.log(
    'execMode: 0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log(`executionCalldata: 0x${packedCalldata}`);
  console.log('');

  console.log('💡 Try Method 3 first (USDC contract address in execute field)');
  console.log('💡 If that fails, try Method 2 (different execMode)');
} catch (error) {
  console.error('Error:', error);
}
