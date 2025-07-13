#!/usr/bin/env bun

/**
 * Transfer SPX tokens from smart wallet to user wallet
 */

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
} from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// Test configuration
const TEST_CONFIG = {
  // Same deterministic private key as before
  AGENT_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex,
  USER_WALLET: '0x742f96b3e80a4b3633c7f3ec5bd1b5f9b6b0123e' as Address,
  SPX_TOKEN: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C' as Address,
};

async function transferSPXToUser() {
  console.log('🔄 Transferring SPX tokens to user wallet...\n');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });

    const agentAccount = privateKeyToAccount(TEST_CONFIG.AGENT_PRIVATE_KEY);
    
    // Create ECDSA validator
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: agentAccount,
      entryPoint: getEntryPoint('0.7'),
      kernelVersion: KERNEL_V3_2,
    });

    // Create kernel account
    const smartWallet = await createKernelAccount(publicClient, {
      entryPoint: getEntryPoint('0.7'),
      plugins: {
        sudo: ecdsaValidator,
      },
      kernelVersion: KERNEL_V3_2,
    });

    console.log('🏠 Smart wallet:', smartWallet.address);

    // Check SPX balance
    const spxBalance = await publicClient.readContract({
      address: TEST_CONFIG.SPX_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartWallet.address],
    });

    console.log(`💰 SPX Balance: ${(Number(spxBalance) / 1e8).toFixed(8)} SPX`);

    if (spxBalance === 0n) {
      console.log('❌ No SPX tokens to transfer');
      return;
    }

    // Create kernel client
    const kernelClient = createKernelAccountClient({
      account: smartWallet,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC_URL),
    });

    // Transfer all SPX to user
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [TEST_CONFIG.USER_WALLET, spxBalance],
    });

    console.log(`\n📤 Transferring ${(Number(spxBalance) / 1e8).toFixed(8)} SPX to user wallet...`);
    
    const txHash = await kernelClient.sendUserOperation({
      account: smartWallet,
      calls: [{
        to: TEST_CONFIG.SPX_TOKEN,
        value: 0n,
        data: transferData,
      }],
    });

    console.log('✅ Transfer submitted:', txHash);
    console.log(`📊 View on Basescan: https://basescan.org/tx/${txHash}`);

    // Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check final balances
    const finalSmartWalletSPX = await publicClient.readContract({
      address: TEST_CONFIG.SPX_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartWallet.address],
    });

    const finalUserSPX = await publicClient.readContract({
      address: TEST_CONFIG.SPX_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [TEST_CONFIG.USER_WALLET],
    });

    console.log('\n📊 Final balances:');
    console.log(`   Smart wallet SPX: ${(Number(finalSmartWalletSPX) / 1e8).toFixed(8)} SPX`);
    console.log(`   User wallet SPX: ${(Number(finalUserSPX) / 1e8).toFixed(8)} SPX`);

    console.log('\n✅ Transfer complete!');

  } catch (error) {
    console.error('❌ Transfer failed:', error);
  }
}

transferSPXToUser();