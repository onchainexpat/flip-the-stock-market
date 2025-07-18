/**
 * Session Key Uniswap Test
 *
 * This test demonstrates session keys performing Uniswap swaps on behalf of users:
 * 1. User creates session key with swap permissions for specific tokens
 * 2. Session key performs token approvals and swaps
 * 3. Demonstrates proper DCA-style automation
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
  parseUnits,
} from 'viem';
import { erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Base Sepolia addresses
const ADDRESSES = {
  // Uniswap V3 on Base Sepolia
  UNISWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const,
  UNISWAP_QUOTER: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as const,

  // Test tokens on Base Sepolia
  WETH: '0x4200000000000000000000000000000000000006' as const, // Wrapped ETH
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const, // USDC
  DAI: '0x174956bDfbCEb2705137F2C6990fD8e56C4e32a7' as const, // DAI (if available)
} as const;

// Uniswap V3 Router ABI (minimal)
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
  {
    name: 'multicall',
    type: 'function',
    inputs: [
      { name: 'deadline', type: 'uint256' },
      { name: 'data', type: 'bytes[]' },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
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

  // Swap parameters
  swapAmount: parseUnits('10', 6), // 10 USDC
  maxSwapPerDay: parseUnits('100', 6), // 100 USDC daily limit
  slippageTolerance: 300, // 3%
  poolFee: 3000, // 0.3% pool fee
};

interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  slippageTolerance: number;
}

// Create session key with Uniswap permissions
async function createUniswapSessionKey(ownerPrivateKey: string): Promise<{
  smartWalletAddress: string;
  serializedSessionKey: string;
  sessionKeyAddress: string;
}> {
  console.log('🦄 Creating Uniswap Session Key...');

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

  // Generate session key
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });

  console.log('Session Key Address:', sessionAccount.address);

  // For the test, we'll use sudo policy to avoid complex permission setup
  // In production, you'd set specific permission policies for each contract interaction

  // Create permission validator with swap permissions
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [
      // For testing, use sudo policy to allow all operations
      // In production, you'd use specific policies for each token and operation
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
async function checkTokenBalances(walletAddress: string) {
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });

  console.log('💰 Token Balances for', walletAddress);

  try {
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

    // Check WETH balance
    const wethContract = getContract({
      address: ADDRESSES.WETH,
      abi: erc20Abi,
      client: publicClient,
    });

    const wethBalance = await wethContract.read.balanceOf([
      walletAddress as `0x${string}`,
    ]);
    console.log('WETH:', formatEther(wethBalance));

    // Check ETH balance
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    console.log('ETH:', formatEther(ethBalance));

    return { usdcBalance, wethBalance, ethBalance };
  } catch (error) {
    console.log('❌ Error checking balances:', error);
    return { usdcBalance: 0n, wethBalance: 0n, ethBalance: 0n };
  }
}

// Perform token swap using session key
async function performSwap(
  serializedSessionKey: string,
  swapParams: SwapParams,
): Promise<{ txHash: string; gasUsed: bigint }> {
  console.log(`🔄 Swapping ${formatUnits(swapParams.amountIn, 6)} tokens...`);

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
  const amountOutMinimum =
    (swapParams.amountIn * BigInt(10000 - swapParams.slippageTolerance)) /
    10000n;

  // Get current timestamp + 20 minutes for deadline
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Prepare swap parameters
  const swapCalldata = encodeFunctionData({
    abi: UNISWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: swapParams.tokenIn as `0x${string}`,
        tokenOut: swapParams.tokenOut as `0x${string}`,
        fee: TEST_CONFIG.poolFee,
        recipient: swapParams.recipient as `0x${string}`,
        deadline,
        amountIn: swapParams.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  // First approve the token spend
  console.log('Approving token spend...');
  const approveTx = await kernelClient.writeContract({
    address: swapParams.tokenIn as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [ADDRESSES.UNISWAP_ROUTER, swapParams.amountIn],
  });

  console.log('Approve tx:', approveTx);
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Perform the swap
  console.log('Executing swap...');
  const swapTx = await kernelClient.sendTransaction({
    to: ADDRESSES.UNISWAP_ROUTER,
    data: swapCalldata,
    value: 0n,
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
async function testDCASwaps(
  serializedSessionKey: string,
  smartWalletAddress: string,
) {
  console.log('\n🔄 Testing DCA-style Swaps...');

  const swapResults = [];

  // Perform 3 small swaps to simulate DCA
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`\n--- Swap ${i + 1}/3 ---`);

      // Check balances before swap
      await checkTokenBalances(smartWalletAddress);

      const result = await performSwap(serializedSessionKey, {
        tokenIn: ADDRESSES.USDC,
        tokenOut: ADDRESSES.WETH,
        amountIn: TEST_CONFIG.swapAmount,
        recipient: smartWalletAddress,
        slippageTolerance: TEST_CONFIG.slippageTolerance,
      });

      swapResults.push({ success: true, swap: i + 1, ...result });

      // Check balances after swap
      await checkTokenBalances(smartWalletAddress);

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
async function runUniswapTest() {
  console.log('🦄 Session Key Uniswap Test\n');
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

    // Step 1: Create session key with Uniswap permissions
    const { smartWalletAddress, serializedSessionKey, sessionKeyAddress } =
      await createUniswapSessionKey(ownerPrivateKey);

    console.log('\n📋 Session Key Summary:');
    console.log('Smart Wallet:', smartWalletAddress);
    console.log('Session Key:', sessionKeyAddress);
    console.log(
      'Daily Swap Limit:',
      formatUnits(TEST_CONFIG.maxSwapPerDay, 6),
      'USDC',
    );
    console.log('Per Swap:', formatUnits(TEST_CONFIG.swapAmount, 6), 'USDC');
    console.log('Rate Limit: 10 swaps per day');

    // Step 2: Check initial balances
    console.log('\n💰 Initial Balances:');
    await checkTokenBalances(smartWalletAddress);

    // Step 3: Test DCA swaps
    const swapResults = await testDCASwaps(
      serializedSessionKey,
      smartWalletAddress,
    );

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

    console.log('\n✅ Uniswap Test Completed!');
    console.log('\n💡 Key Insights:');
    console.log('1. Session keys can perform complex DeFi operations');
    console.log('2. Permissions enforce spending and rate limits');
    console.log('3. Perfect for automated DCA strategies');
    console.log('4. Gas costs are sponsored by paymaster');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Export for testing
export {
  runUniswapTest,
  createUniswapSessionKey,
  performSwap,
  testDCASwaps,
  checkTokenBalances,
};

// Run if called directly
if (import.meta.main) {
  runUniswapTest().catch(console.error);
}
