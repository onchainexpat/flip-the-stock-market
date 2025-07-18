import { createPublicClient, createWalletClient, http, type Address, type Hex, encodeFunctionData, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';

/**
 * Sponsored Funding Service
 * Automatically funds automation wallets from a sponsored USDC pool
 */
export class SponsoredFundingService {
  private static sponsorWallet: any = null;

  /**
   * Initialize the sponsor wallet (master wallet that funds automation wallets)
   */
  static initialize() {
    const sponsorPrivateKey = process.env.SPONSOR_WALLET_PRIVATE_KEY;
    if (!sponsorPrivateKey) {
      console.log('⚠️ No sponsor wallet configured - manual funding required');
      return false;
    }

    this.sponsorWallet = privateKeyToAccount(sponsorPrivateKey as Hex);
    console.log('💰 Sponsor wallet initialized:', this.sponsorWallet.address);
    return true;
  }

  /**
   * Fund an automation wallet with USDC for DCA operations
   */
  static async fundAutomationWallet(
    automationWalletAddress: Address,
    requiredAmount: bigint,
    userAddress: Address
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.sponsorWallet) {
        const initialized = this.initialize();
        if (!initialized) {
          return {
            success: false,
            error: 'Sponsor wallet not configured. Manual funding required.'
          };
        }
      }

      console.log('💰 Sponsoring automation wallet funding...');
      console.log('   Sponsor wallet:', this.sponsorWallet.address);
      console.log('   Automation wallet:', automationWalletAddress);
      console.log('   Amount:', (Number(requiredAmount) / 1e6).toFixed(6), 'USDC');
      console.log('   For user:', userAddress);

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Check sponsor wallet USDC balance
      const sponsorBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [this.sponsorWallet.address],
      }) as bigint;

      console.log('💰 Sponsor USDC balance:', (Number(sponsorBalance) / 1e6).toFixed(6), 'USDC');

      if (sponsorBalance < requiredAmount) {
        return {
          success: false,
          error: `Sponsor wallet has insufficient USDC. Has ${(Number(sponsorBalance) / 1e6).toFixed(6)}, needs ${(Number(requiredAmount) / 1e6).toFixed(6)}`
        };
      }

      // Create wallet client for sponsor
      const walletClient = createWalletClient({
        account: this.sponsorWallet,
        chain: base,
        transport: http(),
      });

      // Transfer USDC to automation wallet
      console.log('💸 Transferring USDC to automation wallet...');
      const transferTx = await walletClient.writeContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [automationWalletAddress, requiredAmount],
      });

      console.log('✅ USDC transfer transaction sent:', transferTx);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transferTx,
        timeout: 60000, // 1 minute timeout
      });

      if (receipt.status === 'success') {
        console.log('✅ Automation wallet funded successfully!');
        console.log('   Transaction:', transferTx);
        console.log('   Block:', receipt.blockNumber.toString());

        return {
          success: true,
          txHash: transferTx,
        };
      } else {
        return {
          success: false,
          error: 'Transfer transaction failed',
        };
      }

    } catch (error) {
      console.error('❌ Sponsored funding failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown funding error',
      };
    }
  }

  /**
   * Check if sponsored funding is available
   */
  static async isAvailable(): Promise<{
    available: boolean;
    sponsorAddress?: Address;
    sponsorBalance?: string;
  }> {
    try {
      const initialized = this.initialize();
      if (!initialized) {
        return { available: false };
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const balance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [this.sponsorWallet.address],
      }) as bigint;

      return {
        available: balance > 0n,
        sponsorAddress: this.sponsorWallet.address,
        sponsorBalance: (Number(balance) / 1e6).toFixed(6),
      };

    } catch (error) {
      console.error('❌ Failed to check sponsor availability:', error);
      return { available: false };
    }
  }

  /**
   * Get minimum funding amount (enough for several DCA executions)
   */
  static getMinimumFundingAmount(requestedAmount: bigint): bigint {
    // Fund with at least 10x the requested amount for multiple executions
    const minimumBuffer = requestedAmount * 10n;
    const absoluteMinimum = BigInt(10 * 1e6); // 10 USDC minimum
    
    return minimumBuffer > absoluteMinimum ? minimumBuffer : absoluteMinimum;
  }
}