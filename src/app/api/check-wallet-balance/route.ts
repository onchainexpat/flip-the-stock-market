import { NextResponse } from 'next/server';
import { http, createPublicClient, formatEther } from 'viem';
import { base } from 'viem/chains';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

// Check wallet balances (ETH and USDC)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address required',
        },
        { status: 400 },
      );
    }

    console.log(`💰 Checking balances for: ${address}`);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL),
    });

    // Get ETH balance
    const ethBalance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });

    // Get USDC balance
    const usdcBalance = await publicClient.readContract({
      address: TOKENS.USDC,
      abi: [
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function',
        },
      ],
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    const ethBalanceFormatted = formatEther(ethBalance);
    const usdcBalanceFormatted = (Number(usdcBalance) / 1e6).toFixed(6);

    console.log(`💰 ETH balance: ${ethBalanceFormatted} ETH`);
    console.log(`💰 USDC balance: ${usdcBalanceFormatted} USDC`);

    return NextResponse.json({
      success: true,
      address,
      balances: {
        eth: {
          raw: ethBalance.toString(),
          formatted: ethBalanceFormatted,
          unit: 'ETH',
        },
        usdc: {
          raw: (usdcBalance as bigint).toString(),
          formatted: usdcBalanceFormatted,
          unit: 'USDC',
        },
      },
      hasEthForGas: Number(ethBalanceFormatted) > 0.001, // Need at least 0.001 ETH for gas
      hasUsdcForSwap: Number(usdcBalanceFormatted) > 0.5, // Need at least 0.5 USDC for swap
    });
  } catch (error) {
    console.error('❌ Balance check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
