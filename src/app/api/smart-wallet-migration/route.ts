import { type NextRequest, NextResponse } from 'next/server';
import type { Address } from 'viem';
import { SmartWalletMigrationService } from '../../../services/smartWalletMigrationService';

export const runtime = 'edge';

const migrationService = new SmartWalletMigrationService();

// GET: Discover old smart wallets with funds
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 },
      );
    }

    console.log('🔍 Discovering old smart wallets for:', userAddress);

    const oldWallets = await migrationService.discoverOldWallets(
      userAddress as Address,
    );

    return NextResponse.json({
      success: true,
      oldWallets,
      count: oldWallets.length,
      message:
        oldWallets.length > 0
          ? `Found ${oldWallets.length} old smart wallet(s) with funds`
          : 'No old smart wallets with funds found',
    });
  } catch (error) {
    console.error('❌ Discovery error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to discover old wallets',
      },
      { status: 500 },
    );
  }
}

// POST: Execute migration (or generate manual instructions)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      oldWalletAddress,
      oldWalletKernelVersion,
      destinationAddress,
      userAddress,
      migrationType, // 'new_wallet' | 'external'
      executeImmediately = false,
    } = body;

    if (
      !oldWalletAddress ||
      !destinationAddress ||
      !userAddress ||
      !migrationType
    ) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    console.log('🚀 Migration request:', {
      from: oldWalletAddress,
      to: destinationAddress,
      type: migrationType,
      immediate: executeImmediately,
    });

    // First, get the old wallet info
    const oldWallets = await migrationService.discoverOldWallets(
      userAddress as Address,
    );
    const oldWallet = oldWallets.find(
      (w) => w.address.toLowerCase() === oldWalletAddress.toLowerCase(),
    );

    if (!oldWallet) {
      return NextResponse.json(
        { error: 'Old wallet not found or has no funds' },
        { status: 404 },
      );
    }

    // Create migration transactions
    const transactions = await migrationService.createMigrationTransactions(
      oldWallet,
      destinationAddress as Address,
      migrationType,
    );

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No funds to migrate' },
        { status: 400 },
      );
    }

    if (executeImmediately) {
      // Execute migration with gas sponsorship using server-side executor
      try {
        const { ServerMigrationExecutor } = await import(
          '../../../services/serverMigrationExecutor'
        );
        const executor = new ServerMigrationExecutor();

        const txHashes = await executor.executeMigration(
          oldWallet,
          transactions,
        );

        return NextResponse.json({
          success: true,
          executed: true,
          transactionHashes: txHashes,
          transactions,
          message: 'Migration executed successfully with gas sponsorship!',
        });
      } catch (executionError) {
        console.log('⚠️ Automatic execution failed:', executionError);
        console.log('📋 Providing manual instructions as fallback');

        // Fallback to manual instructions
        const manualInstructions = migrationService.generateManualInstructions(
          oldWallet,
          destinationAddress as Address,
          migrationType,
        );

        return NextResponse.json({
          success: true,
          executed: false,
          requiresManualExecution: true,
          manualInstructions,
          transactions,
          executionError:
            executionError instanceof Error
              ? executionError.message
              : 'Unknown error',
          message: 'Automatic execution failed - manual execution required',
        });
      }
    } else {
      // Just return the migration plan
      const manualInstructions = migrationService.generateManualInstructions(
        oldWallet,
        destinationAddress as Address,
        migrationType,
      );

      return NextResponse.json({
        success: true,
        executed: false,
        transactions,
        manualInstructions,
        estimatedGasCost: '0 ETH (sponsored by ZeroDev paymaster)',
        message: 'Migration plan created - ready for execution',
      });
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      },
      { status: 500 },
    );
  }
}
