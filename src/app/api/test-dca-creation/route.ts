import { NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🧪 Testing fixed serverAgentKeyService...');
    
    // Test agent key generation and retrieval
    const testAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;
    
    console.log('🔧 Step 1: Generate agent key');
    const agentKey = await serverAgentKeyService.generateAgentKey(testAddress);
    
    console.log('🔧 Step 2: Retrieve private key');
    const privateKey = await serverAgentKeyService.getPrivateKey(agentKey.keyId);
    
    console.log('✅ Fixed serverAgentKeyService test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Fixed serverAgentKeyService test successful',
      agentKeyId: agentKey.keyId,
      hasPrivateKey: !!privateKey,
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    let errorMessage = 'Test failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error, null, 2);
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}