import { NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    
    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress required' }, { status: 400 });
    }
    
    // Get user's latest order
    const orders = await serverDcaDatabase.getUserOrders(userAddress as any);
    
    if (orders.length === 0) {
      return NextResponse.json({ message: 'No orders found' });
    }
    
    // Get the latest order
    const latestOrder = orders.sort((a, b) => b.createdAt - a.createdAt)[0];
    
    console.log('🔍 Latest order for', userAddress);
    console.log('   Order ID:', latestOrder.id);
    console.log('   Created at:', new Date(latestOrder.createdAt).toISOString());
    console.log('   Status:', latestOrder.status);
    console.log('   Session key data:', latestOrder.sessionKeyData);
    
    // Try to parse session key data
    let sessionData = null;
    try {
      sessionData = JSON.parse(latestOrder.sessionKeyData);
    } catch (e) {
      console.log('   Could not parse session key data');
    }
    
    return NextResponse.json({
      order: latestOrder,
      sessionData,
      wasServerManaged: sessionData?.serverManaged === true,
      hasAgentKeyId: !!sessionData?.agentKeyId
    });
    
  } catch (error) {
    console.error('Failed to get last order:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}