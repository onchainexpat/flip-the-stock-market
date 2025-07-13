import { type NextRequest, NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../../services/serverAgentKeyService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentKeyId = searchParams.get('agentKeyId');
    
    if (!agentKeyId) {
      return NextResponse.json({ error: 'agentKeyId required' }, { status: 400 });
    }

    // Get the raw Redis data to see what's actually stored
    const Redis = require('@upstash/redis');
    const redis = new Redis.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const rawData = await redis.get(`agent:key:${agentKeyId}`);
    console.log('Raw Redis data:', rawData);

    // Get via service
    const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
    console.log('Service data:', agentKeyData);

    return NextResponse.json({
      success: true,
      agentKeyId,
      rawData,
      serviceData: agentKeyData,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}