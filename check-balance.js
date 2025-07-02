#!/usr/bin/env node

import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

const OLD_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

console.log('🔍 Checking old smart wallet balance...');
console.log('Wallet:', OLD_WALLET);
console.log('USDC Contract:', USDC_ADDRESS);

try {
  // Check if wallet is deployed
  const code = await client.getBytecode({ address: OLD_WALLET });
  const isDeployed = code && code !== '0x' && code.length > 2;
  console.log('Is deployed:', isDeployed);

  if (!isDeployed) {
    console.log('❌ Wallet is not deployed - no funds to migrate');
    process.exit(0);
  }

  // Check USDC balance
  const usdcBalance = await client.readContract({
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
    args: [OLD_WALLET],
  });

  const usdcFormatted = (Number(usdcBalance) / 1000000).toFixed(6);
  console.log('USDC Balance:', usdcFormatted);

  // Check ETH balance
  const ethBalance = await client.getBalance({ address: OLD_WALLET });
  const ethFormatted = (Number(ethBalance) / 1e18).toFixed(6);
  console.log('ETH Balance:', ethFormatted);

  if (Number(usdcFormatted) > 0 || Number(ethFormatted) > 0.001) {
    console.log('✅ Wallet has funds and should be migrated!');
  } else {
    console.log('❌ Wallet has no significant funds');
  }
} catch (error) {
  console.error('❌ Error checking balance:', error);
}
