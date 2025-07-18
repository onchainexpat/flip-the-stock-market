#!/usr/bin/env node

const { createPublicClient, http, formatEther, formatUnits, getContract } = require('viem');
const { baseSepolia } = require('viem/chains');
const { erc20Abi } = require('viem');
require('dotenv').config({ path: '.env.local' });

const SMART_WALLET = '0xD110362f07d7cD716af4003F67FDfEa08C4Ef71D';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function checkBalances() {
  console.log('💰 Checking Smart Wallet Balances\n');
  console.log('Address:', SMART_WALLET);
  console.log('-----------------------------------');
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  
  try {
    // Check ETH balance
    const ethBalance = await publicClient.getBalance({ address: SMART_WALLET });
    console.log('ETH Balance:', formatEther(ethBalance), 'ETH');
    
    // Check USDC balance
    const usdcContract = getContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      client: publicClient,
    });
    
    const usdcBalance = await usdcContract.read.balanceOf([SMART_WALLET]);
    console.log('USDC Balance:', formatUnits(usdcBalance, 6), 'USDC');
    
    console.log('\n🔗 View on Basescan:');
    console.log(`https://sepolia.basescan.org/address/${SMART_WALLET}`);
    
    if (ethBalance > 0n) {
      console.log('\n✅ Smart wallet has ETH - ready for swaps!');
      console.log('Run: node run-session-key-tests.js swap');
    } else {
      console.log('\n⚠️  Smart wallet needs ETH funding');
      console.log('Send some Base Sepolia ETH to:', SMART_WALLET);
    }
    
  } catch (error) {
    console.error('Error checking balances:', error);
  }
}

checkBalances();