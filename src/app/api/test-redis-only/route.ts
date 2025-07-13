import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🧪 Testing Redis client creation...');
    
    const { Redis } = await import('@upstash/redis');
    console.log('✅ Redis import successful');
    
    console.log('🔧 Creating Redis client...');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    console.log('✅ Redis client created');
    
    console.log('🔧 Testing simple Redis operation...');
    await redis.set('simple-test', 'simple-value');
    const result = await redis.get('simple-test');
    await redis.del('simple-test');
    console.log('✅ Simple Redis operation successful');
    
    return NextResponse.json({
      success: true,
      message: 'Simple Redis operation successful',
      result,
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