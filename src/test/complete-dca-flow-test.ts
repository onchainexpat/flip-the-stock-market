/**
 * Complete DCA Flow Test
 * 
 * This test demonstrates the complete DCA flow:
 * 1. Transfer ETH from EOA to smart wallet
 * 2. Create session key for automated swaps
 * 3. Execute ETH → USDC swap via session key
 * 4. Demonstrate full automation
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseEther, 
  formatEther, 
  encodeFunctionData,
  formatUnits,
  getContract,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  serializePermissionAccount,
  deserializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import {
  toSudoPolicy,
} from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { erc20Abi } from 'viem';

// Base Sepolia addresses
const ADDRESSES = {
  UNISWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const, // SwapRouter02
  WETH: '0x4200000000000000000000000000000000000006' as const,
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
} as const;

// SwapRouter02 ABI for ETH swaps
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

const TEST_CONFIG = {
  chain: baseSepolia,
  projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '',
  bundlerUrl: process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL || `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,
  paymasterUrl: process.env.NEXT_PUBLIC_ZERODEV_TESTNET_RPC_URL || `https://rpc.zerodev.app/api/v3/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/chain/84532`,
  
  // Transfer and swap amounts
  fundingAmount: parseEther('0.005'), // Fund smart wallet with 0.005 ETH
  swapAmount: parseEther('0.002'),    // Swap 0.002 ETH for USDC
  poolFee: 3000,
};

// Check balances for both EOA and smart wallet
async function checkAllBalances(eoaAddress: string, smartWalletAddress: string) {
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });
  
  console.log('💰 Balance Check:');
  
  // Check EOA balance
  const eoaBalance = await publicClient.getBalance({ address: eoaAddress as `0x${string}` });
  console.log(`EOA (${eoaAddress}): ${formatEther(eoaBalance)} ETH`);
  
  // Check Smart Wallet balances
  const smartWalletEthBalance = await publicClient.getBalance({ address: smartWalletAddress as `0x${string}` });
  console.log(`Smart Wallet ETH: ${formatEther(smartWalletEthBalance)} ETH`);
  
  try {
    const usdcContract = getContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      client: publicClient,
    });
    
    const usdcBalance = await usdcContract.read.balanceOf([smartWalletAddress as `0x${string}`]);
    console.log(`Smart Wallet USDC: ${formatUnits(usdcBalance, 6)} USDC`);
    
    return { eoaBalance, smartWalletEthBalance, usdcBalance };
  } catch (error) {
    console.log('Smart Wallet USDC: 0 USDC (error reading)');
    return { eoaBalance, smartWalletEthBalance, usdcBalance: 0n };
  }
}

// Step 1: Fund smart wallet from EOA
async function fundSmartWallet(
  ownerPrivateKey: string,
  smartWalletAddress: string,
  amount: bigint
): Promise<string> {
  console.log(`\n💸 Step 1: Funding smart wallet with ${formatEther(amount)} ETH...`);
  
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });
  
  const walletClient = createWalletClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });
  
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  
  // Send ETH from EOA to smart wallet
  const txHash = await walletClient.sendTransaction({
    account: owner,
    to: smartWalletAddress as `0x${string}`,
    value: amount,
  });
  
  console.log('Funding transaction sent:', txHash);
  
  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('✅ Funding confirmed in block:', receipt.blockNumber);
  
  return txHash;
}

// Step 2: Create DCA session key
async function createDCASessionKey(
  ownerPrivateKey: string
): Promise<{
  smartWalletAddress: string;
  serializedSessionKey: string;
  sessionKeyAddress: string;
}> {
  console.log('\n🔑 Step 2: Creating DCA Session Key...');
  
  const publicClient = createPublicClient({
    chain: TEST_CONFIG.chain,
    transport: http(),
  });
  
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
  const entryPoint = getEntryPoint('0.7');
  
  // Create ECDSA validator
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  // Create smart wallet
  const smartWalletAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('Smart Wallet:', smartWalletAccount.address);
  
  // Generate session key
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });
  
  console.log('Session Key:', sessionAccount.address);
  
  // Create permission validator
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [
      toSudoPolicy({}), // Full permissions for testing
    ],
  });
  
  // Create session key account
  const sessionKeyAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionPlugin,
    },
  });
  
  console.log('✅ Session key created. Address matches:', sessionKeyAccount.address === smartWalletAccount.address);
  
  // Serialize session key
  const serializedSessionKey = await serializePermissionAccount(sessionKeyAccount, sessionPrivateKey);
  
  return {
    smartWalletAddress: smartWalletAccount.address,
    serializedSessionKey,
    sessionKeyAddress: sessionAccount.address,
  };
}

// Step 3: Execute DCA swap via session key
async function executeDCASwap(
  serializedSessionKey: string,
  smartWalletAddress: string,
  swapAmount: bigint
): Promise<string> {
  console.log(`\n🔄 Step 3: Executing DCA swap (${formatEther(swapAmount)} ETH → USDC)...`);
  
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
    serializedSessionKey
  );
  
  // Create paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain: TEST_CONFIG.chain,
    transport: http(TEST_CONFIG.paymasterUrl),
    entryPoint,
  });
  
  // Create kernel client
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
  
  // Prepare swap parameters
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const swapParams = {
    tokenIn: ADDRESSES.WETH,
    tokenOut: ADDRESSES.USDC,
    fee: TEST_CONFIG.poolFee,
    recipient: smartWalletAddress as `0x${string}`,
    deadline,
    amountIn: swapAmount,
    amountOutMinimum: 0n, // Accept any amount for testnet
    sqrtPriceLimitX96: 0n,
  };
  
  // Encode swap call
  const swapCalldata = encodeFunctionData({
    abi: UNISWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [swapParams],
  });
  
  // Execute swap
  const swapTx = await kernelClient.sendTransaction({
    to: ADDRESSES.UNISWAP_ROUTER,
    data: swapCalldata,
    value: swapAmount,
  });
  
  console.log('🔄 Swap transaction sent:', swapTx);
  
  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
  console.log('✅ Swap confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  
  return swapTx;
}

// Main test function
async function runCompleteDCATest() {
  console.log('🚀 Complete DCA Flow Test\n');
  console.log('Chain:', TEST_CONFIG.chain.name);
  console.log('Router:', ADDRESSES.UNISWAP_ROUTER);
  console.log('===================================\n');
  
  try {
    const ownerPrivateKey = process.env.BASE_SEPOLIA_TEST_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      throw new Error('Please set BASE_SEPOLIA_TEST_PRIVATE_KEY in your .env file');
    }
    
    const ownerAccount = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
    console.log('🔑 Test EOA:', ownerAccount.address);
    
    // Check initial balances
    const { smartWalletAddress } = await createDCASessionKey(ownerPrivateKey);
    console.log('\n💰 Initial Balances:');
    await checkAllBalances(ownerAccount.address, smartWalletAddress);
    
    // Step 1: Fund smart wallet
    const fundingTx = await fundSmartWallet(
      ownerPrivateKey,
      smartWalletAddress,
      TEST_CONFIG.fundingAmount
    );
    
    console.log('\n💰 After Funding:');
    await checkAllBalances(ownerAccount.address, smartWalletAddress);
    
    // Step 2: Create session key (already done above, but get fresh one)
    const { serializedSessionKey, sessionKeyAddress } = await createDCASessionKey(ownerPrivateKey);
    
    // Step 3: Execute DCA swap
    const swapTx = await executeDCASwap(
      serializedSessionKey,
      smartWalletAddress,
      TEST_CONFIG.swapAmount
    );
    
    // Check final balances
    console.log('\n💰 Final Balances:');
    const finalBalances = await checkAllBalances(ownerAccount.address, smartWalletAddress);
    
    // Summary
    console.log('\n🎉 Complete DCA Flow Success!');
    console.log('=====================================');
    console.log('📋 Transaction Summary:');
    console.log(`1. Funding: https://sepolia.basescan.org/tx/${fundingTx}`);
    console.log(`2. DCA Swap: https://sepolia.basescan.org/tx/${swapTx}`);
    console.log('\n📊 Results:');
    console.log(`• Smart Wallet: ${smartWalletAddress}`);
    console.log(`• Session Key: ${sessionKeyAddress}`);
    console.log(`• Funding Amount: ${formatEther(TEST_CONFIG.fundingAmount)} ETH`);
    console.log(`• Swap Amount: ${formatEther(TEST_CONFIG.swapAmount)} ETH`);
    console.log(`• Final USDC: ${formatUnits(finalBalances.usdcBalance, 6)} USDC`);
    
    console.log('\n💡 This demonstrates:');
    console.log('✅ Automated ETH → USDC conversion');
    console.log('✅ Session key authorization working');
    console.log('✅ Gas sponsorship by paymaster');
    console.log('✅ Complete DCA automation ready!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Export functions
export {
  runCompleteDCATest,
  fundSmartWallet,
  createDCASessionKey,
  executeDCASwap,
  checkAllBalances,
};

// Run if called directly
if (import.meta.main) {
  runCompleteDCATest().catch(console.error);
}