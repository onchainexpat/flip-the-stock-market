import { GelatoRelay } from '@gelatonetwork/relay-sdk';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  encodeFunctionData,
  erc20Abi,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';
import { GELATO_SPONSOR_API_KEY } from '../config';

export interface GelatoNativeResult {
  success: boolean;
  smartWalletAddress?: Address;
  agentKeyId?: string;
  txHash?: string;
  taskId?: string;
  error?: string;
}

export interface GelatoExecutionResult {
  success: boolean;
  userOpHash?: string;
  txHash?: string;
  error?: string;
}

/**
 * Gelato Native Smart Wallet Service
 * Uses Gelato's native smart wallet infrastructure with EIP-7702
 * Much simpler than ZeroDev + Kernel setup
 */
export class GelatoNativeSmartWalletService {
  private static sponsorApiKey: string | undefined;

  /**
   * Initialize the service with Gelato Sponsor API key
   */
  static initialize(apiKey?: string) {
    this.sponsorApiKey = apiKey || GELATO_SPONSOR_API_KEY || process.env.GELATO_SPONSOR_API_KEY;
    console.log('🚀 Gelato Native Service initialized');
    console.log('   API Key provided:', !!this.sponsorApiKey);
    console.log('   🔧 DEBUG - API Key length:', this.sponsorApiKey?.length || 0);
    console.log('   🔧 DEBUG - From config:', !!GELATO_SPONSOR_API_KEY);
    console.log('   🔧 DEBUG - From process.env:', !!process.env.GELATO_SPONSOR_API_KEY);
  }

