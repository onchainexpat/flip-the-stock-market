import { NextRequest, NextResponse } from 'next/server';
import { dcaGelatoContractService } from '../../../services/dcaGelatoContractService';

export async function GET() {
  try {
    console.log('🔧 Testing DCA Contract Service...');
    
    // Get contract info
    const contractInfo = dcaGelatoContractService.getContractInfo();
    console.log('📋 Contract Info:', contractInfo);
    
    // Test read access
    const checkResult = await dcaGelatoContractService.checkReadyOrders();
    console.log('🔍 Ready orders check:', checkResult);
    
    // Test contract creation (dry run)
    const testOrderId = dcaGelatoContractService.generateOrderId(
      '0x742d35Cc6Af66532925a3b8D428a78D94c59a621' as any,
      Date.now()
    );
    console.log('🆔 Generated test order ID:', testOrderId);
    
    return NextResponse.json({
      success: true,
      contractInfo,
      checkResult,
      testOrderId,
      hasWallet: !!contractInfo.hasWallet,
      canWrite: !!contractInfo.hasWallet
    });
    
  } catch (error) {
    console.error('❌ Contract test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}