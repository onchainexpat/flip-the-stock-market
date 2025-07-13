/**
 * API endpoint for managing Gelato DCA tasks
 * Handles task creation, monitoring, and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { gelatoDCAService } from '../../../../services/gelatoDCAService';

export const runtime = 'edge';

// POST: Create a new Gelato DCA task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskName, userArgs } = body;

    if (!taskName || !userArgs) {
      return NextResponse.json(
        { error: 'Missing taskName or userArgs' },
        { status: 400 }
      );
    }

    console.log('📋 Creating Gelato DCA task:', taskName);

    // Create the task
    const createResult = await gelatoDCAService.createDCATask(taskName, userArgs);
    
    if (!createResult.success) {
      return NextResponse.json(
        { error: createResult.error },
        { status: 500 }
      );
    }

    // Fund the task with ETH
    const fundResult = await gelatoDCAService.fundTask(
      createResult.taskId!,
      '0.05' // 0.05 ETH initial funding
    );

    return NextResponse.json({
      success: true,
      taskId: createResult.taskId,
      funded: fundResult.success,
      fundingTxHash: fundResult.txHash,
      message: 'Gelato DCA task created and funded successfully'
    });

  } catch (error) {
    console.error('❌ Gelato task creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create Gelato task' },
      { status: 500 }
    );
  }
}

// GET: Get task status and information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    const action = url.searchParams.get('action');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'status':
        const statusResult = await gelatoDCAService.getTaskStatus(taskId);
        return NextResponse.json(statusResult);

      case 'logs':
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const logsResult = await gelatoDCAService.getExecutionLogs(taskId, limit);
        return NextResponse.json(logsResult);

      case 'health':
        const healthResult = await gelatoDCAService.monitorTaskHealth(taskId);
        return NextResponse.json(healthResult);

      default:
        // Default: return comprehensive task information
        const [status, logs, health] = await Promise.all([
          gelatoDCAService.getTaskStatus(taskId),
          gelatoDCAService.getExecutionLogs(taskId, 10),
          gelatoDCAService.monitorTaskHealth(taskId)
        ]);

        return NextResponse.json({
          taskId,
          status: status.success ? status.status : null,
          recentExecutions: logs.success ? logs.executions : [],
          health: health.success ? health.health : null,
          timestamp: Date.now()
        });
    }

  } catch (error) {
    console.error('❌ Gelato task query failed:', error);
    return NextResponse.json(
      { error: 'Failed to get task information' },
      { status: 500 }
    );
  }
}

// DELETE: Cancel a Gelato task
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      );
    }

    console.log('🛑 Cancelling Gelato task:', taskId);

    const result = await gelatoDCAService.cancelTask(taskId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Gelato task cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Gelato task cancellation failed:', error);
    return NextResponse.json(
      { error: 'Failed to cancel Gelato task' },
      { status: 500 }
    );
  }
}