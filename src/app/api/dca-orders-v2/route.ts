import { type NextRequest, NextResponse } from 'next/server';
import type { Address } from 'viem';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import { dcaGelatoContractService } from '../../../services/dcaGelatoContractService';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

// Create new automated DCA order with server-side agent key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      smartWalletAddress,
      totalAmount,
      frequency,
      duration,
      platformFeePercentage = 0,
      estimatedPriceImpact,
      agentKeyId, // Pre-created client-side gasless agent key
      sessionPrivateKey, // Legacy fallback
      sessionKeyApproval, // Legacy fallback
    } = body;

    // Validate inputs
    if (
      !userAddress ||
      !smartWalletAddress ||
      !totalAmount ||
      !frequency ||
      !duration
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: userAddress, smartWalletAddress, totalAmount, frequency, duration',
        },
        { status: 400 },
      );
    }

    // Note: agentKeyId and sessionKeyApproval are optional - fallback will generate new key if needed

    const totalAmountWei = BigInt(
      Math.floor(Number.parseFloat(totalAmount) * 1e6),
    );
    const platformFees =
      (totalAmountWei * BigInt(Math.floor(platformFeePercentage * 100))) /
      10000n;
    const netAmount = totalAmountWei - platformFees;

    // Duration is sent as total executions, not days
    const totalExecutions = Number.parseInt(duration);
    let frequencyMs = 0;

    switch (frequency) {
      case 'hourly':
        frequencyMs = 60 * 60 * 1000;
        break;
      case 'daily':
        frequencyMs = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        frequencyMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        frequencyMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid frequency' },
          { status: 400 },
        );
    }

    // Calculate amount per order
    const amountPerOrder = netAmount / BigInt(totalExecutions);

    console.log('🚀 Creating automated DCA order with server agent key...');
    console.log('   User:', userAddress);
    console.log('   Total amount:', totalAmount, 'USDC');
    console.log('   Executions:', totalExecutions);
    console.log(
      '   Amount per order:',
      (Number(amountPerOrder) / 1e6).toFixed(2),
      'USDC',
    );
    console.log('   Session key approval provided:', !!sessionKeyApproval);
    console.log(
      '   Session key approval length:',
      sessionKeyApproval?.length || 0,
    );

    // Step 1: Store session key for automated execution
    console.log('📝 Step 1: Storing session key for automation...');
    console.log('   Smart wallet:', smartWalletAddress);
    console.log('   User address:', userAddress);

    // Handle agent key creation or retrieval
    let agentKey;
    try {
      if (agentKeyId) {
        // Use pre-created client-side gasless agent key
        console.log('🔑 Using pre-created gasless agent key:', agentKeyId);
        agentKey = await serverAgentKeyService.getAgentKey(agentKeyId);
        if (!agentKey) {
          throw new Error(`Pre-created agent key not found: ${agentKeyId}`);
        }
        console.log('✅ Gasless agent key retrieved successfully');
      } else if (sessionPrivateKey) {
        // Legacy: Create agent key using the provided session key
        console.log('🔑 Creating legacy agent key from session data...');
        agentKey = await serverAgentKeyService.storeSessionKey(
          userAddress as Address,
          smartWalletAddress as Address,
          sessionPrivateKey,
          sessionKeyApproval,
        );
        console.log('✅ Legacy agent key created');
      } else if (sessionKeyApproval) {
        // Session key approval only (from simplified service)
        console.log('🔑 Creating agent key from session key approval only...');
        // Generate a dummy private key since we only have the approval
        const dummyPrivateKey = '0x' + '1'.repeat(64);
        agentKey = await serverAgentKeyService.storeSessionKey(
          userAddress as Address,
          smartWalletAddress as Address,
          dummyPrivateKey as `0x${string}`,
          sessionKeyApproval,
        );
        console.log('✅ Agent key created with session approval only');
      } else {
        // Fallback: generate new key (for backward compatibility)
        console.log('🔑 Generating fallback agent key...');
        agentKey = await serverAgentKeyService.generateAgentKey(
          userAddress as Address,
        );
        await serverAgentKeyService.updateAgentKey(agentKey.keyId, {
          smartWalletAddress: smartWalletAddress as Address,
        });
        console.log('✅ Fallback agent key created');
      }
    } catch (error) {
      console.error('❌ Failed to handle agent key:', error);
      throw new Error(
        `Agent key handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    console.log('✅ Agent key created:', agentKey.keyId);
    console.log('🔐 Agent key linked to smart wallet:', smartWalletAddress);

    // Step 2: Create DCA order in database
    console.log('📝 Step 2: Creating DCA order in database...');
    const now = Date.now();

    let order;
    try {
      order = await serverDcaDatabase.createOrder({
        userAddress: userAddress as Address,
        sessionKeyAddress: smartWalletAddress as Address, // Using provided smart wallet address
        sessionKeyData: JSON.stringify({
          agentKeyId: agentKey.keyId,
          smartWalletAddress: smartWalletAddress,
          serverManaged: true,
          createdAt: now,
          sessionKeyApproval: sessionKeyApproval, // Store approval in order data for redundancy
        }),

        // Order parameters
        fromToken: TOKENS.USDC,
        toToken: TOKENS.SPX6900,
        destinationAddress: userAddress as Address, // SPX goes to user wallet
        totalAmount: totalAmountWei,
        frequency,
        duration: totalExecutions,

        // Fee tracking
        platformFeePercentage,
        totalPlatformFees: platformFees,
        netInvestmentAmount: netAmount,

        // Execution tracking
        status: 'active',
        executedAmount: BigInt(0),
        executionsCount: 0,
        totalExecutions,
        // Note: amountPerOrder is calculated as totalAmount / totalExecutions

        // Price impact
        estimatedPriceImpact,

        // Timestamps
        createdAt: now,
        nextExecutionAt: now, // First execution immediately
        expiresAt: now + totalExecutions * frequencyMs, // Expire after all executions complete

        // Transaction hashes
        executionTxHashes: [],
      });
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      throw new Error(
        `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`,
      );
    }

    console.log('✅ DCA order created:', order.id);

    // Step 3: Register order with Gelato automation contract
    console.log('📝 Step 3: Registering order with Gelato contract...');
    let contractResult;
    try {
      contractResult = await dcaGelatoContractService.createOrder(
        {
          user: userAddress as Address,
          smartWallet: smartWalletAddress as Address,
          agentKeyId: agentKey.keyId,
          amountPerExecution: amountPerOrder,
          frequency: Math.floor(frequencyMs / 1000), // Convert to seconds
          totalExecutions: totalExecutions,
        },
        now,
      );

      if (contractResult.success) {
        console.log(
          '✅ Order registered with Gelato contract:',
          contractResult.orderId,
        );
        console.log('   Transaction hash:', contractResult.txHash);
      } else {
        console.warn(
          '⚠️ Failed to register with contract (order still created):',
          contractResult.error,
        );
      }
    } catch (contractError) {
      console.warn(
        '⚠️ Contract registration error (order still created):',
        contractError,
      );
      contractResult = { success: false, error: String(contractError) };
    }

    // Step 4: Return order details and funding instructions
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        smartWalletAddress: smartWalletAddress,
        totalAmount: totalAmount,
        frequency: frequency,
        duration: duration,
        totalExecutions: totalExecutions,
        amountPerExecution: (
          Number.parseFloat(totalAmount) / totalExecutions
        ).toFixed(2),
        nextExecutionAt: new Date(order.nextExecutionAt).toISOString(),
        expiresAt: new Date(order.expiresAt).toISOString(),
        gelatoContractId: contractResult?.orderId,
        gelatoRegistered: contractResult?.success || false,
      },
      fundingInstructions: {
        message: 'Transfer USDC to the smart wallet to activate automated DCA',
        smartWalletAddress: smartWalletAddress,
        requiredAmount: totalAmount,
        tokenAddress: TOKENS.USDC,
        network: 'Base',
      },
    });
  } catch (error) {
    console.error('Failed to create automated DCA order:', error);

    // Enhanced error handling
    let errorMessage = 'Failed to create order';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

// Get user's DCA orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 },
      );
    }

    const orders = await serverDcaDatabase.getUserOrders(
      userAddress as Address,
    );

    // Filter to only show V2 orders with server-managed keys
    const v2Orders = orders.filter((order) => {
      try {
        const data = JSON.parse(order.sessionKeyData);
        return data.serverManaged === true;
      } catch {
        return false;
      }
    });

    // Format orders for response
    const formattedOrders = v2Orders.map((order) => {
      const data = JSON.parse(order.sessionKeyData);
      return {
        id: order.id,
        status: order.status,
        smartWalletAddress: data.smartWalletAddress,
        totalAmount: (Number(order.totalAmount) / 1e6).toFixed(2),
        executedAmount: (Number(order.executedAmount) / 1e6).toFixed(2),
        frequency: order.frequency,
        duration: order.duration,
        executionsCount: order.executionsCount,
        totalExecutions: order.totalExecutions,
        nextExecutionAt: order.nextExecutionAt
          ? new Date(order.nextExecutionAt).toISOString()
          : null,
        createdAt: new Date(order.createdAt).toISOString(),
        transactions: order.executionTxHashes,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error('Failed to get DCA orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get orders',
      },
      { status: 500 },
    );
  }
}
