#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const OLD_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const YOUR_EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Checking smart wallet ownership and permissions...');
console.log('Smart wallet:', OLD_WALLET);
console.log('Your external wallet:', YOUR_EXTERNAL_WALLET);
console.log('');

try {
  // Common owner functions to try
  const ownerFunctions = [
    {
      name: 'owner',
      abi: [
        {
          constant: true,
          inputs: [],
          name: 'owner',
          outputs: [{ name: '', type: 'address' }],
          type: 'function',
        },
      ],
    },
    {
      name: 'getOwner',
      abi: [
        {
          constant: true,
          inputs: [],
          name: 'getOwner',
          outputs: [{ name: '', type: 'address' }],
          type: 'function',
        },
      ],
    },
    {
      name: 'getOwners',
      abi: [
        {
          constant: true,
          inputs: [],
          name: 'getOwners',
          outputs: [{ name: '', type: 'address[]' }],
          type: 'function',
        },
      ],
    },
  ];

  for (const func of ownerFunctions) {
    try {
      console.log(`Trying ${func.name}()...`);
      const result = await client.readContract({
        address: OLD_WALLET,
        abi: func.abi,
        functionName: func.name,
      });

      console.log(`✅ ${func.name}():`, result);

      if (Array.isArray(result)) {
        const isOwner = result.some(
          (addr) => addr.toLowerCase() === YOUR_EXTERNAL_WALLET.toLowerCase(),
        );
        console.log(`You are ${isOwner ? '✅ AN OWNER' : '❌ NOT AN OWNER'}`);
      } else {
        const isOwner =
          result.toLowerCase() === YOUR_EXTERNAL_WALLET.toLowerCase();
        console.log(`You are ${isOwner ? '✅ THE OWNER' : '❌ NOT THE OWNER'}`);
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${func.name}() not available or failed`);
    }
  }

  // Check if there's a validation function
  console.log('Checking validation functions...');
  try {
    const isValidSig = await client.readContract({
      address: OLD_WALLET,
      abi: [
        {
          constant: true,
          inputs: [{ name: '_address', type: 'address' }],
          name: 'isValidSignature',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function',
        },
      ],
      functionName: 'isValidSignature',
      args: [YOUR_EXTERNAL_WALLET],
    });
    console.log('✅ isValidSignature:', isValidSig);
  } catch (error) {
    console.log('❌ isValidSignature not available');
  }
} catch (error) {
  console.error('❌ Error checking ownership:', error.message);
}

console.log('');
console.log('💡 NEXT STEPS:');
console.log('1. If you are the owner, the execMode might be wrong');
console.log('2. If you are not the owner, you cannot execute transactions');
console.log('3. This might be why transactions are reverting');
console.log('');
console.log(
  '🎯 LAST RESORT: Try executeFromExecutor with different parameters:',
);
console.log('payableAmount: 0');
console.log(
  'execMode: 0x0000000000000000000000000000000000000000000000000000000000000001',
);
console.log(
  'executionCalldata: 0x833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000000a9059cbb000000000000000000000000c9860f5d7b80015d0ff3e440d0f8db90a518f7e700000000000000000000000000000000000000000000000000000000001e8480',
);
