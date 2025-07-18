// Test USDC to SPX swap using Aerodrome router directly
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
import { http, createPublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// Test private key for creating the smart wallet
const OWNER_PRIVATE_KEY =
  '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

// User wallet
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH on Base

// Aerodrome router
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';

// Aerodrome Router ABI - just the functions we need
const aerodromeRouterAbi = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
];

async function testAerodromeSwap() {
  console.log('🚀 Testing USDC to SPX swap using Aerodrome router');
  console.log('==============================================');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const ownerSigner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const entryPoint = getEntryPoint('0.7');

    console.log('👤 Owner address:', ownerSigner.address);
    console.log('📍 User wallet:', USER_WALLET);

    // Create session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
    const sessionKeySigner = await toECDSASigner({
      signer: sessionKeyAccount,
    });

    console.log('🔑 Session key address:', sessionKeyAccount.address);

    // Create master account
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      entryPoint,
      signer: ownerSigner,
      kernelVersion: KERNEL_V3_1,
    });

    const masterAccount = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
      },
      kernelVersion: KERNEL_V3_1,
    });

    console.log('🏠 Smart wallet address:', masterAccount.address);

    // Create permission validator
    const permissionPlugin = await toPermissionValidator(publicClient, {
      entryPoint,
      signer: sessionKeySigner,
      policies: [toSudoPolicy({})],
      kernelVersion: KERNEL_V3_1,
    });

    // Create session key account
    const sessionKeyAccount2 = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: {
        sudo: ecdsaValidator,
        regular: permissionPlugin,
      },
      kernelVersion: KERNEL_V3_1,
    });

    // Serialize and deserialize
    const serializedSessionKey = await serializePermissionAccount(
      sessionKeyAccount2,
      sessionPrivateKey,
    );

    const deserializedAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      serializedSessionKey,
    );

    console.log('🔓 Session key ready');

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });

    console.log('\\n💰 Balances:');
    console.log(
      '   Smart wallet USDC:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );

    if (usdcBalance < 100000n) {
      console.log('❌ Insufficient USDC balance (need at least 0.1 USDC)');
      return;
    }

    // Create kernel client
    const paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    const kernelClient = createKernelAccountClient({
      account: deserializedAccount,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC),
      paymaster: {
        getPaymasterData: async (userOperation) => {
          return await paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });

    // Swap amount: 0.5 USDC
    const swapAmount = BigInt(500000); // 0.5 USDC

    console.log('\\n💱 Preparing swap:');
    console.log('   Amount:', (Number(swapAmount) / 1e6).toFixed(6), 'USDC');
    console.log('   Route: USDC → WETH → SPX (via Aerodrome)');

    // Define the swap route: USDC → WETH → SPX
    // Aerodrome default factory on Base: 0x420DD381b31aEf6683db6B902084cB0FFECe40Da
    const routes = [
      {
        from: USDC_ADDRESS,
        to: WETH_ADDRESS,
        stable: false, // volatile pair for USDC/WETH
        factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      },
      {
        from: WETH_ADDRESS,
        to: SPX_ADDRESS,
        stable: false, // volatile pair for WETH/SPX
        factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      },
    ];

    // Get expected output
    console.log('\\n📊 Getting swap quote...');
    try {
      const amountsOut = await publicClient.readContract({
        address: AERODROME_ROUTER,
        abi: aerodromeRouterAbi,
        functionName: 'getAmountsOut',
        args: [swapAmount, routes],
      });

      console.log(
        '   Expected SPX output:',
        (Number(amountsOut[2]) / 1e8).toFixed(8),
        'SPX',
      );
      console.log(
        '   Minimum output (1% slippage):',
        (Number((amountsOut[2] * 99n) / 100n) / 1e8).toFixed(8),
        'SPX',
      );
    } catch (error) {
      console.log('   ⚠️ Could not get quote, continuing with 0 minimum');
    }

    // Step 1: Approve USDC
    console.log('\\n📝 Step 1: Approving USDC for Aerodrome router...');

    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [AERODROME_ROUTER, swapAmount],
    });

    const approveTx = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([
        {
          to: USDC_ADDRESS,
          value: BigInt(0),
          data: approveData,
        },
      ]),
    });

    console.log('   ✅ Approval UserOp:', approveTx);
    await kernelClient.waitForUserOperationReceipt({ hash: approveTx });
    console.log('   ✅ Approval confirmed');

    // Step 2: Execute swap
    console.log('\\n🔄 Step 2: Executing swap...');

    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    const minAmountOut = BigInt(0); // Accept any amount for testing (in production, use actual minimum)

    const swapData = encodeFunctionData({
      abi: aerodromeRouterAbi,
      functionName: 'swapExactTokensForTokens',
      args: [
        swapAmount,
        minAmountOut,
        routes,
        deserializedAccount.address, // Receive SPX in smart wallet first
        deadline,
      ],
    });

    const swapTx = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([
        {
          to: AERODROME_ROUTER,
          value: BigInt(0),
          data: swapData,
        },
      ]),
    });

    console.log('   ✅ Swap UserOp:', swapTx);
    const swapReceipt = await kernelClient.waitForUserOperationReceipt({
      hash: swapTx,
    });
    console.log('   ✅ Swap confirmed:', swapReceipt.receipt.transactionHash);

    // Check SPX balance
    const spxBalance = await publicClient.readContract({
      address: SPX_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });

    console.log(
      '   💰 SPX received:',
      (Number(spxBalance) / 1e8).toFixed(8),
      'SPX',
    );

    if (spxBalance === 0n) {
      console.log('❌ No SPX received from swap');
      return;
    }

    // Step 3: Transfer SPX to user wallet
    console.log('\\n📤 Step 3: Transferring SPX to user wallet...');

    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [USER_WALLET, spxBalance],
    });

    const transferTx = await kernelClient.sendUserOperation({
      callData: await deserializedAccount.encodeCalls([
        {
          to: SPX_ADDRESS,
          value: BigInt(0),
          data: transferData,
        },
      ]),
    });

    console.log('   ✅ Transfer UserOp:', transferTx);
    const transferReceipt = await kernelClient.waitForUserOperationReceipt({
      hash: transferTx,
    });
    console.log(
      '   ✅ Transfer confirmed:',
      transferReceipt.receipt.transactionHash,
    );

    // Check final balances
    const finalUsdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [deserializedAccount.address],
    });

    const userSpxBalance = await publicClient.readContract({
      address: SPX_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [USER_WALLET],
    });

    console.log('\\n🎉 SWAP COMPLETE!');
    console.log('=================');
    console.log('📊 Final balances:');
    console.log(
      '   Smart wallet USDC:',
      (Number(finalUsdcBalance) / 1e6).toFixed(6),
      'USDC',
    );
    console.log(
      '   User wallet SPX:',
      (Number(userSpxBalance) / 1e8).toFixed(8),
      'SPX',
    );
    console.log('');
    console.log('✅ Successfully swapped USDC to SPX using Aerodrome!');
    console.log('✅ SPX tokens delivered to user wallet!');
    console.log('✅ DCA is fully functional with direct DEX integration!');
  } catch (error) {
    console.error('❌ Swap test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testAerodromeSwap();
