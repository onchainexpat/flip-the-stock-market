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

const ZERODEV_RPC_URL = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || '';

// Test different ZeroDev paymaster approaches
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing ZeroDev paymaster approaches for order: ${orderId}`);

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

    console.log(`🔐 Using agent key: ${orderData.agentKeyId}`);

    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(orderData.agentKeyId);
    if (!agentKeyData || !agentKeyData.sessionKeyApproval) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key or session approval not found' 
      }, { status: 404 });
    }

    const privateKey = await serverAgentKeyService.getPrivateKey(orderData.agentKeyId);
    if (!privateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent private key not found' 
      }, { status: 404 });
    }

    const smartWalletAddress = order.sessionKeyAddress as Address;
    const agentAccount = privateKeyToAccount(privateKey);

    console.log(`🏦 Smart wallet: ${smartWalletAddress}`);
    console.log(`🤖 Agent address: ${agentAccount.address}`);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL)
    });

    const tests: any[] = [];

    // Test 1: Direct paymaster call
    try {
      console.log('🧪 Test 1: Direct ZeroDev paymaster API call');
      
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Try to call the paymaster API directly
      const paymasterResponse = await fetch(ZERODEV_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'pm_sponsorUserOperation',
          params: [
            {
              sender: smartWallet.address,
              nonce: '0x0',
              callData: '0x',
              callGasLimit: '0x10000',
              verificationGasLimit: '0x10000',
              preVerificationGas: '0x5000',
              maxFeePerGas: '0x3b9aca00',
              maxPriorityFeePerGas: '0x3b9aca00',
              signature: '0x'
            },
            getEntryPoint('0.7')
          ],
        }),
      });

      const paymasterResult = await paymasterResponse.json();
      
      tests.push({
        name: 'Direct paymaster API call',
        success: !paymasterResult.error,
        result: paymasterResult,
        error: paymasterResult.error?.message || null
      });

    } catch (error) {
      tests.push({
        name: 'Direct paymaster API call',
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Check if account is correctly configured for sponsorship
    try {
      console.log('🧪 Test 2: Check account sponsorship eligibility');
      
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Check account details
      const accountDetails = {
        address: smartWallet.address,
        addressMatch: smartWallet.address.toLowerCase() === smartWalletAddress.toLowerCase(),
        approvalLength: agentKeyData.sessionKeyApproval.length,
        agentAddress: agentAccount.address
      };

      // Try to decode the session key approval to see policies
      let approvalDetails = 'Could not decode';
      try {
        const decoded = atob(agentKeyData.sessionKeyApproval);
        approvalDetails = `Decoded length: ${decoded.length}, contains "gas": ${decoded.includes('gas')}`;
      } catch (decodeError) {
        approvalDetails = 'Base64 decode failed';
      }

      tests.push({
        name: 'Account sponsorship eligibility',
        success: true,
        result: {
          ...accountDetails,
          approvalDetails
        },
        error: null
      });

    } catch (error) {
      tests.push({
        name: 'Account sponsorship eligibility',
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Try manual user operation construction
    try {
      console.log('🧪 Test 3: Manual user operation with sponsorship');
      
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Simple call data for USDC approval
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, parseUnits('1', 6)],
      });

      const userOp = {
        sender: smartWallet.address,
        nonce: await publicClient.readContract({
          address: smartWallet.address,
          abi: [{ 
            inputs: [], 
            name: 'getNonce', 
            outputs: [{ type: 'uint256' }], 
            stateMutability: 'view', 
            type: 'function' 
          }],
          functionName: 'getNonce'
        }).catch(() => BigInt(0)),
        callData: approveData,
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
        maxFeePerGas: BigInt(1000000000),
        maxPriorityFeePerGas: BigInt(1000000000),
        signature: '0x'
      };

      tests.push({
        name: 'Manual user operation construction',
        success: true,
        result: {
          userOpConstructed: true,
          sender: userOp.sender,
          nonce: userOp.nonce.toString(),
          callDataLength: approveData.length
        },
        error: null
      });

    } catch (error) {
      tests.push({
        name: 'Manual user operation construction',
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'ZeroDev paymaster tests completed',
      orderId,
      agentKeyId: orderData.agentKeyId,
      smartWalletAddress,
      tests
    });

  } catch (error) {
    console.error('❌ ZeroDev paymaster test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}