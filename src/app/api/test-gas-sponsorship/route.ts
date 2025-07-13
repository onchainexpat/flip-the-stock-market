import { NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

// Test gas sponsorship without requiring ETH in smart wallet
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing gas sponsorship for order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Parse order data
    const orderData = typeof order.sessionKeyData === 'string' 
      ? JSON.parse(order.sessionKeyData) 
      : order.sessionKeyData;

    if (!orderData.agentKeyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key ID not found' 
      }, { status: 400 });
    }

    console.log(`🔐 Testing agent key: ${orderData.agentKeyId}`);

    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(orderData.agentKeyId);
    if (!agentKeyData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key not found' 
      }, { status: 404 });
    }

    // Get private key
    const privateKey = await serverAgentKeyService.getPrivateKey(orderData.agentKeyId);
    if (!privateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent private key not found' 
      }, { status: 404 });
    }

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL)
    });

    console.log('💰 Testing different gas sponsorship approaches...');

    const tests: any[] = [];

    // Test 1: Current approach with paymaster
    try {
      console.log('🧪 Test 1: Current paymaster approach');
      
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { createKernelAccountClient, createZeroDevPaymasterClient } = await import('@zerodev/sdk');
      
      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      // Deserialize the permission account
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Create paymaster
      const paymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
      });

      // Create kernel client with paymaster
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
        middleware: {
          sponsorUserOperation: paymaster.sponsorUserOperation,
        },
      });

      // Try to estimate gas for a simple USDC approval
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, parseUnits('1', 6)],
      });

      // Test gas estimation
      const gasEstimate = await kernelClient.estimateGas({
        to: TOKENS.USDC,
        data: approveData,
        value: 0n,
      });

      tests.push({
        name: 'Paymaster with gas estimation',
        success: true,
        gasEstimate: gasEstimate.toString(),
        error: null
      });

    } catch (error) {
      tests.push({
        name: 'Paymaster with gas estimation',
        success: false,
        gasEstimate: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Direct bundler call without gas estimation
    try {
      console.log('🧪 Test 2: Direct bundler without gas estimation');
      
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { createKernelAccountClient, createZeroDevPaymasterClient } = await import('@zerodev/sdk');
      
      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      // Deserialize the permission account
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Create paymaster
      const paymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
      });

      // Create kernel client with manual gas limits
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
        middleware: {
          sponsorUserOperation: paymaster.sponsorUserOperation,
          gasPrice: async () => ({
            maxFeePerGas: 1000000000n, // 1 gwei
            maxPriorityFeePerGas: 1000000000n, // 1 gwei
          }),
          userOperationSimulator: async (args) => {
            return {
              preVerificationGas: 100000n,
              verificationGasLimit: 500000n,
              callGasLimit: 1000000n,
            };
          },
        },
      });

      // Build user operation manually
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, parseUnits('1', 6)],
      });

      // Try to build the user operation (without sending)
      const userOp = await kernelClient.buildUserOperation({
        calls: [{
          to: TOKENS.USDC,
          data: approveData,
          value: 0n,
        }]
      });

      tests.push({
        name: 'Manual gas limits with paymaster',
        success: true,
        userOpHash: userOp.hash || 'built successfully',
        error: null
      });

    } catch (error) {
      tests.push({
        name: 'Manual gas limits with paymaster',
        success: false,
        userOpHash: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Check if smart wallet needs initialization
    try {
      console.log('🧪 Test 3: Check smart wallet initialization status');
      
      const smartWalletAddress = order.sessionKeyAddress as Address;
      
      // Check if the smart wallet has been deployed
      const code = await publicClient.getCode({ address: smartWalletAddress });
      const isDeployed = code && code !== '0x';
      
      // Check balances
      const ethBalance = await publicClient.getBalance({ address: smartWalletAddress });
      const usdcBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartWalletAddress],
      });

      tests.push({
        name: 'Smart wallet status check',
        success: true,
        isDeployed,
        ethBalance: ethBalance.toString(),
        usdcBalance: usdcBalance.toString(),
        error: null
      });

    } catch (error) {
      tests.push({
        name: 'Smart wallet status check',
        success: false,
        isDeployed: null,
        ethBalance: null,
        usdcBalance: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Gas sponsorship tests completed',
      orderId,
      agentKeyId: orderData.agentKeyId,
      smartWalletAddress: order.sessionKeyAddress,
      tests
    });

  } catch (error) {
    console.error('❌ Gas sponsorship test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}