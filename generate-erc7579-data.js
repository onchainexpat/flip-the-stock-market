#!/usr/bin/env node

// Generate ERC-7579 execution data for sweeping USDC

import { encodeAbiParameters, encodeFunctionData } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const USDC_AMOUNT = '2000000'; // 2.00 USDC in 6 decimals

try {
  // ERC-7579 execution modes
  // Mode 0x01 = CALLTYPE_SINGLE (single call)
  const execMode =
    '0x0100000000000000000000000000000000000000000000000000000000000000';

  // Generate USDC transfer data
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

  // Encode execution calldata: target + value + calldata
  const executionCalldata = encodeAbiParameters(
    [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ],
    [USDC_CONTRACT, 0n, transferCalldata],
  );

  console.log('🔧 ERC-7579 Basescan Parameters:');
  console.log('');
  console.log('Function: execute');
  console.log('Parameters:');
  console.log(`  execMode: ${execMode}`);
  console.log(`  executionCalldata: ${executionCalldata}`);
  console.log('');
  console.log('This will transfer 2.00 USDC to your external wallet');
  console.log(`From: Old smart wallet`);
  console.log(`To: ${EXTERNAL_WALLET}`);
  console.log(`Amount: ${Number(USDC_AMOUNT) / 1000000} USDC`);
} catch (error) {
  console.error('Error generating data:', error);

  // Fallback manual encoding
  console.log('');
  console.log('📝 Manual Parameters (if script fails):');
  console.log('');
  console.log('execMode (bytes32):');
  console.log(
    '0x0100000000000000000000000000000000000000000000000000000000000000',
  );
  console.log('');
  console.log('executionCalldata (bytes):');
  console.log('Use the transfer function data from previous attempt');
}
