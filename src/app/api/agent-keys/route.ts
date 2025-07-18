import { NextResponse } from 'next/server';
import type { Address } from 'viem';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

// Create agent key using the proper service
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log(
      '🔧 DEBUG: Request body received:',
      JSON.stringify(body, null, 2),
    );
    const { userAddress, smartWalletAddress } = body;

    if (!userAddress || !smartWalletAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress or smartWalletAddress' },
        { status: 400 },
      );
    }

    // Create a real agent key using the service
    const agentKey = await serverAgentKeyService.generateAgentKey(
      userAddress as Address,
    );

    // If smart wallet address is provided, update the key
    if (smartWalletAddress) {
      agentKey.smartWalletAddress = smartWalletAddress as Address;
      // Store the updated key back to Redis
      await serverAgentKeyService.updateAgentKey(agentKey.keyId, {
        smartWalletAddress: smartWalletAddress as Address,
      });
    }

    console.log('✅ Agent key created and stored:', agentKey.keyId);

    return NextResponse.json({
      success: true,
      agentKey,
    });
  } catch (error) {
    console.error('Failed to create agent key:', error);

    let errorMessage = 'Failed to create agent key';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error, null, 2);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

// Get agent key by ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json(
        { error: 'Missing keyId parameter' },
        { status: 400 },
      );
    }

    // Debug: Check what methods are available
    console.log(
      '🔧 DEBUG: Available methods on serverAgentKeyService:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(serverAgentKeyService)),
    );
    console.log(
      '🔧 DEBUG: serverAgentKeyService type:',
      typeof serverAgentKeyService,
    );
    console.log(
      '🔧 DEBUG: getAgentKey type:',
      typeof serverAgentKeyService.getAgentKey,
    );

    // Get the agent key
    const agentKey = await serverAgentKeyService.getAgentKey(keyId);

    if (!agentKey) {
      return NextResponse.json(
        { error: 'Agent key not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      agentKey: {
        keyId: agentKey.keyId,
        userAddress: agentKey.userAddress,
        smartWalletAddress: agentKey.smartWalletAddress,
        agentAddress: agentKey.agentAddress,
        isActive: agentKey.isActive,
        createdAt: agentKey.createdAt,
        lastUsedAt: agentKey.lastUsedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get agent key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
