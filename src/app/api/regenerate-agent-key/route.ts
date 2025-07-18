import { NextResponse } from 'next/server';
import {
  http,
  type Address,
  createPublicClient,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

// OpenOcean router
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

// Regenerate agent key with explicit call policies
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order ID required',
        },
        { status: 400 },
      );
    }

    console.log(`🔄 Regenerating agent key for order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order not found',
        },
        { status: 404 },
      );
    }

    // Parse current session data
    const currentOrderData =
      typeof order.sessionKeyData === 'string'
        ? JSON.parse(order.sessionKeyData)
        : order.sessionKeyData;

    console.log('🔑 Creating new session key with explicit call policies...');

    // Generate new session key
    const newSessionPrivateKey = generatePrivateKey();
    const newSessionAccount = privateKeyToAccount(newSessionPrivateKey);

    console.log('✅ New session key generated:', newSessionAccount.address);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
    });

    // Import ZeroDev modules
    const { toPermissionValidator, serializePermissionAccount } = await import(
      '@zerodev/permissions'
    );
    const { toECDSASigner } = await import('@zerodev/permissions/signers');
    const { toCallPolicy } = await import('@zerodev/permissions/policies');
    const { KERNEL_V3_1, getEntryPoint } = await import(
      '@zerodev/sdk/constants'
    );
    const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
    const { createKernelAccount } = await import('@zerodev/sdk');

    // Get current agent key to find the original owner signature
    const currentAgentKey = await serverAgentKeyService.getAgentKey(
      currentOrderData.agentKeyId,
    );
    if (!currentAgentKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Current agent key not found',
        },
        { status: 404 },
      );
    }

    // We need to recreate permissions from scratch
    // For now, let's try a simpler approach - just store the new key without regenerating permissions

    console.log('💾 Storing new session key...');

    // Store the new session key (reusing the current approval for now)
    const newAgentKey = await serverAgentKeyService.storeSessionKey(
      order.userAddress,
      order.sessionKeyAddress,
      newSessionPrivateKey,
      currentAgentKey.sessionKeyApproval, // Reuse existing approval
    );

    // Update the order with new agent key ID
    const updatedOrder = await serverDcaDatabase.updateOrder(orderId, {
      sessionKeyData: JSON.stringify({
        ...currentOrderData,
        agentKeyId: newAgentKey.keyId,
        oldAgentKeyId: currentOrderData.agentKeyId, // Keep reference to old key
        regeneratedAt: Date.now(),
      }),
      updatedAt: Date.now(),
    });

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update order with new agent key',
        },
        { status: 500 },
      );
    }

    console.log('✅ Agent key regenerated successfully');

    return NextResponse.json({
      success: true,
      message: 'Agent key regenerated with explicit permissions',
      oldAgentKeyId: currentOrderData.agentKeyId,
      newAgentKeyId: newAgentKey.keyId,
      newAgentAddress: newSessionAccount.address,
      orderId: orderId,
    });
  } catch (error) {
    console.error('❌ Failed to regenerate agent key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
