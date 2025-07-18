import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';
import { serverAgentKeyService } from './serverAgentKeyService';
import { aggregatorExecutionService } from './aggregatorExecutionService';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router
const OPENOCEAN_ROUTER =
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface ServerDCAExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  swapAmount?: string;
  spxReceived?: string;
  gasUsed?: bigint;
  transactions?: {
    approve?: string;
    swap?: string;
    transfer?: string;
  };
}

export interface SwapQuoteResult {
  success: boolean;
  transaction?: {
    to: Address;
    data: Hex;
    value: string;
  };
  expectedOutput?: string;
  error?: string;
}

export class ServerZerodevDCAExecutor {
  private publicClient;
  private TOKENS = TOKENS;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });
  }

  /**
   * Execute DCA without session key approval (fallback method)
   */
  private async executeDirectDCA(
    agentKeyData: any,
    smartWalletAddress: Address,
    userWalletAddress: Address,
    swapAmount: bigint,
  ): Promise<ServerDCAExecutionResult> {
    console.log('🔄 Executing direct DCA without session key approval...');
    console.log('💡 Using alternative execution method...');
    
    try {
      // Get the agent private key
      const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyData.keyId);
      if (!privateKey) {
        throw new Error('Agent private key not found');
      }

      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);
      console.log('🤖 Agent account created:', agentAccount.address);

      // Check if agent has any ETH for gas
      const agentBalance = await this.publicClient.getBalance({
        address: agentAccount.address,
      });
      
      console.log('⚡ Agent ETH balance:', Number(agentBalance) / 1e18, 'ETH');

      if (agentBalance === 0n) {
        return {
          success: false,
          error: 'Agent account has no ETH for gas fees. Direct execution requires gas sponsorship or funded agent.',
        };
      }

      // For now, return a success message indicating the setup is working
      // The actual swap execution would require more complex setup
      return {
        success: false,
        error: 'Direct execution setup validated. Full implementation requires gas sponsorship setup.',
        swapAmount: swapAmount.toString(),
        spxReceived: '0',
        gasUsed: 0n,
        transactions: {},
      };
    } catch (error) {
      console.error('❌ Direct DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Direct execution failed',
      };
    }
  }

  /**
   * Execute DCA swap using server-stored agent key
   */
  async executeDCAWithAgentKey(
    agentKeyId: string,
    smartWalletAddress: Address,
    userWalletAddress: Address,
    swapAmount: bigint,
  ): Promise<ServerDCAExecutionResult> {
    try {
      console.log('🔐 Retrieving agent key and permission approval...');

      // Add timeout wrapper for all operations
      const withTimeout = <T>(
        promise: Promise<T>,
        timeoutMs: number,
        operation: string,
      ): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`${operation} timed out after ${timeoutMs}ms`),
                ),
              timeoutMs,
            ),
          ),
        ]);
      };

      // Get agent key data including approval
      console.log('🔐 Retrieving agent key (with 10s timeout)...');
      const agentKeyData = await withTimeout(
        serverAgentKeyService.getAgentKey(agentKeyId),
        10000,
        'Agent key retrieval',
      );

      if (!agentKeyData) {
        console.error('❌ Agent key not found for keyId:', agentKeyId);
        throw new Error('Agent key not found');
      }

      if (!agentKeyData.sessionKeyApproval) {
        console.warn('⚠️  sessionKeyApproval is missing from agent key data');
        console.log('🔄 Attempting direct execution without session key approval...');
        
        // For fallback agent keys, we'll use direct execution without session key approval
        return this.executeDirectDCA(agentKeyData, smartWalletAddress, userWalletAddress, swapAmount);
      }

      console.log('✅ Agent key data retrieved with sessionKeyApproval');
      console.log('   Agent key ID:', agentKeyId);
      console.log('   Agent address:', agentKeyData.agentAddress);
      console.log('   Smart wallet address:', agentKeyData.smartWalletAddress);
      console.log(
        '   Session key approval length:',
        agentKeyData.sessionKeyApproval.length,
      );

      // Get decrypted private key
      console.log('🔑 Getting decrypted private key (with 5s timeout)...');
      const privateKey = await withTimeout(
        serverAgentKeyService.getPrivateKey(agentKeyId),
        5000,
        'Private key retrieval',
      );
      if (!privateKey) {
        throw new Error('Agent private key not found or inactive');
      }

      // Create agent account from private key
      const agentAccount = privateKeyToAccount(privateKey);
      console.log('🤖 Agent address:', agentAccount.address);

      // Import permission modules
      console.log('📦 Importing permission modules...');
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import(
        '@zerodev/permissions'
      );

      // We'll create the session signer after extracting the session private key
      console.log('📋 Agent account address:', agentAccount.address);

      // Deserialize the permission account using the stored approval
      console.log('🔓 Deserializing permission account (with 20s timeout)...');

      // Use the working pattern from 1-click-trading.ts example:
      // When private key is included in serialization, deserialize WITHOUT the signer parameter
      const smartWallet = await withTimeout(
        deserializePermissionAccount(
          this.publicClient,
          getEntryPoint('0.7'),
          KERNEL_V3_1,
          agentKeyData.sessionKeyApproval,
          // NO session signer parameter - private key is embedded in serialized data
        ),
        20000,
        'Permission account deserialization',
      );

      console.log('✅ Permission account deserialized successfully');

      // Test the deserialized account
      console.log('🧪 Testing deserialized account...');
      console.log('   Account type:', smartWallet.type);
      console.log('   Has signMessage:', typeof smartWallet.signMessage);
      console.log(
        '   Has signTransaction:',
        typeof smartWallet.signTransaction,
      );
      console.log(
        '   Has signUserOperation:',
        typeof smartWallet.signUserOperation,
      );

      // Test if the account can actually sign
      try {
        if (smartWallet.signMessage) {
          console.log('🧪 Testing account signMessage...');
          const testSig = await smartWallet.signMessage({ message: 'test' });
          console.log(
            '   ✅ Account can sign messages, signature length:',
            testSig.length,
          );
        } else {
          console.log('   ❌ Account does not have signMessage method');
        }
      } catch (error) {
        console.log('   ❌ Account signMessage failed:', error.message);
      }

      console.log('✅ Session key deserialized successfully');
      console.log('   Smart wallet address:', smartWallet.address);
      console.log('   Expected address:', smartWalletAddress);
      console.log('   Agent account address:', agentAccount.address);

      // Verify addresses match
      if (
        smartWallet.address.toLowerCase() !== smartWalletAddress.toLowerCase()
      ) {
        console.error('❌ Address mismatch!');
        console.error('   Created:', smartWallet.address);
        console.error('   Expected:', smartWalletAddress);
        throw new Error(
          `Smart wallet address mismatch: ${smartWallet.address} !== ${smartWalletAddress}`,
        );
      }

      console.log('✅ Smart wallet connected:', smartWallet.address);
      console.log('✅ Expected address:', smartWalletAddress);
      console.log('✅ Address match verified!');

      // Check USDC balance
      const usdcBalance = await this.getUSDCBalance(smartWallet.address);
      console.log(
        '💰 USDC balance:',
        (Number(usdcBalance) / 1e6).toFixed(6),
        'USDC',
      );

      if (usdcBalance < swapAmount) {
        throw new Error(`Insufficient USDC: ${usdcBalance} < ${swapAmount}`);
      }

      // Get swap quote
      console.log('💱 Getting swap quote...');
      const swapQuote = await this.getSwapQuote(
        swapAmount,
        smartWallet.address,
        smartWallet.address, // Receive in smart wallet first
      );

      if (!swapQuote.success) {
        throw new Error(swapQuote.error || 'Failed to get swap quote');
      }

      console.log('📊 Expected SPX output:', swapQuote.expectedOutput);

      // Create paymaster for gas sponsorship (using working pattern)
      console.log('💰 Setting up gas sponsorship...');
      const paymasterClient = createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Create kernel client with working pattern
      console.log('🔧 Creating kernel client with paymaster gas handling...');
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            console.log('🔍 UserOperation before sponsorship:', {
              sender: userOperation.sender,
              nonce: userOperation.nonce,
              callDataLength: userOperation.callData.length,
              maxFeePerGas: userOperation.maxFeePerGas,
              maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
            });

            try {
              const sponsorResult = await paymasterClient.sponsorUserOperation({
                userOperation,
              });
              console.log('✅ Sponsorship result:', {
                paymaster: sponsorResult.paymaster,
                paymasterDataLength: sponsorResult.paymasterData?.length,
              });
              return sponsorResult;
            } catch (error) {
              console.error('❌ Sponsorship failed:', error);
              throw error;
            }
          },
        },
      });

      console.log('✅ Gas sponsorship enabled');

      // Build transactions - approve for the actual router being used
      const routerAddress = swapQuote.transaction!.to; // This will be Aerodrome router
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [routerAddress, swapAmount],
      });

      // Declare transactions outside try block so it's accessible in catch
      const transactions: any = {};

      // Test: Try a simple operation first to check permissions
      console.log('🧪 Testing session key with simple operation...');

      try {
        // Try to check balance first (this should work with minimal permissions)
        const currentBalance = await this.getUSDCBalance(smartWallet.address);
        console.log('✅ Current USDC balance:', currentBalance.toString());

        // Try a simple transaction to test permissions (use zeroAddress instead of self)
        const testUserOpHash = await kernelClient.sendUserOperation({
          callData: await smartWallet.encodeCalls([
            {
              to: zeroAddress,
              value: BigInt(0),
              data: '0x',
            },
          ]),
        });

        console.log('✅ Test UserOp hash:', testUserOpHash);

        // Wait for test to be mined (with timeout)
        const testReceipt = await Promise.race([
          kernelClient.waitForUserOperationReceipt({
            hash: testUserOpHash,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test operation timeout after 30 seconds')), 30000)
          )
        ]);

        console.log('✅ Test tx mined:', testReceipt.receipt.transactionHash);

        // If we get here, permissions are working, now try the approval
        console.log(`📝 Step 1: Approving USDC spend for ${routerAddress}...`);

        const approveUserOpHash = await kernelClient.sendUserOperation({
          callData: await smartWallet.encodeCalls([
            {
              to: TOKENS.USDC,
              value: BigInt(0),
              data: approveData,
            },
          ]),
        });

        console.log('✅ Approval UserOp hash:', approveUserOpHash);

        // Wait for approval to be mined (with timeout)
        const approveReceipt = await Promise.race([
          kernelClient.waitForUserOperationReceipt({
            hash: approveUserOpHash,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Approval timeout after 30 seconds')), 30000)
          )
        ]);

        transactions.approve = approveReceipt.receipt.transactionHash;
        console.log('✅ Approval tx mined:', transactions.approve);
      } catch (error) {
        console.error('❌ Transaction failed:', error);
        throw new Error(`Transaction failed: ${error.message}`);
      }

      // Step 2: Execute swap (using working UserOperation pattern)
      console.log('📝 Step 2: Executing swap...');
      const swapUserOpHash = await kernelClient.sendUserOperation({
        callData: await smartWallet.encodeCalls([
          {
            to: swapQuote.transaction!.to,
            value: BigInt(swapQuote.transaction!.value || '0'),
            data: swapQuote.transaction!.data,
          },
        ]),
      });

      console.log('✅ Swap UserOp hash:', swapUserOpHash);

      // Wait for swap to be mined (with timeout)
      console.log('⏳ Waiting for swap to be mined...');
      const swapReceipt = await Promise.race([
        kernelClient.waitForUserOperationReceipt({
          hash: swapUserOpHash,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Swap timeout after 120 seconds')), 120000)
        )
      ]);

      transactions.swap = swapReceipt.receipt.transactionHash;
      console.log('✅ Swap tx mined:', transactions.swap);

      // Step 3: Transfer SPX to user wallet
      console.log('📝 Step 3: Transferring SPX to user wallet...');
      const spxBalance = await this.getSPXBalance(smartWallet.address);

      if (spxBalance === 0n) {
        throw new Error('No SPX tokens received from swap');
      }

      console.log(
        '📤 Transferring',
        (Number(spxBalance) / 1e8).toFixed(8),
        'SPX to user wallet...',
      );

      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [userWalletAddress, spxBalance],
      });

      const transferUserOpHash = await kernelClient.sendUserOperation({
        callData: await smartWallet.encodeCalls([
          {
            to: TOKENS.SPX6900,
            value: BigInt(0),
            data: transferData,
          },
        ]),
      });

      console.log('✅ Transfer UserOp hash:', transferUserOpHash);

      // Wait for transfer to be mined (with timeout)
      let transferSuccess = false;
      let transferError = '';
      try {
        const transferReceipt = await Promise.race([
          kernelClient.waitForUserOperationReceipt({
            hash: transferUserOpHash,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transfer timeout after 60 seconds')), 60000)
          )
        ]);

        transactions.transfer = transferReceipt.receipt.transactionHash;
        console.log('✅ Transfer tx:', transactions.transfer);
        transferSuccess = true;

        // Wait for transfer
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } catch (transferErr) {
        transferError = transferErr instanceof Error ? transferErr.message : 'Transfer failed';
        console.warn('⚠️ Transfer failed but swap succeeded:', transferError);
        console.log('💰 SPX tokens remain in smart wallet and can be swept later');
      }

      return {
        success: true, // Mark as success since swap completed
        txHash: transactions.swap, // Use swap transaction as primary
        swapAmount: swapAmount.toString(),
        spxReceived: spxBalance.toString(),
        gasUsed: BigInt(0), // Gas is sponsored
        transactions,
        transferSuccess,
        transferError: transferSuccess ? undefined : transferError,
        note: transferSuccess ? undefined : 'SPX tokens in smart wallet - transfer failed',
      };
    } catch (error) {
      console.error('❌ DCA execution failed:', error);
      
      // Check if we at least got to the swap stage
      if (transactions.swap) {
        console.log('🔄 Swap succeeded but later step failed - marking as partial success');
        
        // Try to get SPX balance to see if swap worked
        try {
          const spxBalance = await this.getSPXBalance(smartWallet.address);
          if (spxBalance > 0n) {
            return {
              success: true, // Partial success - swap worked
              txHash: transactions.swap,
              swapAmount: swapAmount.toString(),
              spxReceived: spxBalance.toString(),
              gasUsed: BigInt(0),
              transactions,
              transferSuccess: false,
              transferError: error instanceof Error ? error.message : 'Transfer failed',
              note: 'Swap succeeded, transfer failed - SPX tokens in smart wallet',
            };
          }
        } catch (balanceError) {
          console.error('Failed to check SPX balance:', balanceError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        transactions,
      };
    }
  }

  /**
   * Get USDC balance
   */
  private async getUSDCBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return balance;
    } catch (error) {
      throw new Error(`Failed to get USDC balance: ${error}`);
    }
  }

  /**
   * Get SPX balance
   */
  private async getSPXBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: TOKENS.SPX6900,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      return balance;
    } catch (error) {
      throw new Error(`Failed to get SPX balance: ${error}`);
    }
  }

  /**
   * Get best swap quote from multiple aggregators (OpenOcean, 1inch, Paraswap)
   */
  private async getSwapQuote(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
      console.log('🔍 Getting best swap quote from multiple aggregators...');
      console.log(`   Sell Amount: ${sellAmount.toString()} USDC`);
      console.log(`   Taker: ${takerAddress}`);
      console.log(`   Receiver: ${receiverAddress}`);

      // Use direct Aerodrome swap instead of aggregators (to avoid API blocks)
      const swapResult = await this.getAerodromeSwapData(
        sellAmount,
        takerAddress,
      );

      const bestSwap = swapResult.bestSwap;

      // Validate the swap data
      const validation = aggregatorExecutionService.validateSwapData(bestSwap);
      if (!validation.valid) {
        console.error('❌ Swap validation failed:', validation.error);
        return {
          success: false,
          error: `Swap validation failed: ${validation.error}`,
        };
      }

      console.log(`✅ Best swap found via ${bestSwap.aggregator}:`);
      console.log(`   Expected SPX Output: ${bestSwap.buyAmount}`);
      console.log(`   Price Impact: ${bestSwap.priceImpact}%`);
      console.log(
        `   Savings vs alternatives: ${swapResult.savings.amount} tokens (${swapResult.savings.percentage}%)`,
      );
      console.log(`   Gas Estimate: ${bestSwap.gas}`);

      return {
        success: true,
        transaction: {
          to: bestSwap.to,
          data: bestSwap.data as Hex,
          value: bestSwap.value,
        },
        expectedOutput: bestSwap.buyAmount,
      };
    } catch (error) {
      console.error('❌ Multi-aggregator swap quote failed:', error);

      // Fallback to original OpenOcean method
      console.log('🔄 Falling back to OpenOcean-only quote...');
      return this.getOpenOceanSwapQuoteFallback(
        sellAmount,
        takerAddress,
        receiverAddress,
      );
    }
  }

  /**
   * Fallback method using Direct Aerodrome DEX (bypasses external APIs)
   */
  private async getOpenOceanSwapQuoteFallback(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
      console.log(
        '🔄 OpenOcean blocked, trying Direct Aerodrome DEX fallback...',
      );

      const requestBody = {
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippagePercentage: 0.05, // 5% slippage for better execution
      };

      const response = await fetch('http://localhost:3000/api/aerodrome-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('❌ Direct Aerodrome failed, trying Uniswap V3...');

        // Fallback to Uniswap
        return this.getUniswapFallback(
          sellAmount,
          takerAddress,
          receiverAddress,
        );
      }

      const data = await response.json();
      console.log('✅ Direct Aerodrome DEX fallback successful');

      return {
        success: true,
        transaction: {
          to: data.to,
          data: data.data,
          value: data.value,
        },
        expectedOutput: data.buyAmount,
      };
    } catch (error) {
      console.error('❌ Direct Aerodrome fallback failed:', error);

      // Fallback to Uniswap
      return this.getUniswapFallback(sellAmount, takerAddress, receiverAddress);
    }
  }

  /**
   * Uniswap V3 fallback (secondary fallback)
   */
  private async getUniswapFallback(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
      console.log('🦄 Trying Uniswap V3 as secondary fallback...');

      const requestBody = {
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippagePercentage: 0.05,
      };

      const response = await fetch('http://localhost:3000/api/uniswap-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('❌ Uniswap V3 failed, trying original OpenOcean...');

        // Last resort: try original OpenOcean
        return this.getOriginalOpenOceanFallback(
          sellAmount,
          takerAddress,
          receiverAddress,
        );
      }

      const data = await response.json();
      console.log('✅ Uniswap V3 fallback successful');

      return {
        success: true,
        transaction: {
          to: data.to,
          data: data.data,
          value: data.value,
        },
        expectedOutput: data.buyAmount,
      };
    } catch (error) {
      console.error('❌ Uniswap V3 fallback failed:', error);

      // Last resort: try original OpenOcean
      return this.getOriginalOpenOceanFallback(
        sellAmount,
        takerAddress,
        receiverAddress,
      );
    }
  }

  /**
   * Last resort: Original OpenOcean method (will likely fail due to Cloudflare)
   */
  private async getOriginalOpenOceanFallback(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
      console.log('🌊 Trying original OpenOcean as last resort...');

      const requestBody = {
        sellToken: TOKENS.USDC,
        buyToken: TOKENS.SPX6900,
        sellAmount: sellAmount.toString(),
        takerAddress,
        receiverAddress,
        slippagePercentage: 0.05,
        gasPrice: 'standard',
        complexityLevel: 0,
        disableEstimate: false,
        allowPartialFill: false,
        preferDirect: true,
        maxHops: 2,
      };

      const response = await fetch('http://localhost:3000/api/openocean-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error:
            error.error ||
            'All swap aggregators failed - OpenOcean blocked by Cloudflare, Uniswap direct failed',
        };
      }

      const data = await response.json();
      console.log('✅ Original OpenOcean worked (unexpected)');

      return {
        success: true,
        transaction: {
          to: data.to,
          data: data.data,
          value: data.value,
        },
        expectedOutput: data.outAmount || data.buyAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: `All swap methods failed: ${error}`,
      };
    }
  }

  /**
   * Create a new smart wallet with agent key
   */
  async createSmartWalletWithAgentKey(userAddress: Address): Promise<{
    success: boolean;
    agentKeyId?: string;
    smartWalletAddress?: Address;
    error?: string;
  }> {
    try {
      console.log('🔧 Step A: Generate new agent key');
      // Generate new agent key
      const agentKey =
        await serverAgentKeyService.generateAgentKey(userAddress);

      console.log('🔧 Step B: Get the private key');
      // Get the private key
      const privateKey = await serverAgentKeyService.getPrivateKey(
        agentKey.keyId,
      );
      if (!privateKey) {
        throw new Error('Failed to retrieve generated private key');
      }

      console.log('🔧 Step C: Create agent account');
      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);

      console.log('🔧 Step D: Create ECDSA validator');
      // Create ECDSA validator
      const ecdsaValidator = await signerToEcdsaValidator(this.publicClient, {
        signer: agentAccount,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
      });

      console.log('🔧 Step E: Create kernel account');
      // Create kernel account
      const smartWallet = await createKernelAccount(this.publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: KERNEL_V3_1,
      });
      console.log('🔧 Step F: Kernel account created');

      // Update agent key with smart wallet address
      await serverAgentKeyService.updateSmartWalletAddress(
        agentKey.keyId,
        smartWallet.address,
      );

      console.log('✅ Created smart wallet with server agent key');
      console.log('   Agent key ID:', agentKey.keyId);
      console.log('   Smart wallet:', smartWallet.address);
      console.log('   Agent address:', agentAccount.address);

      return {
        success: true,
        agentKeyId: agentKey.keyId,
        smartWalletAddress: smartWallet.address,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create smart wallet',
      };
    }
  }

  /**
   * Get Aerodrome swap data directly (bypasses blocked aggregator APIs)
   */
  private async getAerodromeSwapData(
    sellAmount: bigint,
    takerAddress: Address,
  ): Promise<any> {
    try {
      console.log('🔄 Using direct Aerodrome swap (bypassing blocked APIs)');

      // Aerodrome router on Base
      const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

      // Define swap route: USDC → WETH → SPX
      const routes = [
        {
          from: TOKENS.USDC,
          to: WETH_ADDRESS,
          stable: false,
          factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
        },
        {
          from: WETH_ADDRESS,
          to: TOKENS.SPX6900,
          stable: false,
          factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
        },
      ];

      // Get expected output from Aerodrome router
      const aerodromeRouterAbi = [
        {
          name: 'getAmountsOut',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            {
              name: 'routes',
              type: 'tuple[]',
              components: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'stable', type: 'bool' },
                { name: 'factory', type: 'address' },
              ],
            },
          ],
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
        },
        {
          name: 'swapExactTokensForTokens',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            {
              name: 'routes',
              type: 'tuple[]',
              components: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'stable', type: 'bool' },
                { name: 'factory', type: 'address' },
              ],
            },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
          ],
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
        },
      ];

      try {
        const amountsOut = await this.publicClient.readContract({
          address: AERODROME_ROUTER,
          abi: aerodromeRouterAbi,
          functionName: 'getAmountsOut',
          args: [sellAmount, routes],
        });

        const expectedOutput = amountsOut[2]; // SPX amount (final token in route)
        const minOutput = (expectedOutput * 99n) / 100n; // 1% slippage

        console.log(`✅ Aerodrome quote: ${Number(expectedOutput) / 1e8} SPX`);

        // Create swap transaction data
        const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

        const swapData = encodeFunctionData({
          abi: aerodromeRouterAbi,
          functionName: 'swapExactTokensForTokens',
          args: [
            sellAmount,
            minOutput,
            routes,
            takerAddress, // Receive in smart wallet
            deadline,
          ],
        });

        return {
          bestSwap: {
            aggregator: 'Aerodrome',
            sellToken: TOKENS.USDC,
            buyToken: TOKENS.SPX6900,
            sellAmount: sellAmount.toString(),
            buyAmount: expectedOutput.toString(),
            minimumReceived: minOutput.toString(),
            to: AERODROME_ROUTER,
            data: swapData,
            value: '0',
            gas: '300000',
            gasPrice: '1000000000',
            priceImpact: '1.0',
            success: true,
          },
          alternativeSwaps: [],
          savings: {
            amount: '0',
            percentage: '0',
            compared_to: 'none',
          },
          executionMetadata: {
            totalAggregators: 1,
            successfulQuotes: 1,
            recommendedGasLimit: '300000',
            estimatedExecutionTime: 30,
          },
        };
      } catch (quoteError) {
        console.error('❌ Aerodrome quote failed:', quoteError);
        throw new Error(`Aerodrome quote failed: ${quoteError.message}`);
      }
    } catch (error) {
      console.error('❌ Aerodrome swap data failed:', error);
      throw error;
    }
  }

  /**
   * Sweep all funds from smart wallet back to user wallet
   */
  async sweepFundsToUser(
    agentKeyId: string,
    smartWalletAddress: Address,
    userWalletAddress: Address,
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    sweptAmounts?: {
      usdc: string;
      spx: string;
      eth: string;
    };
  }> {
    try {
      console.log(
        `💰 Sweeping funds from ${smartWalletAddress} to ${userWalletAddress}`,
      );

      // Get the agent key
      const agentKey = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKey.success || !agentKey.sessionKeyApproval) {
        throw new Error(`Failed to get agent key: ${agentKey.error}`);
      }

      // Deserialize the session key
      const sessionAccount = await this.deserializeSessionKey(
        agentKey.sessionKeyApproval,
      );

      // Create kernel client
      const kernelClient = createKernelAccountClient({
        account: sessionAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        middleware: {
          sponsorUserOperation: async ({ userOperation }) => {
            const zeroDevPaymaster = createZeroDevPaymasterClient({
              chain: base,
              transport: http(ZERODEV_RPC_URL),
            });
            return zeroDevPaymaster.sponsorUserOperation({
              userOperation,
              entryPoint: getEntryPoint('0.7'),
            });
          },
        },
      });

      // Create public client for balance checks
      const publicClient = createPublicClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Check balances
      const [usdcBalance, spxBalance, ethBalance] = await Promise.all([
        publicClient.readContract({
          address: TOKENS.USDC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [smartWalletAddress],
        }),
        publicClient.readContract({
          address: TOKENS.SPX6900,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [smartWalletAddress],
        }),
        publicClient.getBalance({ address: smartWalletAddress }),
      ]);

      console.log(`💰 Found balances:`, {
        usdc: (Number(usdcBalance) / 1e6).toFixed(6),
        spx: (Number(spxBalance) / 1e18).toFixed(6),
        eth: (Number(ethBalance) / 1e18).toFixed(6),
      });

      // Prepare transfer transactions for any non-zero balances
      const transferCalls = [];

      // Transfer USDC if balance > 0
      if (usdcBalance > 0n) {
        transferCalls.push({
          to: TOKENS.USDC,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [userWalletAddress, usdcBalance],
          }),
        });
      }

      // Transfer SPX if balance > 0
      if (spxBalance > 0n) {
        transferCalls.push({
          to: TOKENS.SPX6900,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [userWalletAddress, spxBalance],
          }),
        });
      }

      // Transfer ETH if balance > gas reserve
      const gasReserve = BigInt(1e15); // Keep 0.001 ETH for gas
      if (ethBalance > gasReserve) {
        const ethToTransfer = ethBalance - gasReserve;
        transferCalls.push({
          to: userWalletAddress,
          value: ethToTransfer,
          data: '0x' as Hex,
        });
      }

      if (transferCalls.length === 0) {
        return {
          success: true,
          sweptAmounts: {
            usdc: '0',
            spx: '0',
            eth: '0',
          },
        };
      }

      console.log(`📦 Batching ${transferCalls.length} transfer transactions`);

      // Execute batched transfers
      const userOpHash = await kernelClient.sendUserOperation({
        callData: await sessionAccount.encodeCalls(transferCalls),
      });

      console.log(`⏳ Waiting for UserOperation ${userOpHash}...`);

      // Wait for transaction receipt
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      console.log(
        `✅ Fund sweep completed: ${receipt.receipt.transactionHash}`,
      );

      return {
        success: true,
        txHash: receipt.receipt.transactionHash,
        sweptAmounts: {
          usdc: (Number(usdcBalance) / 1e6).toFixed(6),
          spx: (Number(spxBalance) / 1e18).toFixed(6),
          eth: (Number(ethBalance - gasReserve) / 1e18).toFixed(6),
        },
      };
    } catch (error: any) {
      console.error('❌ Fund sweep failed:', error);
      return {
        success: false,
        error: error.message || 'Fund sweep failed',
      };
    }
  }
}

// Export singleton instance
export const serverZerodevDCAExecutor = new ServerZerodevDCAExecutor();
