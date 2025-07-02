import { http, type Address, createPublicClient } from 'viem';
import { base } from 'viem/chains';

export interface MigrationTransaction {
  to: Address;
  value: string; // Hex string instead of bigint for JSON serialization
  data: string;
  description: string;
}

export interface OldWalletInfo {
  address: Address;
  kernelVersion: string;
  usdcBalance: string;
  ethBalance: string;
  isDeployed: boolean;
}

export class SmartWalletMigrationService {
  private publicClient;
  private projectId: string;

  constructor() {
    this.projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
    // Use public Base RPC for balance checking (more reliable than ZeroDev RPC)
    this.publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });
  }

  /**
   * Discover old smart wallets from different kernel versions
   */
  async discoverOldWallets(
    externalWalletAddress: Address,
  ): Promise<OldWalletInfo[]> {
    const wallets: OldWalletInfo[] = [];
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    // Known smart wallet addresses from different kernel versions
    // For now, we'll use the known old wallet address
    const knownOldWallets = [
      {
        address: '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE' as Address,
        kernelVersion: 'KERNEL_V3_1',
      },
    ];

    for (const { address: walletAddress, kernelVersion } of knownOldWallets) {
      try {
        console.log(
          `🔍 Checking ${kernelVersion} smart wallet: ${walletAddress}`,
        );

        // Check if deployed
        const code = await this.publicClient.getBytecode({
          address: walletAddress,
        });
        const isDeployed = code && code !== '0x' && code.length > 2;

        if (!isDeployed) {
          console.log(`⏭️ ${kernelVersion} wallet not deployed`);
          continue;
        }

        // Check balances
        const [usdcBalance, ethBalance] = await Promise.all([
          this.publicClient.readContract({
            address: USDC_ADDRESS,
            abi: [
              {
                constant: true,
                inputs: [{ name: '_owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: 'balance', type: 'uint256' }],
                type: 'function',
              },
            ],
            functionName: 'balanceOf',
            args: [walletAddress],
          }),
          this.publicClient.getBalance({ address: walletAddress }),
        ]);

        const usdcFormatted = (Number(usdcBalance) / 1000000).toFixed(6);
        const ethFormatted = (Number(ethBalance) / 1e18).toFixed(6);

        console.log(
          `💰 ${kernelVersion} balances: ${usdcFormatted} USDC, ${ethFormatted} ETH`,
        );

        // Only include wallets with funds
        if (Number(usdcFormatted) > 0 || Number(ethFormatted) > 0.001) {
          wallets.push({
            address: walletAddress,
            kernelVersion,
            usdcBalance: usdcFormatted,
            ethBalance: ethFormatted,
            isDeployed: true,
          });
        }
      } catch (error) {
        console.log(`❌ Error checking ${kernelVersion}:`, error);
      }
    }

    return wallets;
  }

  /**
   * Create migration transactions from old wallet to new destination
   */
  async createMigrationTransactions(
    oldWallet: OldWalletInfo,
    destinationAddress: Address,
    migrationType: 'new_wallet' | 'external',
  ): Promise<MigrationTransaction[]> {
    const transactions: MigrationTransaction[] = [];
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    // Migrate USDC if available
    if (Number(oldWallet.usdcBalance) > 0) {
      const usdcAmount = BigInt(
        Math.floor(Number(oldWallet.usdcBalance) * 1000000),
      );

      // ERC-20 transfer function signature: transfer(address,uint256)
      const transferData = `0xa9059cbb${destinationAddress.slice(2).padStart(64, '0')}${usdcAmount.toString(16).padStart(64, '0')}`;

      transactions.push({
        to: USDC_ADDRESS,
        value: '0x0', // Convert BigInt to hex string
        data: transferData,
        description: `Transfer ${oldWallet.usdcBalance} USDC to ${migrationType === 'new_wallet' ? 'new smart wallet' : 'external wallet'}`,
      });
    }

    // Migrate ETH if available (keep small amount for potential future use)
    if (Number(oldWallet.ethBalance) > 0.001) {
      const ethToMigrate = BigInt(
        Math.floor((Number(oldWallet.ethBalance) - 0.001) * 1e18),
      );

      transactions.push({
        to: destinationAddress,
        value: `0x${ethToMigrate.toString(16)}`, // Convert BigInt to hex string
        data: '0x',
        description: `Transfer ${(Number(ethToMigrate) / 1e18).toFixed(6)} ETH to ${migrationType === 'new_wallet' ? 'new smart wallet' : 'external wallet'}`,
      });
    }

    return transactions;
  }

  /**
   * Execute migration with gas sponsorship (using the old kernel version)
   */
  async executeMigration(
    oldWallet: OldWalletInfo,
    destinationAddress: Address,
    externalWalletAddress: Address,
    migrationType: 'new_wallet' | 'external',
  ): Promise<string[]> {
    console.log('🚀 Starting gas-sponsored migration...');
    console.log(`📍 From: ${oldWallet.address} (${oldWallet.kernelVersion})`);
    console.log(`📍 To: ${destinationAddress}`);

    // Create migration transactions
    const transactions = await this.createMigrationTransactions(
      oldWallet,
      destinationAddress,
      migrationType,
    );

    if (transactions.length === 0) {
      throw new Error('No funds to migrate');
    }

    // This method is deprecated - use ServerMigrationExecutor instead
    throw new Error(
      'Direct execution moved to ServerMigrationExecutor - use API endpoint for automatic execution',
    );
  }

  /**
   * Generate manual migration instructions for Basescan
   */
  generateManualInstructions(
    oldWallet: OldWalletInfo,
    destinationAddress: Address,
    migrationType: 'new_wallet' | 'external',
  ): {
    basescanUrl: string;
    instructions: string[];
    parameters: any[];
  } {
    const basescanUrl = `https://basescan.org/address/${oldWallet.address}`;

    const instructions = [
      '1. Click the link above to open Basescan',
      '2. Go to Contract → Write Contract',
      '3. Connect your external wallet',
      '4. Use the execute function with the parameters below',
      '5. Confirm the transaction (gas will be sponsored)',
    ];

    // Generate parameters for different wallet types
    const parameters = [];

    if (Number(oldWallet.usdcBalance) > 0) {
      const usdcAmount = BigInt(
        Math.floor(Number(oldWallet.usdcBalance) * 1000000),
      );
      const transferData = `0xa9059cbb${destinationAddress.slice(2).padStart(64, '0')}${usdcAmount.toString(16).padStart(64, '0')}`;

      parameters.push({
        description: `Transfer ${oldWallet.usdcBalance} USDC`,
        execMode:
          '0x0100000000000000000000000000000000000000000000000000000000000000',
        executionCalldata: transferData,
      });
    }

    return {
      basescanUrl,
      instructions,
      parameters,
    };
  }
}
