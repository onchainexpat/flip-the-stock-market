import { NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  parseEther,
  type Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

// Test agent key permissions without executing
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing agent permissions for order: ${orderId}`);

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

    console.log(`🔍 Testing agent key: ${orderData.agentKeyId}`);

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

    console.log('🔓 Attempting to deserialize permission account...');

    try {
      // Import permission modules
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      
      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);
      console.log('🤖 Agent address:', agentAccount.address);
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      // Deserialize the permission account
      const smartWallet = await deserializePermissionAccount(
        publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );
      
      console.log('✅ Permission account deserialized successfully');
      console.log('   Smart wallet address:', smartWallet.address);
      console.log('   Expected address:', order.sessionKeyAddress);
      
      // Check address match
      const addressMatch = smartWallet.address.toLowerCase() === order.sessionKeyAddress.toLowerCase();
      
      if (!addressMatch) {
        return NextResponse.json({
          success: false,
          error: 'Smart wallet address mismatch',
          details: {
            deserializedAddress: smartWallet.address,
            expectedAddress: order.sessionKeyAddress,
            agentAddress: agentAccount.address
          }
        });
      }

      // Try to create a kernel client (without sending transactions)
      console.log('🔧 Testing kernel client creation...');
      const { createKernelAccountClient } = await import('@zerodev/sdk');
      
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
        middleware: {
          gasPrice: async () => ({
            maxFeePerGas: 1000000000n, // 1 gwei
            maxPriorityFeePerGas: 1000000000n, // 1 gwei
          }),
        },
      });

      console.log('✅ Kernel client created successfully');

      // Test encoding USDC approval (without sending)
      const testAmount = parseEther("0.000001"); // Very small amount for testing
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address, testAmount],
      });

      console.log('✅ Transaction encoding successful');

      return NextResponse.json({
        success: true,
        message: 'Agent key permissions validated successfully',
        details: {
          agentKeyId: orderData.agentKeyId,
          agentAddress: agentAccount.address,
          smartWalletAddress: smartWallet.address,
          addressMatch,
          canDeserializeAccount: true,
          canCreateKernelClient: true,
          canEncodeTransactions: true,
          sessionKeyApprovalLength: agentKeyData.sessionKeyApproval?.length || 0
        }
      });

    } catch (deserializationError) {
      console.error('❌ Permission deserialization failed:', deserializationError);
      
      return NextResponse.json({
        success: false,
        error: 'Permission deserialization failed',
        details: {
          errorMessage: deserializationError instanceof Error ? deserializationError.message : 'Unknown error',
          agentKeyId: orderData.agentKeyId,
          hasSessionKeyApproval: !!agentKeyData.sessionKeyApproval,
          sessionKeyApprovalLength: agentKeyData.sessionKeyApproval?.length || 0
        }
      });
    }

  } catch (error) {
    console.error('❌ Agent permission test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}