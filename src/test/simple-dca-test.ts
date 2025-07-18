#!/usr/bin/env bun

/**
 * Simple DCA Test - Tests the complete DCA flow with KERNEL_V3_2
 * This bypasses the complex permissions system to test core functionality
 */

import type { Address } from 'viem';
import { simpleDCAService } from '../services/simpleDCAService';

// Test configuration
const TEST_CONFIG = {
  // Test with small amounts
  TEST_USDC_AMOUNT: 10000n, // 0.01 USDC (6 decimals)
  MINIMUM_BALANCE_REQUIRED: 10000n, // 0.01 USDC minimum for tests

  // Replace with your test wallet address where you want to receive SPX tokens
  USER_WALLET: '0x742f96b3E80A4b3633C7F3Ec5Bd1b5F9b6B0123E' as Address,
};

/**
 * Test the complete DCA flow
 */
async function testCompleteDCAFlow(): Promise<void> {
  console.log('🧪 Testing Complete DCA Flow with KERNEL_V3_2...\n');

  try {
    // Step 1: Create smart wallet
    console.log('📋 Step 1: Creating smart wallet for DCA...');
    const wallet = await simpleDCAService.createSimpleSmartWallet(
      TEST_CONFIG.USER_WALLET,
    );
    console.log(`✅ Smart wallet created: ${wallet.address}`);
    console.log(`🤖 Agent address: ${wallet.agentAddress}`);
    console.log(`👤 User wallet: ${wallet.userWalletAddress}\n`);

    // Step 2: Check balances
    console.log('📋 Step 2: Checking wallet balances...');
    const usdcBalance = await simpleDCAService.getUSDCBalance(wallet.address);
    const userSPXBalance = await simpleDCAService.getSPXBalance(
      wallet.userWalletAddress,
    );

    console.log(
      `💰 Smart wallet USDC balance: ${(Number(usdcBalance) / 1e6).toFixed(6)} USDC`,
    );
    console.log(
      `💰 User wallet SPX balance: ${(Number(userSPXBalance) / 1e18).toFixed(6)} SPX\n`,
    );

    // Step 3: Check if we have enough balance for testing
    if (usdcBalance < TEST_CONFIG.MINIMUM_BALANCE_REQUIRED) {
      console.log('⚠️ Insufficient USDC balance for testing');
      console.log('📝 To test the DCA flow, you need to:');
      console.log(`   1. Fund the smart wallet with USDC: ${wallet.address}`);
      console.log(
        `   2. Send at least ${(Number(TEST_CONFIG.MINIMUM_BALANCE_REQUIRED) / 1e6).toFixed(6)} USDC to this address`,
      );
      console.log('   3. Re-run this test after funding\n');

      console.log('🔗 Funding Options:');
      console.log('   - Use a DEX like Uniswap to swap ETH → USDC');
      console.log('   - Transfer USDC from another wallet');
      console.log('   - Use a faucet if available on testnet\n');

      console.log('💡 Smart Wallet Info:');
      console.log(`   - Address: ${wallet.address}`);
      console.log(`   - Network: Base Mainnet`);
      console.log(
        `   - USDC Contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
      );

      return;
    }

    // Step 4: Execute DCA swap
    console.log('📋 Step 3: Executing DCA swap...');
    const swapResult = await simpleDCAService.executeDCASwap(
      wallet,
      TEST_CONFIG.TEST_USDC_AMOUNT,
    );

    if (swapResult.success) {
      console.log('✅ DCA swap completed successfully!');
      console.log(`📍 Transaction hash: ${swapResult.txHash}`);
      console.log(`📈 Expected SPX output: ${swapResult.amountOut}\n`);

      // Step 5: Verify results
      console.log('📋 Step 4: Verifying swap results...');

      // Wait a moment for transaction to be processed
      console.log('⏳ Waiting for transaction confirmation...');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds

      const newUSDCBalance = await simpleDCAService.getUSDCBalance(
        wallet.address,
      );
      const newUserSPXBalance = await simpleDCAService.getSPXBalance(
        wallet.userWalletAddress,
      );

      console.log('\n📊 Final Balances:');
      console.log(
        `💰 Smart wallet USDC: ${(Number(newUSDCBalance) / 1e6).toFixed(6)} USDC (was ${(Number(usdcBalance) / 1e6).toFixed(6)})`,
      );
      console.log(
        `💰 User wallet SPX: ${(Number(newUserSPXBalance) / 1e18).toFixed(6)} SPX (was ${(Number(userSPXBalance) / 1e18).toFixed(6)})`,
      );

      const usdcSpent = usdcBalance - newUSDCBalance;
      const spxReceived = newUserSPXBalance - userSPXBalance;

      console.log('\n📈 Transaction Summary:');
      console.log(
        `💸 USDC spent: ${(Number(usdcSpent) / 1e6).toFixed(6)} USDC`,
      );
      console.log(
        `📈 SPX received: ${(Number(spxReceived) / 1e18).toFixed(6)} SPX`,
      );

      if (spxReceived > 0) {
        console.log(
          '🎉 DCA swap successful - SPX tokens delivered to user wallet!',
        );
      } else {
        console.log('⚠️ No SPX tokens detected - check transaction details');
      }
    } else {
      console.log('❌ DCA swap failed');
      console.log(`❌ Error: ${swapResult.error}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test wallet creation only (for getting the address to fund)
 */
async function testWalletCreation(): Promise<void> {
  console.log('🧪 Testing Wallet Creation Only...\n');

  try {
    const wallet = await simpleDCAService.createSimpleSmartWallet(
      TEST_CONFIG.USER_WALLET,
    );

    console.log('✅ Smart wallet created successfully!');
    console.log('📋 Wallet Details:');
    console.log(`   🏠 Smart Wallet Address: ${wallet.address}`);
    console.log(`   🤖 Agent Address: ${wallet.agentAddress}`);
    console.log(`   👤 User Wallet: ${wallet.userWalletAddress}`);
    console.log(`   🔗 Network: Base Mainnet`);
    console.log(`   ⚡ Kernel Version: V3_2 (with chain abstraction)`);

    console.log('\n💡 Next Steps:');
    console.log('1. Fund the smart wallet with USDC for testing');
    console.log('2. Run the complete DCA flow test');
  } catch (error) {
    console.error('❌ Wallet creation failed:', error);
  }
}

/**
 * Check balances only
 */
async function checkBalances(walletAddress: Address): Promise<void> {
  console.log(`🧪 Checking Balances for ${walletAddress}...\n`);

  try {
    const usdcBalance = await simpleDCAService.getUSDCBalance(walletAddress);
    const spxBalance = await simpleDCAService.getSPXBalance(walletAddress);

    console.log('💰 Current Balances:');
    console.log(`   USDC: ${(Number(usdcBalance) / 1e6).toFixed(6)} USDC`);
    console.log(`   SPX: ${(Number(spxBalance) / 1e18).toFixed(6)} SPX`);

    if (usdcBalance >= TEST_CONFIG.MINIMUM_BALANCE_REQUIRED) {
      console.log('✅ Sufficient balance for DCA testing');
    } else {
      console.log(
        `⚠️ Need ${(Number(TEST_CONFIG.MINIMUM_BALANCE_REQUIRED - usdcBalance) / 1e6).toFixed(6)} more USDC for testing`,
      );
    }
  } catch (error) {
    console.error('❌ Balance check failed:', error);
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 Simple DCA Test Suite - KERNEL_V3_2 + Chain Abstraction');
  console.log('='.repeat(80));

  switch (command) {
    case 'wallet':
      await testWalletCreation();
      break;
    case 'balance':
      if (args[1]) {
        await checkBalances(args[1] as Address);
      } else {
        console.log(
          '❌ Please provide wallet address: bun run simple-dca-test.ts balance <address>',
        );
      }
      break;
    case 'full':
    default:
      await testCompleteDCAFlow();
      break;
  }

  console.log('\n📋 Available Commands:');
  console.log(
    '  bun run src/test/simple-dca-test.ts full     # Test complete DCA flow',
  );
  console.log(
    '  bun run src/test/simple-dca-test.ts wallet   # Create wallet only',
  );
  console.log(
    '  bun run src/test/simple-dca-test.ts balance <address>  # Check balances',
  );
}

if (import.meta.main) {
  main()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

// Export functions for use in other tests
export { testCompleteDCAFlow, testWalletCreation, checkBalances };
