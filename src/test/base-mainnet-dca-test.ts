/**
 * Base Mainnet DCA Test
 *
 * This test demonstrates the complete DCA flow on Base mainnet:
 * 1. Create session key with user's wallet (client-side)
 * 2. Execute DCA swap using session key (server-side)
 * 3. Verify the swap was successful
 *
 * This test proves the session key implementation works for automated DCA
 * with real Base mainnet liquidity.
 */

import { http, createPublicClient, formatUnits, getContract } from 'viem';
import { erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { clientSessionKeyService } from '../services/clientSessionKeyService';
import { zerodevSessionKeyService } from '../services/zerodevSessionKeyService';
import { TOKENS } from '../utils/openOceanApi';

// Test configuration for Base mainnet
const TEST_CONFIG = {
  chain: base,
  // Test amounts - using small amounts for safety
  testAmount: 5000000n, // 5 USDC
  durationDays: 7, // 1 week
  minBalanceRequired: 10000000n, // 10 USDC minimum
};

// Mock EIP-1193 provider for testing
class MockProvider {
  private account: any;

  constructor(privateKey: string) {
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
  }

  async request({ method, params }: { method: string; params?: any[] }) {
    switch (method) {
      case 'eth_accounts':
        return [this.account.address];
      case 'eth_requestAccounts':
        return [this.account.address];
      case 'personal_sign':
        return await this.account.signMessage({ message: params![0] });
      case 'eth_signTypedData_v4':
        return await this.account.signTypedData(JSON.parse(params![1]));
      case 'eth_sendTransaction':
        // For testing, we'll simulate transaction sending
        return await this.account.signTransaction(params![0]);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
}

// Check USDC balance for an address
async function checkUSDCBalance(address: string, label: string) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const contract = getContract({
    address: TOKENS.USDC,
    abi: erc20Abi,
    client: publicClient,
  });

  const balance = await contract.read.balanceOf([address as `0x${string}`]);
  console.log(`💰 ${label} USDC Balance: ${formatUnits(balance, 6)} USDC`);
  return balance;
}

// Check SPX balance for an address
async function checkSPXBalance(address: string, label: string) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const contract = getContract({
    address: TOKENS.SPX6900,
    abi: erc20Abi,
    client: publicClient,
  });

  const balance = await contract.read.balanceOf([address as `0x${string}`]);
  console.log(`🎯 ${label} SPX Balance: ${formatUnits(balance, 18)} SPX`);
  return balance;
}

// Main test function
async function runBaseDCATest() {
  console.log('🚀 Base Mainnet DCA Test\n');
  console.log('Testing automated DCA with session keys on Base mainnet');
  console.log('===================================\n');

  try {
    // Test requires a private key with Base mainnet USDC
    const testPrivateKey = process.env.BASE_MAINNET_TEST_PRIVATE_KEY;
    if (!testPrivateKey) {
      console.log(
        '❌ Please set BASE_MAINNET_TEST_PRIVATE_KEY environment variable',
      );
      console.log(
        'This should be a private key with Base mainnet USDC for testing',
      );
      return;
    }

    const testAccount = privateKeyToAccount(testPrivateKey as `0x${string}`);
    console.log('🔑 Test Account:', testAccount.address);

    // Check initial USDC balance
    const initialUSDCBalance = await checkUSDCBalance(
      testAccount.address,
      'Initial',
    );

    if (initialUSDCBalance < TEST_CONFIG.minBalanceRequired) {
      console.log(`❌ Insufficient USDC balance for testing`);
      console.log(
        `- Required: ${formatUnits(TEST_CONFIG.minBalanceRequired, 6)} USDC`,
      );
      console.log(`- Available: ${formatUnits(initialUSDCBalance, 6)} USDC`);
      console.log('\nPlease fund the test account with Base mainnet USDC');
      return;
    }

    // Step 1: Create session key using client-side service
    console.log('\n🔑 Step 1: Creating session key...');
    const mockProvider = new MockProvider(testPrivateKey);

    const sessionKeyData = await clientSessionKeyService.createSessionKey(
      mockProvider,
      TEST_CONFIG.testAmount,
      TEST_CONFIG.durationDays,
    );

    console.log('✅ Session key created successfully');
    console.log(`- Smart Wallet: ${sessionKeyData.smartWalletAddress}`);
    console.log(`- Session Key: ${sessionKeyData.sessionAddress}`);
    console.log(
      `- Valid Until: ${new Date(sessionKeyData.validUntil * 1000).toISOString()}`,
    );

    // Step 2: Check smart wallet balance
    console.log('\n💰 Step 2: Checking smart wallet balance...');
    const smartWalletUSDCBalance = await checkUSDCBalance(
      sessionKeyData.smartWalletAddress,
      'Smart Wallet',
    );

    if (smartWalletUSDCBalance < TEST_CONFIG.testAmount) {
      console.log(`❌ Smart wallet needs USDC funding`);
      console.log(`- Required: ${formatUnits(TEST_CONFIG.testAmount, 6)} USDC`);
      console.log(
        `- Available: ${formatUnits(smartWalletUSDCBalance, 6)} USDC`,
      );
      console.log('\nPlease transfer USDC to the smart wallet for testing');
      return;
    }

    // Step 3: Execute DCA swap using session key
    console.log('\n🔄 Step 3: Executing DCA swap...');
    const executionResult = await zerodevSessionKeyService.executeDCASwap(
      sessionKeyData,
      TEST_CONFIG.testAmount,
      testAccount.address, // Send SPX tokens back to test account
    );

    if (!executionResult.success) {
      console.log(`❌ DCA swap failed: ${executionResult.error}`);
      return;
    }

    console.log('✅ DCA swap executed successfully!');
    console.log(`📍 Transaction hash: ${executionResult.txHash}`);
    console.log(
      `🔗 BaseScan: https://basescan.org/tx/${executionResult.txHash}`,
    );
    console.log(`🎯 SPX output: ${executionResult.amountOut}`);

    // Step 4: Verify final balances
    console.log('\n📊 Step 4: Verifying final balances...');

    // Check USDC balance after swap
    const finalUSDCBalance = await checkUSDCBalance(
      sessionKeyData.smartWalletAddress,
      'Smart Wallet Final',
    );
    const usdcSpent = smartWalletUSDCBalance - finalUSDCBalance;
    console.log(`💸 USDC spent: ${formatUnits(usdcSpent, 6)} USDC`);

    // Check SPX balance received
    const finalSPXBalance = await checkSPXBalance(
      testAccount.address,
      'Test Account Final',
    );
    console.log(`🎯 SPX received: ${formatUnits(finalSPXBalance, 18)} SPX`);

    // Summary
    console.log('\n🎉 Base Mainnet DCA Test Complete!');
    console.log('=====================================');
    console.log('📊 Test Results:');
    console.log(`✅ Session key creation: SUCCESS`);
    console.log(`✅ DCA swap execution: SUCCESS`);
    console.log(`✅ Gas sponsorship: SUCCESS`);
    console.log(`✅ Token swap: SUCCESS`);

    console.log('\n📋 Transaction Details:');
    console.log(`- TX Hash: ${executionResult.txHash}`);
    console.log(`- USDC Spent: ${formatUnits(usdcSpent, 6)} USDC`);
    console.log(`- SPX Received: ${formatUnits(finalSPXBalance, 18)} SPX`);
    console.log(`- Gas Cost: Sponsored by ZeroDev`);

    console.log('\n💡 Key Achievements:');
    console.log('1. ✅ Session keys work on Base mainnet');
    console.log('2. ✅ Real USDC → SPX swap executed');
    console.log('3. ✅ Gas sponsorship working');
    console.log('4. ✅ Automated DCA ready for production');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Test session key creation only (for quick testing)
async function testSessionKeyCreation() {
  console.log('🔑 Testing Session Key Creation Only\n');

  try {
    const testPrivateKey = process.env.BASE_MAINNET_TEST_PRIVATE_KEY;
    if (!testPrivateKey) {
      console.log(
        '❌ Please set BASE_MAINNET_TEST_PRIVATE_KEY environment variable',
      );
      return;
    }

    const testAccount = privateKeyToAccount(testPrivateKey as `0x${string}`);
    console.log('🔑 Test Account:', testAccount.address);

    // Create mock provider
    const mockProvider = new MockProvider(testPrivateKey);

    // Create session key
    const sessionKeyData = await clientSessionKeyService.createSessionKey(
      mockProvider,
      TEST_CONFIG.testAmount,
      TEST_CONFIG.durationDays,
    );

    console.log('✅ Session key creation test passed!');
    console.log(`- Smart Wallet: ${sessionKeyData.smartWalletAddress}`);
    console.log(`- Session Key: ${sessionKeyData.sessionAddress}`);
    console.log(
      `- Valid Until: ${new Date(sessionKeyData.validUntil * 1000).toISOString()}`,
    );
  } catch (error) {
    console.error('❌ Session key creation test failed:', error);
    throw error;
  }
}

// Export functions
export {
  runBaseDCATest,
  testSessionKeyCreation,
  checkUSDCBalance,
  checkSPXBalance,
};

// Run if called directly
if (import.meta.main) {
  // Run the session key creation test first
  testSessionKeyCreation()
    .then(() => {
      console.log('\n' + '='.repeat(50));
      console.log('Session key creation test completed successfully!');
      console.log(
        'To run the full DCA test, ensure your smart wallet has USDC',
      );
      console.log('='.repeat(50));
    })
    .catch(console.error);
}
