import { NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

// Debug agent key permissions and data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

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

    console.log(`🔍 Debugging agent key: ${orderData.agentKeyId}`);

    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(orderData.agentKeyId);
    if (!agentKeyData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key not found' 
      }, { status: 404 });
    }

    // Check if private key exists
    const privateKey = await serverAgentKeyService.getPrivateKey(orderData.agentKeyId);
    const hasPrivateKey = !!privateKey;

    // Calculate permission approval age
    const keyCreatedAt = new Date(agentKeyData.createdAt);
    const now = new Date();
    const ageInHours = (now.getTime() - keyCreatedAt.getTime()) / (1000 * 60 * 60);

    return NextResponse.json({
      success: true,
      agentKey: {
        keyId: orderData.agentKeyId,
        agentAddress: agentKeyData.agentAddress,
        smartWalletAddress: agentKeyData.smartWalletAddress,
        userAddress: agentKeyData.userAddress,
        createdAt: agentKeyData.createdAt,
        createdAtDate: keyCreatedAt.toISOString(),
        ageInHours: Math.round(ageInHours * 100) / 100,
        hasPrivateKey,
        hasSessionKeyApproval: !!agentKeyData.sessionKeyApproval,
        sessionKeyApprovalLength: agentKeyData.sessionKeyApproval?.length || 0,
        isActive: agentKeyData.isActive,
      },
      order: {
        id: order.id,
        smartWallet: order.sessionKeyAddress,
        userAddress: order.userAddress,
        status: order.status,
        createdAtDate: new Date(order.createdAt).toISOString()
      },
      potentialIssues: [
        !hasPrivateKey && "❌ Private key not found",
        !agentKeyData.sessionKeyApproval && "❌ Session key approval missing",
        !agentKeyData.isActive && "❌ Agent key is inactive",
        ageInHours > 24 && "⚠️ Session key may have expired (>24h old)",
        agentKeyData.smartWalletAddress?.toLowerCase() !== order.sessionKeyAddress?.toLowerCase() && "❌ Smart wallet address mismatch"
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('❌ Agent key debug failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}