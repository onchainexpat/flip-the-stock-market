#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const TRANSACTION_HASH =
  '0x00bde62216911be41dd2216339ff591e2840bcc4808ae6ee64b29d52ee473c19';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Checking transaction:', TRANSACTION_HASH);

try {
  // Get transaction details
  const tx = await client.getTransaction({ hash: TRANSACTION_HASH });
  console.log('\n📄 Transaction Details:');
  console.log('From:', tx.from);
  console.log('To:', tx.to);
  console.log('Value:', tx.value.toString());
  console.log('Gas Used:', tx.gas.toString());
  console.log('Input data length:', tx.input.length);

  // Get transaction receipt
  const receipt = await client.getTransactionReceipt({
    hash: TRANSACTION_HASH,
  });
  console.log('\n📋 Transaction Receipt:');
  console.log(
    'Status:',
    receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED',
  );
  console.log('Gas Used:', receipt.gasUsed.toString());
  console.log('Logs count:', receipt.logs.length);

  if (receipt.logs.length > 0) {
    console.log('\n📝 Transaction Logs:');
    receipt.logs.forEach((log, i) => {
      console.log(`Log ${i + 1}:`);
      console.log('  Address:', log.address);
      console.log('  Topics:', log.topics.length);
      console.log('  Data:', log.data);
    });
  }

  // If transaction failed, try to get the revert reason
  if (receipt.status === 'reverted') {
    console.log('\n❌ Transaction failed - checking revert reason...');
    try {
      // Try to simulate the transaction to get the revert reason
      await client.call({
        to: tx.to,
        data: tx.input,
        from: tx.from,
        value: tx.value,
        blockNumber: receipt.blockNumber - 1n,
      });
    } catch (error) {
      console.log('Revert reason:', error.message);
    }
  }
} catch (error) {
  console.error('❌ Error checking transaction:', error.message);
}
