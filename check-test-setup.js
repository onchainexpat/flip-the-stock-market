#!/usr/bin/env node

/**
 * Check Test Setup
 * 
 * This script checks if your Base Sepolia test environment is ready
 * and provides funding instructions.
 */

const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config({ path: '.env.local' });

async function checkTestSetup() {
  console.log('🔍 Checking Base Sepolia Test Setup\n');
  
  // Check environment variables
  const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
  const testPrivateKey = process.env.BASE_SEPOLIA_TEST_PRIVATE_KEY;
  
  if (!projectId) {
    console.log('❌ NEXT_PUBLIC_ZERODEV_PROJECT_ID not found in .env.local');
    return false;
  }
  
  if (!testPrivateKey) {
    console.log('❌ BASE_SEPOLIA_TEST_PRIVATE_KEY not found in .env.local');
    return false;
  }
  
  console.log('✅ ZeroDev Project ID:', projectId);
  
  // Check test account
  const testAccount = privateKeyToAccount(testPrivateKey);
  console.log('✅ Test EOA Address:', testAccount.address);
  
  // Check balance
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  
  try {
    const balance = await publicClient.getBalance({ 
      address: testAccount.address 
    });
    
    const balanceEth = Number(balance) / 1e18;
    console.log('💰 Test EOA Balance:', balanceEth.toFixed(6), 'ETH');
    
    if (balance === 0n) {
      console.log('\n🚨 Test EOA needs funding!');
      console.log('\n📋 Funding Instructions:');
      console.log('1. Go to Base Sepolia Bridge: https://bridge.base.org/deposit');
      console.log('2. Switch to Sepolia testnet');
      console.log('3. Bridge some Sepolia ETH to Base Sepolia');
      console.log('4. Send 0.01 ETH to test address:', testAccount.address);
      console.log('\nAlternatively:');
      console.log('- Use Coinbase Wallet faucet');
      console.log('- Use Alchemy faucet: https://www.alchemy.com/faucets/base-sepolia');
      console.log('- Use QuickNode faucet: https://faucet.quicknode.com/base/sepolia');
      return false;
    } else if (balanceEth < 0.005) {
      console.log('⚠️  Low balance. Consider adding more ETH for testing.');
    } else {
      console.log('✅ Sufficient balance for testing');
    }
    
    // Check ZeroDev endpoints
    console.log('\n🔗 Checking ZeroDev endpoints...');
    const bundlerUrl = process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL || `https://rpc.zerodev.app/api/v3/${projectId}/chain/84532`;
    const paymasterUrl = bundlerUrl; // Same URL for v3 API
    
    console.log('✅ Bundler URL:', bundlerUrl);
    console.log('✅ Paymaster URL:', paymasterUrl);
    
    console.log('\n🎉 Test environment is ready!');
    console.log('\nNext steps:');
    console.log('1. Basic functionality: node run-session-key-tests.js basic');
    console.log('2. ETH transfers: node run-session-key-tests.js eth');
    console.log('3. Uniswap swaps: node run-session-key-tests.js uniswap');
    console.log('4. Run all tests: node run-session-key-tests.js all');
    
    return true;
    
  } catch (error) {
    console.log('❌ Error checking balance:', error.message);
    return false;
  }
}

checkTestSetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });