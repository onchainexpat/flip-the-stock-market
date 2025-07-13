import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { gaslessDCAExecutor } from '../../../services/gaslessDCAExecutor';
import { parseUnits, type Address } from 'viem';

export const runtime = 'nodejs';

// Test gasless DCA execution with different approaches
export async function POST(request: Request) {
  try {
    const { orderId, approach = 'gasless', testAmount = '1' } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing gasless execution for order: ${orderId}`);
    console.log(`   Approach: ${approach}`);
    console.log(`   Test amount: ${testAmount} USDC`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Parse order data
    const orderData = typeof order.sessionKeyData === 'string' 
      ? JSON.parse(order.sessionKeyData) 
      : order.sessionKeyData;

    if (!orderData.agentKeyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key ID not found' 
      }, { status: 400 });
    }

    const smartWalletAddress = order.sessionKeyAddress as Address;
    const userWalletAddress = order.userAddress as Address;
    const swapAmount = parseUnits(testAmount, 6); // USDC has 6 decimals

    console.log(`🔍 Testing with:`);
    console.log(`   Agent key: ${orderData.agentKeyId}`);
    console.log(`   Smart wallet: ${smartWalletAddress}`);
    console.log(`   User wallet: ${userWalletAddress}`);
    console.log(`   Swap amount: ${swapAmount.toString()} (${testAmount} USDC)`);

    let result;

    if (approach === 'gasless') {
      console.log('🚀 Testing primary gasless execution...');
      result = await gaslessDCAExecutor.executeDCAWithGasSponsorship(
        orderData.agentKeyId,
        smartWalletAddress,
        userWalletAddress,
        swapAmount,
      );
    } else if (approach === 'alternative') {
      console.log('🚀 Testing alternative paymaster execution...');
      result = await gaslessDCAExecutor.executeDCAWithAlternativePaymaster(
        orderData.agentKeyId,
        smartWalletAddress,
        userWalletAddress,
        swapAmount,
      );
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid approach. Use "gasless" or "alternative"' 
      }, { status: 400 });
    }

    console.log('🏁 Gasless execution test completed');
    console.log(`   Success: ${result.success}`);
    if (result.success) {
      console.log(`   Gas sponsored: ${result.gasSponsored}`);
      console.log(`   Transaction hash: ${result.txHash}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Gasless execution test completed',
      orderId,
      approach,
      testAmount,
      executionResult: result,
      details: {
        agentKeyId: orderData.agentKeyId,
        smartWalletAddress,
        userWalletAddress,
        swapAmountWei: swapAmount.toString()
      }
    });

  } catch (error) {
    console.error('❌ Gasless execution test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}