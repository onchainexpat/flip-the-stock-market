import { NextResponse } from 'next/server';
import { type Address } from 'viem';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

// Test OpenOcean API directly to check if it's working
export async function POST(request: Request) {
  try {
    const { sellAmount = '500000' } = await request.json(); // Default 0.5 USDC
    
    console.log(`🌊 Testing OpenOcean API directly`);
    console.log(`   Sell amount: ${sellAmount} USDC (wei)`);

    const requestBody = {
      sellToken: TOKENS.USDC,
      buyToken: TOKENS.SPX6900,
      sellAmount: sellAmount,
      takerAddress: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE', // Your smart wallet
      receiverAddress: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE',
      slippagePercentage: 0.05,
      gasPrice: 'standard',
      complexityLevel: 0,
      disableEstimate: false,
      allowPartialFill: false,
      preferDirect: true,
      maxHops: 2,
    };

    console.log('📡 Calling OpenOcean API via internal route...');
    console.log('   Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('http://localhost:3000/api/openocean-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`🌊 OpenOcean response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenOcean API failed:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json({
          success: false,
          error: 'OpenOcean API failed',
          details: errorJson,
          requestBody
        });
      } catch (parseError) {
        return NextResponse.json({
          success: false,
          error: 'OpenOcean API failed with non-JSON response',
          details: errorText,
          requestBody
        });
      }
    }

    const data = await response.json();
    console.log('✅ OpenOcean response received');
    console.log(`   Expected output: ${data.outAmount || data.buyAmount || 'unknown'}`);
    console.log(`   Transaction to: ${data.to || 'unknown'}`);
    console.log(`   Data length: ${data.data?.length || 0} characters`);

    return NextResponse.json({
      success: true,
      message: 'OpenOcean API working correctly',
      quote: {
        sellAmount,
        expectedOutput: data.outAmount || data.buyAmount,
        to: data.to,
        dataLength: data.data?.length || 0,
        value: data.value || '0',
        gas: data.gas
      },
      rawResponse: data,
      requestBody
    });

  } catch (error) {
    console.error('❌ OpenOcean direct test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}