#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const FAILED_TX =
  '0x01294468361f7e4dd34ba09808c7b611557281d0d5c7506f930e6e914ad54e5a';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Analyzing failed transaction:', FAILED_TX);

try {
  const tx = await client.getTransaction({ hash: FAILED_TX });
  const receipt = await client.getTransactionReceipt({ hash: FAILED_TX });

  console.log('\n📄 Transaction Details:');
  console.log('From:', tx.from);
  console.log('To:', tx.to);
  console.log('Value:', tx.value.toString());
  console.log('Gas Limit:', tx.gas.toString());
  console.log('Gas Price:', tx.gasPrice?.toString());

  console.log('\n📋 Transaction Receipt:');
  console.log(
    'Status:',
    receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED',
  );
  console.log('Gas Used:', receipt.gasUsed.toString());
  console.log('Effective Gas Price:', receipt.effectiveGasPrice.toString());

  if (receipt.status === 'reverted') {
    console.log('\n❌ TRANSACTION REVERTED');
    console.log('This confirms the execution failed');
  }

  // Check if this looks like a paymaster/sponsored transaction
  if (tx.gasPrice && BigInt(tx.gasPrice) === 0n) {
    console.log(
      '\n💡 This appears to be a sponsored transaction (gas price = 0)',
    );
  } else {
    console.log('\n💰 Gas was paid by the sender');
  }

  console.log('\n🔍 KERNEL VERSION ANALYSIS:');
  console.log('The transaction failure could be due to:');
  console.log('1. Kernel version mismatch between paymaster config and wallet');
  console.log(
    '2. ZeroDev paymaster configured for KERNEL_V3_0 but wallet uses KERNEL_V3_1',
  );
  console.log('3. Different entry point versions between kernel versions');
  console.log('4. Authorization/permission issues specific to kernel version');
} catch (error) {
  console.error('❌ Error checking transaction:', error.message);
}
