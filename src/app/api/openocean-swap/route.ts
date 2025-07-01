import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// OpenOcean swap API integration - alternative to compromised 0x API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      receiverAddress,  // Optional: where to send the output tokens
      slippagePercentage = 0.03, // Increased to 3% for better execution success
    } = body;

    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        {
          error: 'Missing required fields: sellToken, buyToken, sellAmount, takerAddress',
        },
        { status: 400 },
      );
    }

    // Call OpenOcean Swap API v4 for Base chain (8453)
    // Using the basic swap API endpoint as per v4 documentation
    // Note: v4 API requires amountDecimals and gasPriceDecimals instead of amount/gasPrice
    
    // Get current gas price for Base network (in wei)
    const currentGasPrice = '1000000000'; // 1 GWEI in wei (reasonable for Base)
    
    const params = new URLSearchParams({
      chain: '8453', // Base chain ID
      inTokenAddress: sellToken,
      outTokenAddress: buyToken,
      amountDecimals: sellAmount, // Amount in wei (smallest unit) - v4 parameter
      account: takerAddress,
      slippage: slippagePercentage.toString(), // Decimal format (0.015 for 1.5%)
      gasPriceDecimals: currentGasPrice, // Gas price in wei - v4 parameter
    });
    
    // Add receiver address if different from taker (for direct token delivery)
    if (receiverAddress && receiverAddress !== takerAddress) {
      params.append('receiver', receiverAddress);
      console.log('🎯 Receiver address specified:', receiverAddress);
    }

    const url = `https://open-api.openocean.finance/v4/8453/swap?${params}`;
    
    console.log('🌊 OpenOcean v4 Parameters:', {
      chain: '8453',
      inTokenAddress: sellToken,
      outTokenAddress: buyToken, 
      amountDecimals: sellAmount,
      gasPriceDecimals: currentGasPrice,
      slippage: slippagePercentage.toString(),
      account: takerAddress
    });
    
    console.log('🌊 OpenOcean v4 Swap API Request:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FlipTheStockMarket/1.0',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenOcean API Error:', error);
      throw new Error(`OpenOcean API request failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    console.log('🌊 OpenOcean v4 API Response:', JSON.stringify(data, null, 2));

    // Validate v4 API response structure
    if (data.code !== 200 || !data.data) {
      console.error('OpenOcean v4 API Error Response:', data);
      throw new Error(`OpenOcean v4 API error: ${data.error || data.message || 'Unknown error'}`);
    }

    const swapData = data.data;

    // Log detailed token information for debugging decimal issues
    console.log('🌊 OpenOcean v4 Token Information:');
    console.log('   📥 Input Token:', {
      symbol: swapData.inToken?.symbol,
      decimals: swapData.inToken?.decimals,
      amount: swapData.inAmount,
      address: swapData.inToken?.address
    });
    console.log('   📤 Output Token:', {
      symbol: swapData.outToken?.symbol,
      decimals: swapData.outToken?.decimals,
      amount: swapData.outAmount,
      minAmount: swapData.minOutAmount,
      address: swapData.outToken?.address
    });

    // SECURITY: Validate the transaction
    const ALLOWED_ROUTERS = [
      '0x6352a56caadc4f1e25cd6c75970fa768a3304e64', // OpenOcean Exchange V2 (from user's logs)
    ];

    if (!ALLOWED_ROUTERS.includes(swapData.to?.toLowerCase())) {
      console.error('🚨 Unauthorized router detected:', swapData.to);
      return NextResponse.json(
        {
          error: 'Security block: Unauthorized router',
          router: swapData.to,
          allowedRouters: ALLOWED_ROUTERS,
        },
        { status: 403 },
      );
    }

    console.log('✅ OpenOcean security validation passed');

    console.log('🌊 OpenOcean v4 swap data:', {
      to: swapData.to,
      outAmount: swapData.outAmount,
      minOutAmount: swapData.minOutAmount,
      estimatedGas: swapData.estimatedGas,
      value: swapData.value,
      priceImpact: swapData.price_impact
    });

    // Calculate human-readable amounts for verification
    // Use the actual decimals returned by OpenOcean API
    const inputDecimals = swapData.inToken?.decimals || 6; // USDC typically 6 decimals
    const outputDecimals = swapData.outToken?.decimals || 8; // SPX6900 actual decimals from API
    
    const humanInputAmount = Number(swapData.inAmount) / (10 ** inputDecimals);
    const humanOutputAmount = Number(swapData.outAmount) / (10 ** outputDecimals);
    
    console.log('🧮 Human-readable amounts:');
    console.log(`   📥 Input: ${humanInputAmount.toFixed(6)} ${swapData.inToken?.symbol || 'tokens'}`);
    console.log(`   📤 Output: ${humanOutputAmount.toFixed(6)} ${swapData.outToken?.symbol || 'tokens'}`);
    console.log(`   💰 Rate: 1 ${swapData.inToken?.symbol} = ${(humanOutputAmount / humanInputAmount).toFixed(2)} ${swapData.outToken?.symbol}`);

    // Return the transaction data in 0x API compatible format
    return NextResponse.json({
      to: swapData.to,
      data: swapData.data,
      value: swapData.value || '0',
      gas: swapData.estimatedGas?.toString(),
      sellAmount: sellAmount,
      buyAmount: swapData.outAmount, // In token wei units
      allowanceTarget: swapData.to, // OpenOcean uses router for approvals
      price: swapData.inToken?.usd || '0',
      estimatedPriceImpact: swapData.price_impact || '0',
      provider: 'openocean',
      // Additional v4-specific data
      minOutAmount: swapData.minOutAmount,
      tokenInfo: {
        input: swapData.inToken,
        output: swapData.outToken,
        humanReadable: {
          input: `${humanInputAmount.toFixed(6)} ${swapData.inToken?.symbol}`,
          output: `${humanOutputAmount.toFixed(6)} ${swapData.outToken?.symbol}`,
          exchangeRate: `1 ${swapData.inToken?.symbol} = ${(humanOutputAmount / humanInputAmount).toFixed(2)} ${swapData.outToken?.symbol}`
        }
      },
      securityValidation: {
        timestamp: new Date().toISOString(),
        provider: 'OpenOcean v4', 
        routerVerified: true,
        router: swapData.to,
        inputAmount: sellAmount,
        expectedOutput: swapData.outAmount,
        minOutput: swapData.minOutAmount,
      }
    });
  } catch (error) {
    console.error('Failed to get OpenOcean swap:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}