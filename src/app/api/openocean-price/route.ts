import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sellToken = searchParams.get('sellToken');
    const buyToken = searchParams.get('buyToken');
    const sellAmount = searchParams.get('sellAmount');
    const taker =
      searchParams.get('taker') || '0x1111111111111111111111111111111111111111';

    if (!sellToken || !buyToken || !sellAmount) {
      return NextResponse.json(
        {
          error: 'Missing required parameters: sellToken, buyToken, sellAmount',
        },
        { status: 400 },
      );
    }

    // Build OpenOcean API URL
    const params = new URLSearchParams({
      chain: '8453', // Base chain ID
      inTokenAddress: sellToken,
      outTokenAddress: buyToken,
      amountDecimals: sellAmount, // Amount in wei
      account: taker,
      slippage: '0.015', // 1.5% default slippage
      gasPriceDecimals: '1000000000', // 1 GWEI in wei
    });

    const url = `https://open-api.openocean.finance/v4/8453/quote?${params}`;
    console.log('🌊 OpenOcean Price Request:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FlipTheStockMarket/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenOcean API Error:', errorText);
      throw new Error(
        `OpenOcean API request failed: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();
    console.log('🌊 OpenOcean Price Response:', data);

    if (data.code !== 200 || !data.data) {
      throw new Error(
        `OpenOcean API error: ${data.error || data.message || 'Unknown error'}`,
      );
    }

    const quoteData = data.data;

    // Calculate human-readable price
    const inputDecimals = quoteData.inToken?.decimals || 6;
    const outputDecimals = quoteData.outToken?.decimals || 8;

    const humanInputAmount = Number(quoteData.inAmount) / 10 ** inputDecimals;
    const humanOutputAmount =
      Number(quoteData.outAmount) / 10 ** outputDecimals;
    const price = (humanOutputAmount / humanInputAmount).toString();

    // Convert OpenOcean's price impact to percentage
    let priceImpact = quoteData.price_impact || '0';
    if (typeof priceImpact === 'number') {
      priceImpact = (priceImpact * 100).toFixed(2);
    } else if (
      typeof priceImpact === 'string' &&
      priceImpact.includes('.') &&
      Number(priceImpact) < 1
    ) {
      // Convert decimal to percentage
      priceImpact = (Number(priceImpact) * 100).toFixed(2);
    } else {
      priceImpact = Number(priceImpact).toFixed(2);
    }

    // Fallback price impact estimation if not provided
    if (priceImpact === '0' || priceImpact === '0.00') {
      const sellAmountUSD = Number(sellAmount) / 1e6; // USDC has 6 decimals
      if (sellAmountUSD > 10000) {
        priceImpact = '5.0';
      } else if (sellAmountUSD > 5000) {
        priceImpact = '3.0';
      } else if (sellAmountUSD > 1000) {
        priceImpact = '1.5';
      } else if (sellAmountUSD > 100) {
        priceImpact = '0.8';
      } else {
        priceImpact = '0.3';
      }
    }

    // Return in 0x-compatible format for easy migration
    return NextResponse.json({
      price,
      estimatedPriceImpact: priceImpact,
      buyAmount: quoteData.outAmount,
      sellAmount: sellAmount,
      buyToken: buyToken,
      sellToken: sellToken,
      gas: quoteData.estimatedGas?.toString() || '300000',
      gasPrice: '1000000000', // 1 GWEI
      route: {
        protocol: 'OpenOcean',
        source: 'OpenOcean V4',
        sources: quoteData.path
          ? [{ name: 'OpenOcean Aggregated DEXs', proportion: '1' }]
          : [],
      },
    });
  } catch (error) {
    console.error('Error in OpenOcean price API:', error);
    return NextResponse.json(
      {
        error: `Failed to fetch OpenOcean price data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    );
  }
}
