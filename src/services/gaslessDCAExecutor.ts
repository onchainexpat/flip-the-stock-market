import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { serverAgentKeyService } from './serverAgentKeyService';
import { TOKENS } from '../utils/openOceanApi';
import { aggregatorExecutionService } from './aggregatorExecutionService';

// ZeroDev configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const ZERODEV_RPC_URL =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/8453`;

// OpenOcean router
const OPENOCEAN_ROUTER = '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address;

export interface GaslessDCAExecutionResult {
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
  gasSponsored?: boolean;
}

export class GaslessDCAExecutor {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });
  }

  /**
   * Execute DCA swap with full gas sponsorship - no ETH required in smart wallet
   */
  async executeDCAWithGasSponsorship(
    agentKeyId: string,
    smartWalletAddress: Address,
    userWalletAddress: Address,
    swapAmount: bigint,
  ): Promise<GaslessDCAExecutionResult> {
    try {
      console.log('🚀 Starting gasless DCA execution...');
      console.log(`   Agent key: ${agentKeyId}`);
      console.log(`   Smart wallet: ${smartWalletAddress}`);
      console.log(`   Swap amount: ${swapAmount.toString()} USDC`);
      
      // Get agent key data
      const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKeyData || !agentKeyData.sessionKeyApproval) {
        throw new Error('Agent key or session approval not found');
      }

      // Get private key
      const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!privateKey) {
        throw new Error('Agent private key not found');
      }

      // Create agent account
      const agentAccount = privateKeyToAccount(privateKey);
      console.log('🤖 Agent address:', agentAccount.address);

      // Check smart wallet balance (should have USDC but no ETH needed)
      const usdcBalance = await this.getUSDCBalance(smartWalletAddress);
      console.log('💰 USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');

      if (usdcBalance < swapAmount) {
        throw new Error(`Insufficient USDC: ${usdcBalance} < ${swapAmount}`);
      }

      // Check ETH balance (should be 0 - that's the point!)
      const ethBalance = await this.publicClient.getBalance({ address: smartWalletAddress });
      console.log('⛽ ETH balance:', (Number(ethBalance) / 1e18).toFixed(6), 'ETH');
      
      if (ethBalance === 0n) {
        console.log('✅ Smart wallet has 0 ETH - perfect for gasless execution test');
      }

      // Import ZeroDev modules
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { 
        createKernelAccountClient, 
        createZeroDevPaymasterClient 
      } = await import('@zerodev/sdk');

      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: agentAccount });

      // Deserialize permission account
      console.log('🔓 Deserializing permission account...');
      const smartWallet = await deserializePermissionAccount(
        this.publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      console.log('✅ Permission account deserialized');
      console.log(`   Address match: ${smartWallet.address.toLowerCase() === smartWalletAddress.toLowerCase()}`);

      // Create ZeroDev paymaster client
      console.log('💰 Setting up ZeroDev paymaster...');
      const paymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Create kernel client with comprehensive gas sponsorship configuration
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        middleware: {
          // Use correct ZeroDev sponsorship method
          sponsorUserOperation: async (args) => {
            console.log('💰 Sponsoring user operation...');
            
            // Try the correct ZeroDev API method
            const response = await fetch(ZERODEV_RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'zd_sponsorUserOperation',
                params: [args.userOperation, args.entryPoint],
              }),
            });
            
            const result = await response.json();
            if (result.error) {
              console.error('❌ Sponsorship failed:', result.error);
              throw new Error(`Sponsorship failed: ${result.error.message}`);
            }
            
            console.log('✅ User operation sponsored');
            return result.result;
          },
          // Set reasonable gas prices
          gasPrice: async () => {
            const gasPrice = await this.publicClient.getGasPrice();
            const adjustedPrice = (gasPrice * 110n) / 100n; // 10% buffer
            return {
              maxFeePerGas: adjustedPrice,
              maxPriorityFeePerGas: adjustedPrice / 10n,
            };
          },
        },
      });

      console.log('✅ Gasless kernel client created');

      // Get swap quote
      console.log('💱 Getting swap quote...');
      const swapQuote = await this.getSwapQuote(
        swapAmount,
        smartWallet.address,
        smartWallet.address,
      );

      if (!swapQuote.success) {
        throw new Error(swapQuote.error || 'Failed to get swap quote');
      }

      console.log('📊 Expected SPX output:', swapQuote.expectedOutput);

      const transactions: any = {};

      try {
        // Step 1: Approve USDC
        console.log('📝 Step 1: Approving USDC spend...');
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [OPENOCEAN_ROUTER, swapAmount],
        });

        const approveTxHash = await kernelClient.sendTransaction({
          to: TOKENS.USDC,
          value: 0n,
          data: approveData,
        });

        transactions.approve = approveTxHash;
        console.log('✅ Approval tx (gas sponsored):', approveTxHash);

        // Wait for approval
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Step 2: Execute swap
        console.log('📝 Step 2: Executing swap...');
        const swapTxHash = await kernelClient.sendTransaction({
          to: swapQuote.transaction!.to,
          value: BigInt(swapQuote.transaction!.value || '0'),
          data: swapQuote.transaction!.data,
        });

        transactions.swap = swapTxHash;
        console.log('✅ Swap tx (gas sponsored):', swapTxHash);

        // Wait for swap to complete
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Step 3: Transfer SPX to user wallet
        console.log('📝 Step 3: Transferring SPX to user wallet...');
        const spxBalance = await this.getSPXBalance(smartWallet.address);

        if (spxBalance === 0n) {
          throw new Error('No SPX tokens received from swap');
        }

        console.log('📤 Transferring', (Number(spxBalance) / 1e8).toFixed(8), 'SPX to user wallet...');

        const transferData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [userWalletAddress, spxBalance],
        });

        const transferTxHash = await kernelClient.sendTransaction({
          to: TOKENS.SPX6900,
          value: 0n,
          data: transferData,
        });

        transactions.transfer = transferTxHash;
        console.log('✅ Transfer tx (gas sponsored):', transferTxHash);

        // Verify final state
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        const finalEthBalance = await this.publicClient.getBalance({ address: smartWalletAddress });
        console.log('⛽ Final ETH balance:', (Number(finalEthBalance) / 1e18).toFixed(6), 'ETH');
        
        if (finalEthBalance === ethBalance) {
          console.log('🎉 Perfect! Smart wallet ETH balance unchanged - fully gasless execution');
        }

        return {
          success: true,
          txHash: transferTxHash,
          swapAmount: swapAmount.toString(),
          spxReceived: spxBalance.toString(),
          gasUsed: BigInt(0), // Gas was sponsored
          transactions,
          gasSponsored: true,
        };

      } catch (executionError) {
        console.error('❌ Transaction execution failed:', executionError);
        
        // Check if it's an AA23 error
        const errorMessage = executionError instanceof Error ? executionError.message : 'Unknown error';
        if (errorMessage.includes('AA23') || errorMessage.includes('reverted')) {
          console.log('🔍 AA23 error detected - permission validation failed');
          console.log('   This suggests the session key permissions are incorrect');
          console.log('   Consider regenerating session keys with proper gas policies');
        }
        
        throw executionError;
      }

    } catch (error) {
      console.error('❌ Gasless DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        gasSponsored: false,
      };
    }
  }

  /**
   * Alternative execution method using different paymaster configuration
   */
  async executeDCAWithAlternativePaymaster(
    agentKeyId: string,
    smartWalletAddress: Address,
    userWalletAddress: Address,
    swapAmount: bigint,
  ): Promise<GaslessDCAExecutionResult> {
    try {
      console.log('🚀 Starting alternative paymaster DCA execution...');
      
      // Get agent key data
      const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKeyData || !agentKeyData.sessionKeyApproval) {
        throw new Error('Agent key or session approval not found');
      }

      const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!privateKey) {
        throw new Error('Agent private key not found');
      }

      const agentAccount = privateKeyToAccount(privateKey);

      // Import ZeroDev modules
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { createKernelAccountClient } = await import('@zerodev/sdk');

      const agentSigner = await toECDSASigner({ signer: agentAccount });

      const smartWallet = await deserializePermissionAccount(
        this.publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );

      // Try a simpler paymaster configuration
      console.log('💰 Setting up alternative paymaster configuration...');
      
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        middleware: {
          // Sponsor all user operations by default
          sponsorUserOperation: async (args) => {
            // Use ZeroDev's built-in sponsorship
            const response = await fetch(`${ZERODEV_RPC_URL}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'zd_sponsorUserOperation',
                params: [args.userOperation, args.entryPoint],
              }),
            });
            
            const result = await response.json();
            if (result.error) {
              throw new Error(`Paymaster error: ${result.error.message}`);
            }
            
            return result.result;
          },
          gasPrice: async () => {
            const gasPrice = await this.publicClient.getGasPrice();
            return {
              maxFeePerGas: gasPrice,
              maxPriorityFeePerGas: gasPrice / 10n,
            };
          },
        },
      });

      console.log('✅ Alternative paymaster configuration set up');

      // Test with a simple approval transaction
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [OPENOCEAN_ROUTER, parseUnits('1', 6)], // Small test amount
      });

      console.log('🧪 Testing with small approval transaction...');
      const testTxHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        value: 0n,
        data: approveData,
      });

      console.log('✅ Alternative paymaster test successful:', testTxHash);

      return {
        success: true,
        txHash: testTxHash,
        swapAmount: '0', // This was just a test
        spxReceived: '0',
        gasUsed: BigInt(0),
        transactions: { approve: testTxHash },
        gasSponsored: true,
      };

    } catch (error) {
      console.error('❌ Alternative paymaster execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        gasSponsored: false,
      };
    }
  }

  // Helper methods (same as original)
  private async getUSDCBalance(address: Address): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance;
  }

  private async getSPXBalance(address: Address): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: TOKENS.SPX6900,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance;
  }

  private async getSwapQuote(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<{
    success: boolean;
    transaction?: { to: Address; data: Hex; value: string };
    expectedOutput?: string;
    error?: string;
  }> {
    try {
      console.log('💱 Getting swap quote via OpenOcean direct...');
      
      // Use OpenOcean directly to bypass multi-aggregator issues
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
          error: error.error || 'Failed to get OpenOcean quote',
        };
      }

      const data = await response.json();
      console.log('✅ OpenOcean quote successful');
      
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
      console.error('❌ Swap quote failed:', error);
      return {
        success: false,
        error: `Failed to get swap quote: ${error}`,
      };
    }
  }
}

// Export singleton instance
export const gaslessDCAExecutor = new GaslessDCAExecutor();