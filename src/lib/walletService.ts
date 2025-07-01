import {
  http,
  type Address,
  type Hash,
  createPublicClient,
  createWalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Types
export interface WalletInfo {
  address: Address;
  isSmartContract: boolean;
  hasSessionKeySupport: boolean;
  walletType: 'EOA' | 'SMART_CONTRACT' | 'COINBASE_SMART_WALLET';
  capabilities: string[];
}

export interface TransactionRequest {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
  gas?: bigint;
  gasPrice?: bigint;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  gasUsed?: bigint;
}

export class WalletService {
  private publicClient;
  private walletClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
      ),
    });

    // For server-side execution, we'll need a wallet with some ETH for gas
    // onchainexpat hot wallet for DCA execution
    const executionPrivateKey =
      process.env.DCA_EXECUTION_PRIVATE_KEY ||
      '0xabac5921b0ca0bf145296fe0115dd0f8456862200cb413f7caa45c03c21de19f';
    if (executionPrivateKey) {
      const account = privateKeyToAccount(executionPrivateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(
          process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
        ),
      });
    }
  }

  /**
   * Detect wallet type and capabilities
   */
  async detectWalletInfo(address: Address): Promise<WalletInfo> {
    try {
      // Check if address has contract code
      const code = await this.publicClient.getBytecode({ address });
      const isSmartContract = !!code && code !== '0x';

      let walletType: WalletInfo['walletType'] = 'EOA';
      let hasSessionKeySupport = false;
      const capabilities: string[] = [];

      if (isSmartContract) {
        walletType = 'SMART_CONTRACT';

        // Check for Coinbase Smart Wallet signatures
        // Coinbase Smart Wallets typically implement ERC-4337 UserOperation handling
        try {
          // Try to call a function that's common in smart wallets
          // This is a heuristic - in practice, you'd check for specific interfaces
          const result = await this.publicClient.call({
            to: address,
            data: '0x1626ba7e', // ERC-1271 isValidSignature selector
          });

          if (result) {
            walletType = 'COINBASE_SMART_WALLET';
            hasSessionKeySupport = true;
            capabilities.push('ERC-4337', 'SESSION_KEYS', 'GAS_SPONSORSHIP');
          }
        } catch {
          // Not a Coinbase Smart Wallet, but still a smart contract
          capabilities.push('SMART_CONTRACT');
        }
      } else {
        // EOA wallet
        capabilities.push('EOA', 'DIRECT_SIGNING');
        // Note: EOAs could support session keys via EIP-7702 in the future
      }

      return {
        address,
        isSmartContract,
        hasSessionKeySupport,
        walletType,
        capabilities,
      };
    } catch (error) {
      console.error('Failed to detect wallet info:', error);
      // Default to EOA if detection fails
      return {
        address,
        isSmartContract: false,
        hasSessionKeySupport: false,
        walletType: 'EOA',
        capabilities: ['EOA'],
      };
    }
  }

  /**
   * Execute a transaction based on wallet type
   */
  async executeTransaction(
    userAddress: Address,
    transaction: TransactionRequest,
    options: {
      sessionKey?: string;
      userSignature?: `0x${string}`;
      walletInfo?: WalletInfo;
    } = {},
  ): Promise<ExecutionResult> {
    try {
      const walletInfo =
        options.walletInfo || (await this.detectWalletInfo(userAddress));

      console.log(
        `Executing transaction for ${walletInfo.walletType} wallet: ${userAddress}`,
      );
      console.log(
        `Transaction: ${JSON.stringify(
          transaction,
          (key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          2,
        )}`,
      );

      if (
        walletInfo.walletType === 'COINBASE_SMART_WALLET' &&
        walletInfo.hasSessionKeySupport
      ) {
        return this.executeSmartWalletTransaction(
          userAddress,
          transaction,
          options,
        );
      } else {
        return this.executeEOATransaction(userAddress, transaction, options);
      }
    } catch (error) {
      console.error('Transaction execution failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown transaction error',
      };
    }
  }

  /**
   * Execute transaction for Smart Contract wallets (with session keys)
   */
  private async executeSmartWalletTransaction(
    userAddress: Address,
    transaction: TransactionRequest,
    options: { sessionKey?: string; userSignature?: `0x${string}` },
  ): Promise<ExecutionResult> {
    try {
      // For Coinbase Smart Wallets, we would use their UserOperation flow
      // This is a simplified implementation - in practice, you'd use their SDK

      console.log(
        'Executing via Smart Contract wallet with session key support',
      );

      if (!this.walletClient) {
        return {
          success: false,
          error:
            'Execution wallet not configured - set DCA_EXECUTION_PRIVATE_KEY',
        };
      }

      // In a real implementation, you would:
      // 1. Create a UserOperation with the transaction data
      // 2. Use the session key to sign the UserOperation
      // 3. Submit to a bundler for execution
      // 4. Gas fees would be sponsored via paymaster

      // For now, we'll simulate by executing directly (requires gas)
      const hash = await this.walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0n,
        gas: transaction.gas || 100000n,
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      console.log(`✅ Smart wallet transaction confirmed: ${hash}`);

      return {
        success: true,
        txHash: hash,
        gasUsed: receipt.gasUsed,
      };
    } catch (error) {
      console.error('Smart wallet transaction failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Smart wallet execution failed',
      };
    }
  }

  /**
   * Execute transaction for EOA wallets (requires user signature each time)
   */
  private async executeEOATransaction(
    userAddress: Address,
    transaction: TransactionRequest,
    options: { userSignature?: `0x${string}` },
  ): Promise<ExecutionResult> {
    try {
      console.log(
        'EOA transaction execution - requires user signature for each transaction',
      );

      // For EOA wallets, we can't execute transactions without the user's private key
      // This would require the user to sign each transaction manually
      // In the future, EIP-7702 could enable session key functionality for EOAs

      // For now, we'll return an informative error
      return {
        success: false,
        error:
          'EOA wallets require manual approval for each transaction. Please upgrade to a smart contract wallet for automated DCA execution.',
      };
    } catch (error) {
      console.error('EOA transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'EOA execution failed',
      };
    }
  }

  /**
   * Create an OpenOcean swap transaction for the given parameters
   */
  async createSwapTransaction(
    sellToken: Address,
    buyToken: Address,
    sellAmount: bigint,
    takerAddress: Address,
    slippage = 0.03, // Increased default slippage for better execution
  ): Promise<TransactionRequest> {
    try {
      // Get swap data from OpenOcean API (secure alternative to 0x)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/openocean-swap`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sellToken,
            buyToken,
            sellAmount: sellAmount.toString(),
            takerAddress,
            slippagePercentage: slippage,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to get swap quote from OpenOcean API');
      }

      const swapData = await response.json();

      return {
        to: swapData.to,
        data: swapData.data,
        value: BigInt(swapData.value || '0'),
        gas: BigInt(swapData.gas || '200000'),
        gasPrice: BigInt(swapData.gasPrice || '1000000000'),
      };
    } catch (error) {
      console.error('Failed to create swap transaction:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance for a specific token
   */
  async getTokenBalance(
    walletAddress: Address,
    tokenAddress: Address,
  ): Promise<bigint> {
    try {
      // ERC-20 balanceOf function call
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ type: 'address', name: 'account' }],
            outputs: [{ type: 'uint256', name: 'balance' }],
          },
        ],
        functionName: 'balanceOf',
        args: [walletAddress],
      });

      return balance as bigint;
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return 0n;
    }
  }
}

// Export singleton instance
export const walletService = new WalletService();
