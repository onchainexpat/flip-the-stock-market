import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  toPermissionValidator,
} from '@zerodev/permissions';
import {
  toCallPolicy,
} from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
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
      
      // Get agent key data including approval
      const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
      if (!agentKeyData) {
        console.error('❌ Agent key not found for keyId:', agentKeyId);
        throw new Error('Agent key not found');
      }
      
      if (!agentKeyData.sessionKeyApproval) {
        console.error('❌ Agent key data:', JSON.stringify(agentKeyData, null, 2));
        console.error('❌ sessionKeyApproval is missing from agent key data');
        throw new Error('Permission approval not found in agent key data');
      }
      
      console.log('✅ Agent key data retrieved with sessionKeyApproval');
      console.log('   Agent key ID:', agentKeyId);
      console.log('   Agent address:', agentKeyData.agentAddress);
      console.log('   Smart wallet address:', agentKeyData.smartWalletAddress);
      console.log('   Session key approval length:', agentKeyData.sessionKeyApproval.length);
      
      // Get decrypted private key
      const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!privateKey) {
        throw new Error('Agent private key not found or inactive');
      }

      // Create agent account from private key
      const agentAccount = privateKeyToAccount(privateKey);
      console.log('🤖 Agent address:', agentAccount.address);

      // Import permission modules
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { deserializePermissionAccount } = await import('@zerodev/permissions');
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: agentAccount });
      
      // Deserialize the permission account using the stored approval
      console.log('🔓 Deserializing permission account...');
      const smartWallet = await deserializePermissionAccount(
        this.publicClient,
        getEntryPoint('0.7'),
        KERNEL_V3_1,
        agentKeyData.sessionKeyApproval,
        agentSigner
      );
      
      console.log('✅ Agent validator created');
      console.log('   Smart wallet address:', smartWallet.address);
      console.log('   Expected address:', smartWalletAddress);
      console.log('   Agent address:', agentAccount.address);

      // Verify addresses match
      if (smartWallet.address.toLowerCase() !== smartWalletAddress.toLowerCase()) {
        console.error('❌ Address mismatch!');
        console.error('   Created:', smartWallet.address);
        console.error('   Expected:', smartWalletAddress);
        throw new Error(`Smart wallet address mismatch: ${smartWallet.address} !== ${smartWalletAddress}`);
      }

      console.log('✅ Smart wallet connected:', smartWallet.address);
      console.log('✅ Expected address:', smartWalletAddress);
      console.log('✅ Address match verified!');

      // Check USDC balance
      const usdcBalance = await this.getUSDCBalance(smartWallet.address);
      console.log('💰 USDC balance:', (Number(usdcBalance) / 1e6).toFixed(6), 'USDC');

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

      // Create paymaster for gas sponsorship
      console.log('💰 Setting up gas sponsorship...');
      const paymaster = createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_RPC_URL),
      });

      // Create kernel client with gas sponsorship and manual gas limits
      const kernelClient = createKernelAccountClient({
        account: smartWallet,
        chain: base,
        bundlerTransport: http(ZERODEV_RPC_URL),
        middleware: {
          sponsorUserOperation: paymaster.sponsorUserOperation,
          gasPrice: async () => ({
            maxFeePerGas: 1000000000n, // 1 gwei
            maxPriorityFeePerGas: 1000000000n, // 1 gwei
          }),
          // Override gas estimation to avoid requiring ETH for simulation
          userOperationSimulator: async (args) => {
            return {
              preVerificationGas: 100000n,
              verificationGasLimit: 200000n,
              callGasLimit: 500000n,
            };
          },
        },
      });

      console.log('✅ Gas sponsorship enabled');

      // Build transactions
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [OPENOCEAN_ROUTER, swapAmount],
      });

      const transactions: any = {};

      // Step 1: Approve USDC
      console.log('📝 Step 1: Approving USDC spend...');
      const approveTxHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        value: 0n,
        data: approveData,
      });
      
      transactions.approve = approveTxHash;
      console.log('✅ Approval tx:', approveTxHash);
      
      // Wait for approval
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 2: Execute swap
      console.log('📝 Step 2: Executing swap...');
      const swapTxHash = await kernelClient.sendTransaction({
        to: swapQuote.transaction!.to,
        value: BigInt(swapQuote.transaction!.value || '0'),
        data: swapQuote.transaction!.data,
      });

      transactions.swap = swapTxHash;
      console.log('✅ Swap tx:', swapTxHash);
      
      // Wait for swap to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

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
      console.log('✅ Transfer tx:', transferTxHash);

      // Wait for transfer
      await new Promise(resolve => setTimeout(resolve, 10000));

      return {
        success: true,
        txHash: transferTxHash, // Final transaction
        swapAmount: swapAmount.toString(),
        spxReceived: spxBalance.toString(),
        gasUsed: BigInt(0), // Gas is sponsored
        transactions,
      };

    } catch (error) {
      console.error('❌ DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

      // Use multi-aggregator service to get the best rate
      const swapResult = await aggregatorExecutionService.getBestExecutableSwap(
        TOKENS.USDC,
        TOKENS.SPX6900,
        sellAmount.toString(),
        takerAddress
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
      console.log(`   Savings vs alternatives: ${swapResult.savings.amount} tokens (${swapResult.savings.percentage}%)`);
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
      return this.getOpenOceanSwapQuoteFallback(sellAmount, takerAddress, receiverAddress);
    }
  }

  /**
   * Fallback method using only OpenOcean (original implementation)
   */
  private async getOpenOceanSwapQuoteFallback(
    sellAmount: bigint,
    takerAddress: Address,
    receiverAddress: Address,
  ): Promise<SwapQuoteResult> {
    try {
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
          error: error.error || 'Failed to get OpenOcean fallback quote',
        };
      }

      const data = await response.json();
      console.log('✅ OpenOcean fallback quote successful');
      
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
        error: `Failed to get OpenOcean fallback quote: ${error}`,
      };
    }
  }

  /**
   * Create a new smart wallet with agent key
   */
  async createSmartWalletWithAgentKey(
    userAddress: Address,
  ): Promise<{
    success: boolean;
    agentKeyId?: string;
    smartWalletAddress?: Address;
    error?: string;
  }> {
    try {
      console.log('🔧 Step A: Generate new agent key');
      // Generate new agent key
      const agentKey = await serverAgentKeyService.generateAgentKey(userAddress);
      
      console.log('🔧 Step B: Get the private key');
      // Get the private key
      const privateKey = await serverAgentKeyService.getPrivateKey(agentKey.keyId);
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
        error: error instanceof Error ? error.message : 'Failed to create smart wallet',
      };
    }
  }
}

// Export singleton instance
export const serverZerodevDCAExecutor = new ServerZerodevDCAExecutor();