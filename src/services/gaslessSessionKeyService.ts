'use client';

import { parseUnits, type Address, erc20Abi, encodeFunctionData } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { 
  createBasePublicClient,
  createZeroDevSigner,
} from '../utils/zerodev';
import { TOKENS } from '../utils/openOceanApi';

export interface GaslessSessionKeyResult {
  success: boolean;
  sessionPrivateKey?: string;
  sessionKeyApproval?: string;
  agentAddress?: Address;
  smartWalletAddress?: Address;
  error?: string;
}

export class GaslessSessionKeyService {
  
  /**
   * Create session key with explicit gas sponsorship policies
   * This ensures the session key can execute transactions without ETH in the smart wallet
   */
  static async createGaslessSessionKey(
    userWallet: any, // Privy wallet instance
    smartWalletAddress: Address,
    targetTokens: Address[] = [TOKENS.USDC, TOKENS.SPX6900],
    allowedSpenders: Address[] = ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64'] // OpenOcean router
  ): Promise<GaslessSessionKeyResult> {
    try {
      console.log('🔑 Creating gasless session key...');
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Target tokens:', targetTokens);
      console.log('   Allowed spenders:', allowedSpenders);
      
      const publicClient = createBasePublicClient();
      
      // Generate session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('✅ Session key generated:', sessionAccount.address);
      
      // Import required modules
      const { toPermissionValidator, serializePermissionAccount } = await import('@zerodev/permissions');
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { 
        toCallPolicy,
        toGasPolicy,
        toRateLimitPolicy,
        toValueLimitPolicy
      } = await import('@zerodev/permissions/policies');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
      const { createKernelAccount } = await import('@zerodev/sdk');
      
      console.log('✅ All imports successful');
      
      // Get the main wallet signer
      const mainSigner = await createZeroDevSigner(userWallet);
      
      // Create main wallet validator
      const mainValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: mainSigner,
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: sessionAccount });
      
      // Create comprehensive policies for DCA operations
      console.log('🔐 Creating comprehensive DCA policies...');
      
      // 1. Call Policy - Allow specific ERC20 operations on target tokens
      const allowedCalls: any[] = [];
      
      // Add ERC20 transfer and approve calls for each target token
      for (const token of targetTokens) {
        // Allow transfers
        allowedCalls.push({
          target: token,
          abi: erc20Abi,
          functionName: 'transfer',
        });
        
        // Allow approvals to specific spenders
        for (const spender of allowedSpenders) {
          allowedCalls.push({
            target: token,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, null], // null means any amount
          });
        }
      }
      
      // Add calls to allowed spenders (swap routers)
      for (const spender of allowedSpenders) {
        allowedCalls.push({
          target: spender,
          // Allow any function call to the router (for swap execution)
        });
      }
      
      const callPolicy = toCallPolicy({
        permissions: allowedCalls
      });
      
      // 2. Gas Policy - Allow gas sponsorship
      const gasPolicy = toGasPolicy({
        allowed: true, // Allow gas sponsorship
      });
      
      // 3. Rate Limit Policy - Limit to reasonable DCA frequency
      const rateLimitPolicy = toRateLimitPolicy({
        count: 50, // Max 50 operations
        interval: 86400, // Per day (24 hours)
      });
      
      // 4. Value Limit Policy - Limit ETH value that can be sent
      const valueLimitPolicy = toValueLimitPolicy({
        limit: parseUnits('0', 18), // 0 ETH (only token operations)
      });
      
      console.log('✅ Policies created:');
      console.log('   - Call policy with', allowedCalls.length, 'allowed operations');
      console.log('   - Gas policy: sponsorship enabled');
      console.log('   - Rate limit: 50 ops/day');
      console.log('   - Value limit: 0 ETH');
      
      // Create permission validator with all policies
      const agentPermissionValidator = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: agentSigner,
        policies: [callPolicy, gasPolicy, rateLimitPolicy, valueLimitPolicy],
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create kernel account with permissions
      console.log('🔧 Creating permission account...');
      const permissionAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: mainValidator,
          regular: agentPermissionValidator,
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: smartWalletAddress, // Use existing smart wallet
      });
      
      // Serialize the permission account
      const sessionKeyApproval = await serializePermissionAccount(permissionAccount);
      
      console.log('✅ Gasless session key created successfully');
      console.log('   Agent address:', sessionAccount.address);
      console.log('   Smart wallet:', permissionAccount.address);
      console.log('   Approval length:', sessionKeyApproval.length);
      
      // Verify the addresses match
      if (permissionAccount.address.toLowerCase() !== smartWalletAddress.toLowerCase()) {
        console.warn('⚠️ Address mismatch detected');
        console.warn('   Created:', permissionAccount.address);
        console.warn('   Expected:', smartWalletAddress);
      }
      
      return {
        success: true,
        sessionPrivateKey,
        sessionKeyApproval,
        agentAddress: sessionAccount.address,
        smartWalletAddress: permissionAccount.address,
      };
      
    } catch (error) {
      console.error('❌ Gasless session key creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Create session key with SUDO policy but explicit gas sponsorship
   * Simpler approach that should work with gas sponsorship
   */
  static async createSimpleGaslessSessionKey(
    userWallet: any,
    smartWalletAddress: Address
  ): Promise<GaslessSessionKeyResult> {
    try {
      console.log('🔑 Creating simple gasless session key...');
      console.log('   Smart wallet:', smartWalletAddress);
      
      const publicClient = createBasePublicClient();
      
      // Generate session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('✅ Session key generated:', sessionAccount.address);
      
      // Import required modules
      const { toPermissionValidator, serializePermissionAccount } = await import('@zerodev/permissions');
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { 
        toSudoPolicy,
        toGasPolicy
      } = await import('@zerodev/permissions/policies');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
      const { createKernelAccount } = await import('@zerodev/sdk');
      
      // Get the main wallet signer
      const mainSigner = await createZeroDevSigner(userWallet);
      
      // Create main wallet validator
      const mainValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: mainSigner,
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: sessionAccount });
      
      // Use SUDO policy for maximum permissions + explicit gas policy
      console.log('🔐 Creating SUDO + gas policies...');
      const sudoPolicy = toSudoPolicy({});
      const gasPolicy = toGasPolicy({
        allowed: true,
      });
      
      // Create permission validator with SUDO + gas policies
      const agentPermissionValidator = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: agentSigner,
        policies: [sudoPolicy, gasPolicy],
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create kernel account with permissions
      const permissionAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: mainValidator,
          regular: agentPermissionValidator,
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: smartWalletAddress,
      });
      
      // Serialize the permission account
      const sessionKeyApproval = await serializePermissionAccount(permissionAccount);
      
      console.log('✅ Simple gasless session key created successfully');
      
      return {
        success: true,
        sessionPrivateKey,
        sessionKeyApproval,
        agentAddress: sessionAccount.address,
        smartWalletAddress: permissionAccount.address,
      };
      
    } catch (error) {
      console.error('❌ Simple gasless session key creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}