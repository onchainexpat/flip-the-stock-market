/**
 * Session Key ETH to USDC Test
 *
 * This test demonstrates session keys performing ETH → USDC swaps:
 * 1. Use existing ETH balance in the smart wallet
 * 2. Session key swaps ETH for USDC on Uniswap
 * 3. Demonstrates complete DCA automation
 */

import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getContract,
  parseEther,
} from 'viem';
import { erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Base Sepolia addresses
const ADDRESSES = {
  // Uniswap V3 on Base Sepolia
  UNISWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const,

  // Wrapped ETH on Base Sepolia
  WETH: '0x4200000000000000000000000000000000000006' as const,

  // USDC on Base Sepolia
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
} as const;

// Uniswap V3 Router ABI for ETH swaps
const UNISWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const;

// Test configuration
const TEST_CONFIG = {
  chain: baseSepolia,
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '',
  bundlerUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,
  paymasterUrl:
    process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL ||
    `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,

  // Swap parameters - using smaller amounts since we have limited ETH
  swapAmount: parseEther('0.001'), // 0.001 ETH per swap
  slippageTolerance: 500, // 5% slippage for testnet
  poolFee: 3000, // 0.3% pool fee
};

// Create session key for ETH swaps
async function createETHSwapSessionKey(ownerPrivateKey: string): Promise<{
  smartWalletAddress: string;
  serializedSessionKey: string;
  sessionKeyAddress: string;
}> {
  console.log('💰 Creating ETH → USDC Session Key...');

  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Create owner account
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  const entryPoint = getEntryPoint('0.7');

  // Create ECDSA validator for owner
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Create original smart wallet
  const originalAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  console.log('Smart Wallet Address:', originalAccount.address);

  // Check wallet balance
  const balance = await publicClient.getBalance({
    address: originalAccount.address,
  });
  console.log('Smart Wallet ETH Balance:', formatEther(balance), 'ETH');

  if (balance < parseEther('0.005')) {
    console.log(
      '⚠️  Low ETH balance. May not be sufficient for multiple swaps.',
    );
  }

  // Generate session key
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });

  console.log('Session Key Address:', sessionAccount.address);

  // Create permission validator with full permissions for testing
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [
      // Use sudo policy for full permissions
      toSudoPolicy({}),
    ],
  });

  // Create session key account with both plugins
  const sessionKeyAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionPlugin,
    },
  });

  console.log(
    'Session key account created. Address matches:',
    sessionKeyAccount.address === originalAccount.address,
  );

  // Serialize the session key
  const serializedSessionKey = await serializePermissionAccount(
    sessionKeyAccount,
    sessionPrivateKey,
  );

  return {
    smartWalletAddress: originalAccount.address,
    serializedSessionKey,
    sessionKeyAddress: sessionAccount.address,
  };
}

// Check token balances
async function checkBalances(walletAddress: string) {
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  console.log('💰 Balances for', walletAddress);

  try {
    // Check ETH balance
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    console.log('ETH:', formatEther(ethBalance));

    // Check USDC balance
    const usdcContract = getContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      client: publicClient,
    });

    const usdcBalance = await usdcContract.read.balanceOf([
      walletAddress as `0x${string}`,
    ]);
    console.log('USDC:', formatUnits(usdcBalance, 6));

    return { ethBalance, usdcBalance };
  } catch (error) {
    console.log('❌ Error checking balances:', error);
    return { ethBalance: 0n, usdcBalance: 0n };
  }
}

// Perform ETH to USDC swap using session key
async function swapETHForUSDC(
  serializedSessionKey: string,
  ethAmount: bigint,
  recipient: string,
): Promise<{ txHash: string; gasUsed: bigint }> {
  console.log(`🔄 Swapping ${formatEther(ethAmount)} ETH for USDC...`);

  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  // Deserialize session key
  const entryPoint = getEntryPoint('0.7');
  const sessionKeyAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    KERNEL_V3_1,
    serializedSessionKey,
  );

  // Create paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: TEST_CONFIG.chain,
    transport: http(TEST_CONFIG.paymasterUrl),
    entryPoint,
  });

  // Create kernel client with session key
  const kernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
    chain: TEST_CONFIG.chain,
    bundlerTransport: http(TEST_CONFIG.bundlerUrl),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
    entryPoint,
  });

  // Calculate minimum output with slippage
  // For testnet, we'll be more lenient with slippage
  const amountOutMinimum = 0n; // Accept any amount for testnet

  // Get current timestamp + 20 minutes for deadline
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Prepare swap parameters for ETH → USDC
  const swapParams = {
    tokenIn: ADDRESSES.WETH, // WETH address (ETH will be auto-wrapped)
    tokenOut: ADDRESSES.USDC,
    fee: TEST_CONFIG.poolFee,
    recipient: recipient as `0x${string}`,
    deadline,
    amountIn: ethAmount,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  };

  // Encode the swap call
  const swapCalldata = encodeFunctionData({
    abi: UNISWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [swapParams],
  });

  // Execute the swap (sending ETH with the transaction)
  console.log('Executing ETH → USDC swap...');
  const swapTx = await kernelClient.sendTransaction({
    to: ADDRESSES.UNISWAP_ROUTER,
    data: swapCalldata,
    value: ethAmount, // Send ETH with the transaction
  });

  console.log('Swap transaction sent! Hash:', swapTx);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: swapTx,
  });
  console.log('Swap confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());

  return {
    txHash: swapTx,
    gasUsed: receipt.gasUsed,
  };
}

// Test multiple swaps (DCA simulation)
async function testETHToUSDCSwaps(
  serializedSessionKey: string,
  smartWalletAddress: string,
) {
  console.log('\n🔄 Testing ETH → USDC DCA Swaps...');

  const swapResults = [];

  // Perform 2 small swaps to simulate DCA
  for (let i = 0; i < 2; i++) {
    try {
      console.log(`\n--- Swap ${i + 1}/2 ---`);

      // Check balances before swap
      await checkBalances(smartWalletAddress);

      const result = await swapETHForUSDC(
        serializedSessionKey,
        TEST_CONFIG.swapAmount,
        smartWalletAddress,
      );

      swapResults.push({ success: true, swap: i + 1, ...result });

      // Check balances after swap
      console.log('After swap:');
      await checkBalances(smartWalletAddress);

      // Small delay between swaps
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error: any) {
      console.log(`❌ Swap ${i + 1} failed:`, error.message);
      swapResults.push({ success: false, swap: i + 1, error: error.message });
    }
  }

  return swapResults;
}

// Main test function
async function runETHToUSDCTest() {
  console.log('💰 Session Key ETH → USDC Test\n');
  console.log('Chain:', TEST_CONFIG.chain.name);
  console.log('Router:', ADDRESSES.UNISWAP_ROUTER);
  console.log('-----------------------------------\n');

  try {
    // Get test private key
    const ownerPrivateKey = process.env.BASE_SEPOLIA_TEST_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error(
        'Please set BASE_SEPOLIA_TEST_PRIVATE_KEY in your .env file',
      );
    }

    // Step 1: Create session key for ETH swaps
    const { smartWalletAddress, serializedSessionKey, sessionKeyAddress } =
      await createETHSwapSessionKey(ownerPrivateKey);

    console.log('\n📋 Session Key Summary:');
    console.log('Smart Wallet:', smartWalletAddress);
    console.log('Session Key:', sessionKeyAddress);
    console.log('Per Swap:', formatEther(TEST_CONFIG.swapAmount), 'ETH');
    console.log(
      'Slippage Tolerance:',
      TEST_CONFIG.slippageTolerance / 100,
      '%',
    );

    // Step 2: Check initial balances
    console.log('\n💰 Initial Balances:');
    await checkBalances(smartWalletAddress);

    // Step 3: Test ETH → USDC swaps
    const swapResults = await testETHToUSDCSwaps(
      serializedSessionKey,
      smartWalletAddress,
    );

    // Step 4: Final balances
    console.log('\n💰 Final Balances:');
    await checkBalances(smartWalletAddress);

    // Summary
    console.log('\n📊 Test Results:');
    console.log(
      'Successful swaps:',
      swapResults.filter((r) => r.success).length,
    );
    console.log('Failed swaps:', swapResults.filter((r) => !r.success).length);

    const successfulSwaps = swapResults.filter((r) => r.success);
    if (successfulSwaps.length > 0) {
      console.log('\n🔗 Transaction Links:');
      successfulSwaps.forEach((swap: any) => {
        console.log(
          `Swap ${swap.swap}: https://sepolia.basescan.org/tx/${swap.txHash}`,
        );
      });
    }

    console.log('\n✅ ETH → USDC Test Completed!');
    console.log('\n💡 Key Insights:');
    console.log('1. Session keys can swap ETH for any token');
    console.log('2. Perfect for automated ETH → stablecoin DCA');
    console.log('3. Gas costs sponsored by paymaster');
    console.log('4. No user interaction required after setup');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Export for testing
export {
  runETHToUSDCTest,
  createETHSwapSessionKey,
  swapETHForUSDC,
  testETHToUSDCSwaps,
  checkBalances,
};

// Run if called directly
if (import.meta.main) {
  runETHToUSDCTest().catch(console.error);
}
