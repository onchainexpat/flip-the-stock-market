#!/usr/bin/env node

import { keccak256, toHex } from 'viem';

// Function signatures to check
const functions = [
  'execute(uint256,bytes32,bytes)',
  'executeFromExecutor(bytes32,bytes)',
  'execute(uint256,bytes)',
  'execute(bytes32,bytes)',
  'executeUserOp(address,uint256,bytes)',
  'execute(address,uint256,bytes)',
];

console.log('🔍 Function selector analysis:');
console.log('');

functions.forEach((sig) => {
  const hash = keccak256(toHex(sig));
  const selector = hash.slice(0, 10);
  console.log(`${selector}: ${sig}`);
});

console.log('');
console.log('🎯 From successful transaction: 0xe9ae5c53');
console.log('🔍 From screenshot execute: 0x9ae5c53 (missing leading zero?)');

// The successful transaction used a 2-parameter function
console.log('');
console.log(
  '💡 Analysis: The successful transaction called a different function',
);
console.log('The selector 0xe9ae5c53 suggests execute(uint256,bytes)');
console.log('But this function is not visible in the Basescan interface!');
console.log('');
console.log('🎯 SOLUTION: Try executeFromExecutor function instead');
console.log('This might be the correct function for external execution');

// Generate parameters for executeFromExecutor(bytes32,bytes)
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const transferCalldata =
  '0xa9059cbb000000000000000000000000c9860f5d7b80015d0ff3e440d0f8db90a518f7e700000000000000000000000000000000000000000000000000000000001e8480';

// For executeFromExecutor, we need bytes32 execMode and bytes calldata
const execMode =
  '0x0100000000000000000000000000000000000000000000000000000000000000';
const packedCalldata =
  USDC_CONTRACT.toLowerCase() + '0'.repeat(64) + transferCalldata.slice(2);

console.log('');
console.log('📋 TRY executeFromExecutor FUNCTION:');
console.log('Parameter 1 (bytes32 execMode):', execMode);
console.log('Parameter 2 (bytes calldata): 0x' + packedCalldata);
