#!/usr/bin/env node

// Sweep USDC from old smart wallet to external wallet
// Run with: node sweep-old-wallet.js

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const OLD_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const EXTERNAL_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

async function sweepOldWallet() {
  console.log('🧹 Sweeping USDC from old smart wallet...');
  console.log('📍 Old smart wallet:', OLD_SMART_WALLET);
  console.log('📍 External wallet:', EXTERNAL_WALLET);

  try {
    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(`https://rpc.zerodev.app/api/v1/${ZERODEV_PROJECT_ID}`),
    });

    // Check current balance
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: [
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [OLD_SMART_WALLET],
    });

    const balanceFormatted = Number(balance) / 1000000;
    console.log(`💰 Current USDC balance: ${balanceFormatted} USDC`);

    if (Number(balance) === 0) {
      console.log('✅ No USDC to sweep');
      return;
    }

    // This would require the private key/signer from the original setup
    console.log('⚠️ Manual sweep required:');
    console.log('1. Connect your external wallet to a dApp like DeBank');
    console.log('2. Import/connect the old smart wallet as a contract wallet');
    console.log(
      '3. Transfer 2.00 USDC from old smart wallet to external wallet',
    );
    console.log(`   From: ${OLD_SMART_WALLET}`);
    console.log(`   To: ${EXTERNAL_WALLET}`);
    console.log(`   Amount: ${balanceFormatted} USDC`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sweepOldWallet();
