import { type NextRequest, NextResponse } from 'next/server';
import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';

export const runtime = 'edge';

// Standard ERC20 allowance function selector
const ALLOWANCE_FUNCTION = '0xdd62ed3e'; // allowance(address,address)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, spenderAddress, tokenAddress, amount } = body;

    if (!userAddress || !spenderAddress || !tokenAddress || !amount) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: userAddress, spenderAddress, tokenAddress, amount',
        },
        { status: 400 },
      );
    }

    // Create public client for Base chain
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Encode the allowance call
    const allowanceCallData = `${ALLOWANCE_FUNCTION}${userAddress.slice(2).padStart(64, '0')}${spenderAddress.slice(2).padStart(64, '0')}`;

    console.log('Checking allowance:', {
      token: tokenAddress,
      owner: userAddress,
      spender: spenderAddress,
      requiredAmount: amount,
    });

    // Call the allowance function
    const result = await publicClient.call({
      to: tokenAddress as `0x${string}`,
      data: allowanceCallData as `0x${string}`,
    });

    if (!result.data) {
      console.error('No data returned from allowance call');
      return NextResponse.json({
        hasAllowance: false,
        currentAllowance: '0',
        requiredAmount: amount,
        error: 'Failed to read allowance',
      });
    }

    // Decode the result (uint256)
    const currentAllowance = BigInt(result.data);
    const requiredAmount = BigInt(amount);

    console.log('Allowance check result:', {
      currentAllowance: currentAllowance.toString(),
      requiredAmount: requiredAmount.toString(),
      hasAllowance: currentAllowance >= requiredAmount,
    });

    return NextResponse.json({
      hasAllowance: currentAllowance >= requiredAmount,
      currentAllowance: currentAllowance.toString(),
      requiredAmount: amount,
    });
  } catch (error) {
    console.error('Failed to check allowance:', error);
    return NextResponse.json(
      {
        hasAllowance: false,
        currentAllowance: '0',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
