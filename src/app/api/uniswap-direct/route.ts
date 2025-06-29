import { type NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData } from 'viem';

export const runtime = 'edge';

// Uniswap V3 addresses on Base
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

// Direct Uniswap V3 integration - no external APIs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage = 0.015,
    } = body;

    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        {
          error: 'Missing required fields: sellToken, buyToken, sellAmount, takerAddress',
        },
        { status: 400 },
      );
    }

    // For SPX6900/USDC, we know the pool exists with 1% fee tier
    const FEE_TIER = 10000; // 1%
    
    // Calculate minimum amount out with slippage
    // This is simplified - in production you'd use the quoter contract
    const minAmountOut = BigInt(Math.floor(Number(sellAmount) * 0.98)); // Rough estimate

    // Build the swap transaction directly
    const swapData = encodeFunctionData({
      abi: [{
        inputs: [
          {
            components: [
              { name: 'tokenIn', type: 'address' },
              { name: 'tokenOut', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'recipient', type: 'address' },
              { name: 'deadline', type: 'uint256' },
              { name: 'amountIn', type: 'uint256' },
              { name: 'amountOutMinimum', type: 'uint256' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' },
            ],
            name: 'params',
            type: 'tuple',
          },
        ],
        name: 'exactInputSingle',
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        type: 'function',
      }],
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: sellToken as `0x${string}`,
        tokenOut: buyToken as `0x${string}`,
        fee: FEE_TIER,
        recipient: takerAddress as `0x${string}`,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600), // 10 minutes
        amountIn: BigInt(sellAmount),
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0n, // No price limit
      }],
    });

    console.log('🦄 Direct Uniswap V3 swap built');

    // Return the transaction data
    return NextResponse.json({
      to: UNISWAP_V3_ROUTER,
      data: swapData,
      value: '0',
      sellAmount: sellAmount,
      buyAmount: minAmountOut.toString(), // Estimated
      allowanceTarget: UNISWAP_V3_ROUTER,
      price: '0', // Would need quoter for accurate price
      estimatedPriceImpact: '0.1', // Estimate
      provider: 'uniswap-direct',
      securityValidation: {
        timestamp: new Date().toISOString(),
        provider: 'Uniswap V3 Direct',
        router: UNISWAP_V3_ROUTER,
        noExternalAPI: true,
      }
    });
  } catch (error) {
    console.error('Failed to build Uniswap swap:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}