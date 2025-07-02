#!/usr/bin/env node

import { encodeFunctionData, parseAbi } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

console.log('🎯 DIFFERENT APPROACH: Direct USDC contract execution');
console.log('');
console.log(
  'The problem might be that we need to call the USDC contract directly',
);
console.log('from the smart wallet, not pack everything into calldata.');
console.log('');

// Generate simple USDC transfer calldata
const transferAbi = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

const transferCalldata = encodeFunctionData({
  abi: transferAbi,
  functionName: 'transfer',
  args: [EXTERNAL_WALLET, BigInt(USDC_AMOUNT)],
});

console.log('🔧 TRY THIS APPROACH:');
console.log('');
console.log('Use the regular execute function with:');
console.log('');
console.log('payableAmount (ether): 0');
console.log(
  'execMode (bytes32): 0x0000000000000000000000000000000000000000000000000000000000000001',
);
console.log('executionCalldata (bytes):', transferCalldata);
console.log('');
console.log(
  'The key difference: Use execMode ending in ...0001 instead of ...0000',
);
console.log(
  'This tells the smart wallet to execute a single call to an external contract.',
);
console.log('');
console.log('But wait - we still need to specify WHERE to call!');
console.log('');
console.log(
  '💡 ALTERNATIVE: The smart wallet might have a different execution model',
);
console.log("Let me check if there's a way to specify the target contract...");
console.log('');

// Maybe the target is encoded in the calldata itself?
// Some smart wallets expect: target(20 bytes) + value(32 bytes) + calldata
const targetPadded = USDC_CONTRACT.slice(2).toLowerCase(); // Remove 0x
const valuePadded = '0'.repeat(64); // 32 bytes of zeros
const calldataOnly = transferCalldata.slice(2); // Remove 0x

const combinedCalldata = `0x${targetPadded}${valuePadded}${calldataOnly}`;

console.log('🎯 MAYBE TRY THIS:');
console.log('payableAmount (ether): 0');
console.log(
  'execMode (bytes32): 0x0000000000000000000000000000000000000000000000000000000000000001',
);
console.log('executionCalldata (bytes):', combinedCalldata);
console.log('');
console.log('This packs: [USDC contract address][value=0][transfer calldata]');
console.log('');

console.log('🔍 OR MAYBE THE ISSUE IS AUTHORIZATION:');
console.log('The smart wallet might reject external calls unless:');
console.log('1. The transaction comes from the owner');
console.log("2. There's a valid session key");
console.log('3. The smart wallet has the right permissions');
console.log('');
console.log(
  'Double-check that your connected wallet is the owner of the smart wallet!',
);
