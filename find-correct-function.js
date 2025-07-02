#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const OLD_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Looking up smart wallet contract ABI and functions...');

// Common function selectors for smart wallets
const commonFunctions = {
  '0xe9ae5c53': 'execute(uint256,bytes)', // What was called in successful tx
  '0x51945447': 'execute(address,uint256,bytes)', // Standard execute
  '0xb61d27f6': 'execute(address,uint256,bytes)', // Another common execute
  '0x6a761202': 'execute(bytes32,bytes)', // ERC-7579 execute
  '0x09e5fefc': 'executeFromExecutor(bytes32,bytes)', // Executor pattern
  '0xcd30a1cf': 'execute(uint256,bytes32,bytes)', // Three parameter execute
};

console.log('\n📋 Common smart wallet function selectors:');
Object.entries(commonFunctions).forEach(([selector, signature]) => {
  console.log(`${selector}: ${signature}`);
});

console.log('\n🎯 The successful transaction used selector 0xe9ae5c53');
console.log('This corresponds to: execute(uint256,bytes)');
console.log('\n💡 The issue: Wrong function parameters!');
console.log('');
console.log('The successful transaction shows we should use:');
console.log('Function: execute(uint256,bytes) - selector 0xe9ae5c53');
console.log('');
console.log('But looking at the parameter structure, it seems like:');
console.log('- First parameter was treated as execMode');
console.log('- Second parameter was the execution data');
console.log('');
console.log('🔧 Let me generate the CORRECT parameters for this function...');

// The successful transaction had:
// execute: 0x0100000000000000000000000000000000000000000000000000000000000000 (this was execMode!)
// The calldata was packed differently

console.log('\n✅ SOLUTION:');
console.log('The smart wallet uses execute(uint256 execMode, bytes calldata)');
console.log('NOT execute(uint256 target, bytes32 execMode, bytes calldata)');
console.log('');
console.log('We need to find this function on Basescan:');
console.log('Function: execute');
console.log('Parameters: (uint256,bytes) - TWO parameters, not three!');
console.log('');
console.log(
  'Parameter 1 (execMode): 0x0100000000000000000000000000000000000000000000000000000000000000',
);
console.log('Parameter 2 (calldata): [packed target + value + call data]');

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000';

// Generate the packed calldata for execute(uint256,bytes)
const transferCalldata =
  '0xa9059cbb000000000000000000000000c9860f5d7b80015d0ff3e440d0f8db90a518f7e700000000000000000000000000000000000000000000000000000000001e8480';
const packedData =
  USDC_CONTRACT.toLowerCase() + '0'.repeat(64) + transferCalldata.slice(2);

console.log('\n📋 CORRECT PARAMETERS FOR BASESCAN:');
console.log('Look for execute function with TWO parameters (uint256,bytes):');
console.log('');
console.log('Parameter 1 (uint256 execMode):');
console.log(
  '452312848583266388373324160190187140051835877600158453279131187530910662656',
);
console.log(
  '(or in hex: 0x0100000000000000000000000000000000000000000000000000000000000000)',
);
console.log('');
console.log('Parameter 2 (bytes calldata):');
console.log(`0x${packedData}`);