  /**
   * Create automation permissions for user's EIP-7702 smart wallet
   * Assumes EIP-7702 authorization was handled client-side
   */
  static async createGaslessAgentKey(
    userWallet: any | null, // Not used server-side (EIP-7702 handled client-side)
    userAddress: Address,
  ): Promise<GelatoNativeResult> {
    try {
      console.log('🔑 Creating EIP-7702 automation permissions...');
      console.log('   User EOA (becomes smart wallet):', userAddress);
      console.log('   Note: EIP-7702 authorization handled client-side');

      // Step 1: Generate automation key for permissions (not for holding funds)
      const automationPrivateKey = generatePrivateKey();
      const automationAccount = privateKeyToAccount(automationPrivateKey);
      
      console.log('✅ Automation key generated');
      console.log('   Automation signer:', automationAccount.address);
      console.log('   Smart wallet = User EOA:', userAddress);

      // With EIP-7702, user's EOA IS the smart wallet
      const smartWalletAddress = userAddress;

      // Generate unique agent key ID
      const agentKeyId = `gelato_native_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 2: Store the automation key
      const { serverAgentKeyService } = await import('./serverAgentKeyService');
      
      const agentKey = await serverAgentKeyService.storeAgentKey(
        userAddress,
        smartWalletAddress, // User's address = smart wallet address
        automationPrivateKey, // Key for automation permissions only
        {
          provider: 'gelato-native',
          agentAddress: automationAccount.address, // Automation signer
          smartWalletAddress: smartWalletAddress, // User's EOA
          gasSponsorship: !!this.sponsorApiKey,
          eip7702: true, // User's EOA becomes smart wallet
          relay: true, // Using Gelato Relay for execution
          createdAt: Date.now(),
        }
      );

      console.log('✅ EIP-7702 automation setup complete!');
      console.log('   Agent key ID:', agentKey.keyId);
      console.log('   Smart wallet (User EOA):', smartWalletAddress);
      console.log('   Automation signer:', automationAccount.address);
      console.log('   Gas sponsorship: ENABLED (Gelato Relay)');

      return {
        success: true,
        smartWalletAddress: smartWalletAddress, // User's own address
        agentKeyId: agentKey.keyId,
      };
    } catch (error) {
      console.error('❌ EIP-7702 automation setup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a DCA swap using Gelato Relay for gasless transactions
   * Using the more stable Gelato Relay SDK instead of Smart Wallet SDK
   */
  static async executeDCASwap(
    agentKeyId: string,
    swapCallData: `0x${string}`,
    swapTarget: Address,
    amountUSDC: bigint,
  ): Promise<GelatoExecutionResult> {
    try {
      console.log('💱 Executing DCA swap via Gelato Relay...');
      console.log('   Agent key ID:', agentKeyId);
      console.log('   Amount:', (Number(amountUSDC) / 1e6).toFixed(2), 'USDC');
      console.log('   Swap target:', swapTarget);

      // Step 1: Get agent key
      const { serverAgentKeyService } = await import('./serverAgentKeyService');
      const agentKey = await serverAgentKeyService.getAgentKey(agentKeyId);
      
      if (!agentKey || agentKey.provider !== 'gelato-native') {
        throw new Error('Invalid or non-Gelato agent key');
      }

      const agentPrivateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!agentPrivateKey) {
        throw new Error('Failed to decrypt agent private key');
      }

      // Step 2: Use automation key but execute from user's wallet (EIP-7702)
      const automationAccount = privateKeyToAccount(agentPrivateKey as Hex);
      
      // Get the user's address from the agent key metadata
      const userAddress = agentKey.userAddress as Address;
      const smartWalletAddress = agentKey.smartWalletAddress as Address; // Should be same as user address for EIP-7702
      
      console.log('🔧 Debug addresses:');
      console.log('   Raw agent key:', JSON.stringify(agentKey, null, 2));
      console.log('   Agent key owner (should be undefined):', agentKey.ownerAddress);
      console.log('   Agent key userAddress:', agentKey.userAddress);
      console.log('   Smart wallet addr:', smartWalletAddress);
      console.log('   Using as user addr:', userAddress);
      
      if (!userAddress) {
        throw new Error('User address not found in agent key data');
      }
      
      // Create Gelato Relay client for sponsored transactions
      console.log('🔧 Creating Gelato Relay client...');
      const relay = new GelatoRelay();
      
      // Create wallet client from automation account (needed for ERC2771)
      const walletClient = createWalletClient({
        account: automationAccount,
        chain: base,
        transport: http(),
      });

      console.log('🔄 Preparing EIP-7702 gasless transaction...');
      console.log('   User wallet (with USDC):', userAddress);
      console.log('   Automation signer:', automationAccount.address);
      console.log('   Smart wallet = User EOA:', userAddress);
      console.log('   API Key available:', !!this.sponsorApiKey);

      // Ensure API key is a valid string
      if (!this.sponsorApiKey || typeof this.sponsorApiKey !== 'string') {
        throw new Error(`Invalid sponsor API key: ${typeof this.sponsorApiKey} - ${this.sponsorApiKey}`);
      }

      // Step 3: Check user's USDC allowance (where the funds are)
      const { createPublicClient } = await import('viem');
      
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Check current allowance from USER'S wallet (not automation wallet)
      const currentAllowance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress, swapTarget], // USER's allowance
      }) as bigint;

      console.log('💰 User USDC allowance:', currentAllowance.toString());
      console.log('💰 Required amount:', amountUSDC.toString());

      // Use trimmed API key
      const cleanApiKey = this.sponsorApiKey.trim();
      console.log('🔧 Using cleaned API key:', cleanApiKey.slice(0, 8) + '...');

      let response;

      // Check if automation wallet has sufficient USDC
      const automationBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [automationAccount.address],
      }) as bigint;

      console.log('💰 Automation wallet USDC balance:', (Number(automationBalance) / 1e6).toFixed(6), 'USDC');

      if (automationBalance < amountUSDC) {
        // Automation wallet needs USDC - try sponsored funding first
        const needed = amountUSDC - automationBalance;
        const neededFormatted = (Number(needed) / 1e6).toFixed(6);
        
        console.log(`💰 Automation wallet needs ${neededFormatted} USDC`);
        console.log('🎁 Attempting sponsored funding...');

        // Import and use sponsored funding service
        const { SponsoredFundingService } = await import('./sponsoredFundingService');
        
        // Check if sponsored funding is available
        const sponsorStatus = await SponsoredFundingService.isAvailable();
        
        if (sponsorStatus.available) {
          console.log('✅ Sponsored funding available!');
          console.log('   Sponsor address:', sponsorStatus.sponsorAddress);
          console.log('   Sponsor balance:', sponsorStatus.sponsorBalance, 'USDC');
          
          // Get optimal funding amount (buffer for future executions)
          const fundingAmount = SponsoredFundingService.getMinimumFundingAmount(needed);
          console.log('   Funding amount:', (Number(fundingAmount) / 1e6).toFixed(6), 'USDC');
          
          const fundingResult = await SponsoredFundingService.fundAutomationWallet(
            automationAccount.address,
            fundingAmount,
            userAddress
          );
          
          if (fundingResult.success) {
            console.log('🎉 Automation wallet funded via sponsorship!');
            console.log('   Transaction hash:', fundingResult.txHash);
            
            // Update balance after funding
            const newBalance = await publicClient.readContract({
              address: TOKENS.USDC,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [automationAccount.address],
            }) as bigint;
            
            console.log('💰 New automation wallet balance:', (Number(newBalance) / 1e6).toFixed(6), 'USDC');
            
            // Continue with DCA execution
          } else {
            throw new Error(
              `Sponsored funding failed: ${fundingResult.error}. ` +
              `Please send ${neededFormatted} USDC to ${automationAccount.address} manually.`
            );
          }
        } else {
          throw new Error(
            `Automation wallet ${automationAccount.address} needs ${neededFormatted} more USDC. ` +
            `Please send ${neededFormatted} USDC to this address and try again. ` +
            `This is a one-time setup cost for automation.`
          );
        }
      }

      // Check automation wallet's allowance to the swap target
      const automationAllowance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [automationAccount.address, swapTarget],
      }) as bigint;

      console.log('💰 Automation allowance:', automationAllowance.toString());

      if (automationAllowance < amountUSDC) {
        // Need approval from automation wallet
        console.log('📝 Setting USDC allowance from automation wallet...');
        const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        
        const approveCallData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [swapTarget, maxUint256],
        });

        const approveRequest = {
          chainId: base.id,
          target: TOKENS.USDC,
          data: approveCallData,
        };

        response = await relay.sponsoredCall(approveRequest, cleanApiKey);
        console.log('✅ Automation wallet approval set:', response.taskId);
        
        // Wait for approval to complete before swap
        const approvalStatus = await this.waitForTaskExecution(response.taskId);
        if (!approvalStatus.executed) {
          throw new Error(`Approval failed: ${approvalStatus.status}`);
        }
        console.log('✅ Approval confirmed on-chain');
      }

      // Execute swap from automation wallet
      console.log('📝 Executing swap from automation wallet...');
      
      const swapRequest = {
        chainId: base.id,
        target: swapTarget,
        data: swapCallData,
      };

      response = await relay.sponsoredCall(swapRequest, cleanApiKey);
      console.log('✅ Swap executed from automation wallet:', response.taskId);

      console.log('🎉 Gelato automation DCA execution successful!');
      console.log('   Task ID:', response.taskId);
      console.log('   Gas cost: FREE (sponsored by Gelato)');

      // Wait for task execution and get actual transaction hash
      console.log('⏳ Waiting for swap task execution to complete...');
      const taskStatus = await this.waitForTaskExecution(response.taskId);
      
      if (taskStatus.executed && taskStatus.txHash) {
        console.log('✅ Swap task executed successfully!');
        console.log('   Transaction hash:', taskStatus.txHash);
        console.log('   🎯 SPX tokens should now be in automation wallet:', automationAccount.address);
        console.log('   💡 Note: Tokens are in automation wallet for future DCA executions');
        return {
          success: true,
          userOpHash: response.taskId,
          txHash: taskStatus.txHash, // Actual transaction hash
        };
      } else {
        console.log('❌ Swap task execution failed or timed out:', taskStatus.status);
        return {
          success: false,
          error: `Swap task execution failed: ${taskStatus.status}`,
        };
      }
    } catch (error) {
      console.error('❌ Gelato Relay DCA execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for Gelato task execution and get actual transaction hash
   */
  private static async waitForTaskExecution(taskId: string, maxAttempts = 12): Promise<{
    txHash?: string;
    status: string;
    executed: boolean;
  }> {
    console.log(`⏳ Waiting for task execution: ${taskId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check task status using Gelato API
        const statusResponse = await fetch(`https://api.gelato.digital/tasks/status/${taskId}`);
        
        if (statusResponse.ok) {
          const taskStatus = await statusResponse.json();
          console.log(`📊 Task ${taskId} status (attempt ${attempt}):`, taskStatus.taskState);
          
          if (taskStatus.taskState === 'ExecSuccess' && taskStatus.transactionHash) {
            console.log(`✅ Task executed successfully: ${taskStatus.transactionHash}`);
            return {
              txHash: taskStatus.transactionHash,
              status: taskStatus.taskState,
              executed: true
            };
          }
          
          if (taskStatus.taskState === 'ExecReverted' || taskStatus.taskState === 'Cancelled') {
            console.log(`❌ Task failed: ${taskStatus.taskState}`);
            return {
              status: taskStatus.taskState,
              executed: false
            };
          }
          
          // Task is still pending, wait and retry
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          }
        } else {
          console.log(`⚠️ Failed to check task status (attempt ${attempt}): ${statusResponse.status}`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking task status (attempt ${attempt}):`, error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    console.log(`⏰ Task ${taskId} did not complete within ${maxAttempts} attempts`);
    return {
      status: 'timeout',
      executed: false
    };
  }

  /**
   * Get estimated gas cost (should be 0 with sponsorship)
   */
  static async getEstimatedGasCost(): Promise<{ 
    gasCost: string; 
    sponsored: boolean 
  }> {
    return {
      gasCost: '0',
      sponsored: !!this.sponsorApiKey,
    };
  }

  /**
   * Check if an address is ready for Gelato Relay execution
   * For Gelato Relay, any EOA can execute gasless transactions
   */
  static async isSmartWalletDeployed(address: Address): Promise<boolean> {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Check if the address exists (has some transaction history)
      const nonce = await publicClient.getTransactionCount({ address });
      return nonce >= 0; // Any valid address can use Gelato Relay
    } catch {
      return false;
    }
  }
}