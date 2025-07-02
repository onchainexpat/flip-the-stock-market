import { createZeroDevPaymasterClient } from '@zerodev/sdk';
import {
  KERNEL_V3_0,
  KERNEL_V3_1,
  getEntryPoint,
} from '@zerodev/sdk/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

export const runtime = 'edge';

// POST: Execute migration with ZeroDev paymaster sponsorship
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      oldWalletAddress,
      destinationAddress,
      usdcAmount, // in USDC wei (6 decimals)
      kernelVersion,
      userAddress,
    } = body;

    if (
      !oldWalletAddress ||
      !destinationAddress ||
      !usdcAmount ||
      !userAddress ||
      !kernelVersion
    ) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    console.log('🚀 Starting ZeroDev paymaster-sponsored migration...');
    console.log(`📍 From: ${oldWalletAddress} (${kernelVersion})`);
    console.log(`📍 To: ${destinationAddress}`);
    console.log(`💰 Amount: ${usdcAmount} USDC wei`);
    console.log(`👤 User: ${userAddress}`);

    const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
    if (!projectId) {
      console.error(
        '❌ NEXT_PUBLIC_ZERODEV_PROJECT_ID not found in environment',
      );
      return NextResponse.json(
        { error: 'ZeroDev project ID not configured' },
        { status: 500 },
      );
    }

    console.log('🔍 Using ZeroDev project ID:', projectId);

    // THE KEY INSIGHT: We need to use a session key or signing service that can authorize
    // transactions on behalf of the old smart wallet. However, this still requires the
    // user's private key to create the proper signature.

    // For KERNEL_V3_1 wallets, we need to use the correct kernel version and entry point
    // Default to KERNEL_V3_1 unless explicitly KERNEL_V3_0
    const kernelVersionConstant =
      kernelVersion === 'KERNEL_V3_0' ? KERNEL_V3_0 : KERNEL_V3_1;
    const entryPoint = getEntryPoint(
      kernelVersion === 'KERNEL_V3_0' ? '0.7' : '0.6',
    );

    console.log(`🔍 Using kernel version: ${kernelVersionConstant}`);
    console.log(`🔍 Using entry point: ${entryPoint}`);

    // Set up ZeroDev clients
    const publicClient = createPublicClient({
      chain: base,
      transport: http(`https://rpc.zerodev.app/api/v3/${projectId}/chain/8453`),
    });

    // Create paymaster client for gas sponsorship
    const paymasterClient = createZeroDevPaymasterClient({
      chain: base,
      transport: http(`https://rpc.zerodev.app/api/v2/paymaster/${projectId}`),
      // entryPoint removed - not needed for paymaster client
    });

    console.log('✅ ZeroDev paymaster client created');

    // The challenge: We need the user's signature to authorize the transaction
    // But server-side, we don't have access to the user's private key

    // SOLUTION: Return a sponsored transaction that the client can sign
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    // Generate USDC transfer calldata
    const transferCalldata = `0xa9059cbb${destinationAddress.slice(2).padStart(64, '0')}${BigInt(usdcAmount).toString(16).padStart(64, '0')}`;

    // Create the execution calldata for ERC-7579 format
    const packedCalldata = `0x${USDC_ADDRESS.slice(2).toLowerCase()}${'0'.repeat(64)}${transferCalldata.slice(2)}`;

    console.log('🔄 Preparing sponsored transaction parameters...');

    // Return the transaction data that can be executed client-side with sponsorship
    return NextResponse.json({
      success: true,
      sponsoredTransaction: {
        to: oldWalletAddress,
        data: packedCalldata,
        value: '0',
        gasLimit: '300000', // Estimated gas limit
      },
      executionMethod: 'execute',
      execMode:
        '0x0100000000000000000000000000000000000000000000000000000000000000',
      paymasterUrl: `https://rpc.zerodev.app/api/v2/paymaster/${projectId}`,
      bundlerUrl: `https://rpc.zerodev.app/api/v2/bundler/${projectId}`,
      message:
        'Sponsored transaction prepared - execute client-side with ZeroDev paymaster',
    });
  } catch (error) {
    console.error('❌ ZeroDev paymaster preparation error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to prepare sponsored transaction',
        details: 'Check server logs for more information',
      },
      { status: 500 },
    );
  }
}
