import { type NextRequest, NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../../lib/serverDcaDatabase';
import { zerodevSessionKeyService } from '../../../../services/zerodevSessionKeyService';
import { balanceChecker } from '../../../../utils/balanceChecker';

export const runtime = 'edge';

// This cron job should be called every minute to check for DCA orders ready for execution
export async function GET(request: NextRequest) {
  // Verify the request is coming from Vercel's Cron system
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('DCA execution cron job started');

    // Get orders ready for execution
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();

    if (ordersToExecute.length === 0) {
      console.log('No DCA orders ready for execution');
      return NextResponse.json({
        success: true,
        message: 'No orders ready for execution',
        processed: 0,
      });
    }

    console.log(`Found ${ordersToExecute.length} orders ready for execution`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each order
    for (const order of ordersToExecute) {
      try {
        console.log(
          `Processing DCA order ${order.id} for user ${order.userAddress}`,
        );

        // Check balance before execution
        const balanceResult = await balanceChecker.checkUserBalance(
          order.userAddress,
        );
        const amountPerOrder =
          order.totalAmount / BigInt(order.totalExecutions);

        if (
          balanceResult.hasInsufficientBalance ||
          balanceResult.currentBalance < amountPerOrder
        ) {
          console.log(`❌ Insufficient balance for order ${order.id}`);
          console.log(`- Required: ${amountPerOrder.toString()}`);
          console.log(
            `- Available: ${balanceResult.currentBalance.toString()}`,
          );

          // Update order status to insufficient_balance
          await serverDcaDatabase.updateOrderStatus(
            order.id,
            'insufficient_balance',
          );

          results.push({
            orderId: order.id,
            userAddress: order.userAddress,
            success: false,
            error: `Insufficient USDC balance. Required: ${(Number(amountPerOrder) / 1e6).toFixed(2)}, Available: ${(Number(balanceResult.currentBalance) / 1e6).toFixed(2)}`,
          });

          failureCount++;
          continue;
        }

        // Execute the order with real swap transaction
        const result = await executeOrder(order);

        if (result.success) {
          successCount++;
          console.log(`✅ Successfully executed order ${order.id}`);
        } else {
          failureCount++;
          console.error(
            `❌ Failed to execute order ${order.id}:`,
            result.error,
          );
        }

        results.push({
          orderId: order.id,
          userAddress: order.userAddress,
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing order ${order.id}:`, error);

        results.push({
          orderId: order.id,
          userAddress: order.userAddress,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `DCA execution completed: ${successCount} success, ${failureCount} failures`,
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${ordersToExecute.length} orders`,
      processed: ordersToExecute.length,
      successful: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error('DCA execution cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
      },
      { status: 500 },
    );
  }
}

// Execute DCA order with real on-chain transaction
async function executeOrder(order: any): Promise<{
  success: boolean;
  error?: string;
  txHash?: string;
  amountOut?: string;
}> {
  try {
    console.log(
      `Executing DCA order ${order.id} for user ${order.userAddress}`,
    );

    // Calculate amount per order (total amount / total executions)
    const amountPerOrder = order.totalAmount / BigInt(order.totalExecutions);
    console.log(
      `- Amount per order: ${amountPerOrder.toString()} wei (${order.fromToken})`,
    );
    console.log(`- Target token: ${order.toToken}`);

    // Step 1: Parse session key data
    console.log('Loading session key data...');
    console.log(`- Raw sessionKeyData: ${order.sessionKeyData}`);
    console.log(`- sessionKeyData type: ${typeof order.sessionKeyData}`);
    console.log(
      `- sessionKeyData exists: ${order.sessionKeyData !== undefined && order.sessionKeyData !== null}`,
    );

    let sessionKeyData;
    try {
      sessionKeyData = JSON.parse(order.sessionKeyData);
      console.log('- Parsed sessionKeyData:', sessionKeyData);
    } catch (parseError) {
      console.log('❌ Failed to parse session key data:', parseError);
      return {
        success: false,
        error: 'Invalid session key data format',
      };
    }

    console.log(
      `- Session key: ${sessionKeyData.sessionAddress || 'undefined'}`,
    );

    // Step 2: Check if session key is still valid
    const now = Math.floor(Date.now() / 1000);

    // Session key uses 'validUntil' field, not 'expiresAt'
    const expirationTime =
      sessionKeyData.validUntil || sessionKeyData.expiresAt;

    if (!expirationTime) {
      console.log('❌ Session key missing expiration time');
      return {
        success: false,
        error: 'Session key missing expiration data',
      };
    }

    // Ensure expirationTime is a number (might be stored as string)
    const expirationTimeNumber =
      typeof expirationTime === 'string'
        ? Number.parseInt(expirationTime)
        : expirationTime;

    console.log('🔍 Session key expiration debug:');
    console.log('- Raw expirationTime:', expirationTime, typeof expirationTime);
    console.log(
      '- Parsed expirationTimeNumber:',
      expirationTimeNumber,
      typeof expirationTimeNumber,
    );
    console.log('- Is valid number?', !isNaN(expirationTimeNumber));

    try {
      const expirationDate = new Date(expirationTimeNumber * 1000);
      console.log(`- Expires at: ${expirationDate.toISOString()}`);
      console.log(`- Current time: ${new Date(now * 1000).toISOString()}`);
      console.log(
        `- Valid for: ${Math.round((expirationTimeNumber - now) / 3600)} hours`,
      );

      if (now > expirationTimeNumber) {
        console.log('❌ Session key has expired');
        return {
          success: false,
          error: 'Session key has expired. Please create a new DCA order.',
        };
      }

      console.log('✅ Session key is still valid');
    } catch (dateError) {
      console.log('❌ Invalid expiration time:', expirationTime, dateError);
      return {
        success: false,
        error: 'Invalid session key expiration format',
      };
    }

    // Step 3: Execute DCA swap using ZeroDev session key service
    // This handles OpenOcean swap creation and execution with gas sponsorship
    console.log('Executing DCA swap with ZeroDev session key...');

    const executionResult = await zerodevSessionKeyService.executeDCASwap(
      sessionKeyData,
      amountPerOrder,
      order.destinationAddress || order.userAddress, // SPX tokens go directly to external wallet
    );

    if (!executionResult.success) {
      console.log(`❌ Transaction execution failed: ${executionResult.error}`);
      return {
        success: false,
        error: executionResult.error,
      };
    }

    const realTxHash = executionResult.txHash!;
    console.log(`✅ Real transaction confirmed: ${realTxHash}`);
    console.log(
      `- Gas used: ${executionResult.gasUsed?.toString() || 'unknown'}`,
    );

    // Step 4: Record execution in database
    const executionTime = Math.floor(Date.now() / 1000);

    await serverDcaDatabase.recordExecution({
      orderId: order.id,
      amountIn: amountPerOrder,
      amountOut: BigInt(executionResult.amountOut || '0'), // Actual SPX tokens received
      txHash: realTxHash,
      executedAt: executionTime,
      status: 'completed',
      gasUsed: executionResult.gasUsed || BigInt('21000'),
      gasPrice: BigInt('1000000000'), // Gas sponsored by ZeroDev
      blockNumber: 0, // Will be updated when we get actual transaction receipt
    });

    console.log(`✅ Order ${order.id} executed successfully`);
    console.log(`- Real TX Hash: ${realTxHash}`);
    console.log(`- BaseScan: https://basescan.org/tx/${realTxHash}`);
    console.log(`- Amount in: ${amountPerOrder.toString()}`);
    console.log(
      `- Gas used: ${executionResult.gasUsed?.toString() || 'unknown'}`,
    );

    return {
      success: true,
      txHash: realTxHash,
      amountOut: executionResult.amountOut || '0',
    };
  } catch (error) {
    console.error(`Failed to execute order ${order.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}

// Allow POST requests for manual testing (without auth)
export async function POST() {
  try {
    console.log('Manual DCA execution trigger');

    // Get orders ready for execution
    const ordersToExecute = await serverDcaDatabase.getOrdersDueForExecution();

    if (ordersToExecute.length === 0) {
      return NextResponse.json({
        message: 'No DCA orders ready for execution',
        ordersFound: 0,
        processed: 0,
      });
    }

    console.log(`Found ${ordersToExecute.length} orders ready for execution`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each order
    for (const order of ordersToExecute) {
      try {
        console.log(
          `Processing DCA order ${order.id} for user ${order.userAddress}`,
        );

        // Check balance before execution
        const balanceResult = await balanceChecker.checkUserBalance(
          order.userAddress,
        );
        const amountPerOrder =
          order.totalAmount / BigInt(order.totalExecutions);

        if (
          balanceResult.hasInsufficientBalance ||
          balanceResult.currentBalance < amountPerOrder
        ) {
          console.log(`❌ Insufficient balance for order ${order.id}`);
          console.log(`- Required: ${amountPerOrder.toString()}`);
          console.log(
            `- Available: ${balanceResult.currentBalance.toString()}`,
          );

          // Update order status to insufficient_balance
          await serverDcaDatabase.updateOrderStatus(
            order.id,
            'insufficient_balance',
          );

          results.push({
            orderId: order.id,
            userAddress: order.userAddress,
            success: false,
            error: `Insufficient USDC balance. Required: ${(Number(amountPerOrder) / 1e6).toFixed(2)}, Available: ${(Number(balanceResult.currentBalance) / 1e6).toFixed(2)}`,
          });

          failureCount++;
          continue;
        }

        // Execute the order with real swap transaction
        const result = await executeOrder(order);

        if (result.success) {
          successCount++;
          console.log(`✅ Successfully executed order ${order.id}`);
        } else {
          failureCount++;
          console.error(
            `❌ Failed to execute order ${order.id}:`,
            result.error,
          );
        }

        results.push({
          orderId: order.id,
          userAddress: order.userAddress,
          success: result.success,
          error: result.error,
          txHash: result.txHash,
          amountOut: result.amountOut,
        });
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing order ${order.id}:`, error);

        results.push({
          orderId: order.id,
          userAddress: order.userAddress,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `Manual DCA execution completed: ${successCount} success, ${failureCount} failures`,
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${ordersToExecute.length} orders`,
      ordersFound: ordersToExecute.length,
      processed: ordersToExecute.length,
      successful: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
