#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const SUCCESS_TX =
  '0xc00f51dc72747ebeb31ae40b4951000d8085deecff06de95230537ed354df51f';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Analyzing successful transaction:', SUCCESS_TX);

try {
  const tx = await client.getTransaction({ hash: SUCCESS_TX });
  const receipt = await client.getTransactionReceipt({ hash: SUCCESS_TX });

  console.log('\n📄 Successful Transaction Analysis:');
  console.log(
    'Status:',
    receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED',
  );
  console.log('Input data:', tx.input);
  console.log('Input length:', tx.input.length, 'bytes');

  // Decode the input data to understand the execute function call
  const inputData = tx.input;

  console.log('\n🔍 Analyzing input data structure:');
  console.log('Function selector (first 4 bytes):', inputData.slice(0, 10));

  // The successful transaction input data shows us the correct format
  if (inputData.length > 10) {
    const params = inputData.slice(10); // Remove function selector
    console.log('Parameters data:', params);
    console.log('Parameters length:', params.length / 2, 'bytes');

    // Try to decode as execute(uint256,bytes32,bytes)
    try {
      // First parameter: uint256 (32 bytes)
      const param1 = '0x' + params.slice(0, 64);
      console.log(
        'Parameter 1 (execute):',
        param1,
        '=>',
        BigInt(param1).toString(),
      );

      // Second parameter: bytes32 (32 bytes)
      const param2 = '0x' + params.slice(64, 128);
      console.log('Parameter 2 (execMode):', param2);

      // Third parameter: bytes (offset + length + data)
      const param3Offset = Number.parseInt(params.slice(128, 192), 16) * 2; // Convert to hex chars
      const param3Length =
        Number.parseInt(params.slice(param3Offset, param3Offset + 64), 16) * 2;
      const param3Data =
        '0x' +
        params.slice(param3Offset + 64, param3Offset + 64 + param3Length);
      console.log('Parameter 3 (executionCalldata):', param3Data);
    } catch (decodeError) {
      console.log('Could not decode parameters:', decodeError.message);
    }
  }
} catch (error) {
  console.error('❌ Error analyzing transaction:', error.message);
}
