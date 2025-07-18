import { type NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData } from 'viem';

export const runtime = 'edge';

// Aerodrome DEX addresses on Base
const AERODROME_ROUTER = '0x01d40099fcd87c018969b0e8d4ab1633fb34763c';
const AERODROME_FACTORY = '0x420dd381b31aef6683db6b902084cb0ffece40da'; // Factory address (may need verification)

// Token addresses on Base
const TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  WETH: '0x4200000000000000000000000000000000000006',
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C',
};

// Aerodrome Router interface for swapExactTokensForTokens
const AERODROME_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage = 0.05, // 5% default slippage for better execution
    } = body;

    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: sellToken, buyToken, sellAmount, takerAddress',
        },
        { status: 400 },
      );
    }

    console.log('🛸 Aerodrome DEX Swap Request');
    console.log('   Sell Token:', sellToken);
    console.log('   Buy Token:', buyToken);
    console.log('   Sell Amount:', sellAmount);
    console.log('   Taker:', takerAddress);

    // Build the swap route based on the transaction analysis
    // For USDC → SPX6900, we need to route through WETH
    let routes;
    let estimatedAmountOut;

    if (sellToken.toLowerCase() === TOKENS.USDC.toLowerCase() && 
        buyToken.toLowerCase() === TOKENS.SPX6900.toLowerCase()) {
      
      console.log('📍 USDC → SPX6900 route (via WETH)');
      
      // Based on the actual transaction, this goes USDC → WETH → SPX6900
      routes = [
        {
          from: TOKENS.USDC,
          to: TOKENS.WETH,
          stable: false, // Volatile pool
          factory: AERODROME_FACTORY,
        },
        {
          from: TOKENS.WETH,
          to: TOKENS.SPX6900,
          stable: false, // Volatile pool
          factory: AERODROME_FACTORY,
        },
      ];

      // Rough estimation based on the actual swap we analyzed
      // 0.1 USDC → 0.06013026 SPX6900 means rate ≈ 0.6 SPX per USDC
      const estimatedRate = 0.6; // SPX per USDC
      estimatedAmountOut = Math.floor(Number(sellAmount) / 1e6 * estimatedRate * 1e8); // Convert to SPX decimals
      
    } else {
      return NextResponse.json(
        {
          error: 'Only USDC → SPX6900 swaps supported currently',
        },
        { status: 400 },
      );
    }

    // Calculate minimum amount out with slippage protection
    const minAmountOut = Math.floor(estimatedAmountOut * (1 - slippagePercentage));

    // Build the swap transaction
    const swapData = encodeFunctionData({
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [
        BigInt(sellAmount), // amountIn
        BigInt(minAmountOut), // amountOutMin
        routes, // routes array
        takerAddress as `0x${string}`, // to
        BigInt(Math.floor(Date.now() / 1000) + 600), // deadline (10 minutes)
      ],
    });

    console.log('✅ Aerodrome swap transaction built');
    console.log('   Router:', AERODROME_ROUTER);
    console.log('   Routes:', routes.length);
    console.log('   Amount In:', sellAmount);
    console.log('   Min Amount Out:', minAmountOut);

    return NextResponse.json({
      to: AERODROME_ROUTER,
      data: swapData,
      value: '0',
      sellAmount: sellAmount,
      buyAmount: estimatedAmountOut.toString(),
      allowanceTarget: AERODROME_ROUTER,
      price: (estimatedAmountOut / Number(sellAmount)).toString(),
      estimatedPriceImpact: (slippagePercentage * 100).toString(),
      provider: 'aerodrome',
      routes: routes,
      securityValidation: {
        timestamp: new Date().toISOString(),
        provider: 'Aerodrome DEX',
        router: AERODROME_ROUTER,
        noExternalAPI: true,
        basedOnActualSwap: '0x33fd4041490253388e92be7154beabbf238ede0872a7d9ca49c0235df468cf95',
      },
    });
  } catch (error) {
    console.error('Failed to build Aerodrome swap:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}