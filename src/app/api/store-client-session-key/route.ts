import { NextResponse } from 'next/server';
import type { Address } from 'viem';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

// Store a client-created session key with gas sponsorship
export async function POST(request: Request) {
  try {
    const {
      userAddress,
      smartWalletAddress,
      sessionPrivateKey,
      sessionKeyApproval,
      agentAddress,
    } = await request.json();

    if (
      !userAddress ||
      !smartWalletAddress ||
      !sessionPrivateKey ||
      !sessionKeyApproval ||
      !agentAddress
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: userAddress, smartWalletAddress, sessionPrivateKey, sessionKeyApproval, agentAddress',
        },
        { status: 400 },
      );
    }

    console.log('💾 Storing client-created session key...');
    console.log('   User address:', userAddress);
    console.log('   Smart wallet:', smartWalletAddress);
    console.log('   Agent address:', agentAddress);
    console.log('   Approval length:', sessionKeyApproval.length);

    // Validate addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (
      !addressRegex.test(userAddress) ||
      !addressRegex.test(smartWalletAddress) ||
      !addressRegex.test(agentAddress)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid address format',
        },
        { status: 400 },
      );
    }

    // Validate private key format
    if (
      !sessionPrivateKey.startsWith('0x') ||
      sessionPrivateKey.length !== 66
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid private key format',
        },
        { status: 400 },
      );
    }

    // Store the session key using the existing service
    const agentKey = await serverAgentKeyService.storeSessionKey(
      userAddress as Address,
      smartWalletAddress as Address,
      sessionPrivateKey as `0x${string}`,
      sessionKeyApproval,
    );

    console.log('✅ Client session key stored successfully');
    console.log('   Agent key ID:', agentKey.keyId);
    console.log('   Created at:', new Date(agentKey.createdAt));

    // Verify the stored key by attempting to retrieve it
    console.log('🔍 Verifying stored session key...');
    const retrievedKey = await serverAgentKeyService.getAgentKey(
      agentKey.keyId,
    );
    const retrievedPrivateKey = await serverAgentKeyService.getPrivateKey(
      agentKey.keyId,
    );

    if (!retrievedKey || !retrievedPrivateKey) {
      console.error('❌ Failed to verify stored session key');
      return NextResponse.json(
        {
          success: false,
          error: 'Session key storage verification failed',
        },
        { status: 500 },
      );
    }

    console.log('✅ Session key verification successful');
    console.log('   Has session approval:', !!retrievedKey.sessionKeyApproval);
    console.log(
      '   Private key matches:',
      retrievedPrivateKey === sessionPrivateKey,
    );

    return NextResponse.json({
      success: true,
      message: 'Client session key stored and verified successfully',
      agentKeyId: agentKey.keyId,
      agentAddress,
      smartWalletAddress,
      userAddress,
      verification: {
        hasSessionApproval: !!retrievedKey.sessionKeyApproval,
        privateKeyMatches: retrievedPrivateKey === sessionPrivateKey,
        approvalLength: retrievedKey.sessionKeyApproval?.length || 0,
      },
      createdAt: agentKey.createdAt,
    });
  } catch (error) {
    console.error('❌ Failed to store client session key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
