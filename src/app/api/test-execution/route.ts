import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🔍 Testing DCA execution detection...');

    // Get orders due for execution
    console.log('📋 Checking for orders due for execution...');
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();
    
    console.log(`Found ${ordersToExecute.length} orders ready for execution`);
    
    // Also check all active orders for debugging
    const allActiveOrders = await serverDcaDatabase.getAllActiveOrders();
    console.log(`Found ${allActiveOrders.length} total active orders`);
    
    const result = {
      success: true,
      ordersReadyForExecution: ordersToExecute.length,
      totalActiveOrders: allActiveOrders.length,
      readyOrders: ordersToExecute.map(order => ({
        id: order.id,
        userAddress: order.userAddress,
        status: order.status,
        executionsCompleted: order.executionsCompleted,
        totalExecutions: order.totalExecutions,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      allActiveOrders: allActiveOrders.map(order => {
        let orderData: any = {};
        try {
          orderData = typeof order.sessionKeyData === 'string' 
            ? JSON.parse(order.sessionKeyData) 
            : order.sessionKeyData;
        } catch (e) {
          // Invalid JSON
        }
        
        return {
          id: order.id,
          userAddress: order.userAddress,
          status: order.status,
          executionsCompleted: order.executionsCompleted,
          executionsCount: order.executionsCount,
          totalExecutions: order.totalExecutions,
          createdAt: order.createdAt,
          createdAtDate: new Date(order.createdAt).toISOString(),
          updatedAt: order.updatedAt,
          nextExecutionAt: order.nextExecutionAt,
          nextExecutionAtDate: new Date(order.nextExecutionAt).toISOString(),
          currentTime: new Date().toISOString(),
          frequency: order.frequency || 'Not set in order',
          sessionFrequency: orderData.frequency || 'Not set in session',
          agentKeyId: orderData.agentKeyId || 'Not set',
          timeUntilExecution: order.nextExecutionAt - Date.now(),
        };
      })
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error testing DCA execution:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}