#!/usr/bin/env bun

/**
 * Check wallet balances for DCA test verification
 */

import { createPublicClient, http, erc20Abi, type Address } from 'viem';
import { base } from 'viem/chains';

const TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address,
};

const WALLETS = {
  smartWallet: '0xF6c4c06A950205e77cE18f18FD01B40a51523F7a' as Address,
  userWallet: '0x742f96b3e80a4b3633c7f3ec5bd1b5f9b6b0123e' as Address,
};

async function checkBalances() {
  console.log('🔍 Checking wallet balances...\n');

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  try {
    // Check smart wallet USDC balance
    const smartWalletUSDC = await publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WALLETS.smartWallet],
    });

    // Check smart wallet SPX balance
    const smartWalletSPX = await publicClient.readContract({
      address: TOKENS.SPX6900,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WALLETS.smartWallet],
    });

    // Check user wallet USDC balance
    const userWalletUSDC = await publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WALLETS.userWallet],
    });

    // Check user wallet SPX balance
    const userWalletSPX = await publicClient.readContract({
      address: TOKENS.SPX6900,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WALLETS.userWallet],
    });

    console.log('💼 Smart Wallet:', WALLETS.smartWallet);
    console.log(`   USDC: ${(Number(smartWalletUSDC) / 1e6).toFixed(6)} USDC`);
    console.log(`   SPX: ${(Number(smartWalletSPX) / 1e8).toFixed(8)} SPX`);

    console.log('\n👤 User Wallet:', WALLETS.userWallet);
    console.log(`   USDC: ${(Number(userWalletUSDC) / 1e6).toFixed(6)} USDC`);
    console.log(`   SPX: ${(Number(userWalletSPX) / 1e8).toFixed(8)} SPX`);

    // Check transaction on Basescan
    console.log('\n🔗 Transaction verification:');
    console.log('   View on Basescan: https://basescan.org/tx/0xc9e0c6ece6a5da0aa15c682808826d6f4a74d7d8dad7ab771d41a3c9c49cbc5f');

    // Summary
    console.log('\n📊 Summary:');
    if (Number(userWalletSPX) > 0) {
      console.log('   ✅ User wallet has SPX tokens!');
      console.log(`   📈 Successfully received ${(Number(userWalletSPX) / 1e8).toFixed(8)} SPX`);
    } else {
      console.log('   ❌ No SPX tokens found in user wallet');
    }

  } catch (error) {
    console.error('❌ Error checking balances:', error);
  }
}

checkBalances();