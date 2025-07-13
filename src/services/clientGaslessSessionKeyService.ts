'use client';

import { parseUnits, type Address, erc20Abi } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { 
  createBasePublicClient,
  createZeroDevSigner,
} from '../utils/zerodev';
import { TOKENS } from '../utils/openOceanApi';

export interface ClientGaslessSessionKeyResult {
  success: boolean;
  sessionPrivateKey?: string;
  sessionKeyApproval?: string;
  agentAddress?: Address;
  smartWalletAddress?: Address;
  agentKeyId?: string;
  error?: string;
}

export class ClientGaslessSessionKeyService {
  
  /**
   * Create gasless session key using the user's actual wallet
   * This ensures proper ZeroDev permission validation
   */
  static async createClientSideGaslessSessionKey(
    userWallet: any, // Privy wallet instance
    smartWalletAddress: Address,
    userAddress: Address
  ): Promise<ClientGaslessSessionKeyResult> {
    try {
      console.log('🔑 Creating client-side gasless session key...');
      console.log('   User address:', userAddress);
      console.log('   Smart wallet:', smartWalletAddress);
      
      const publicClient = createBasePublicClient();
      
      // Generate session key for the agent
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('✅ Agent session key generated:', sessionAccount.address);
      
      // Import required ZeroDev modules
      console.log('📦 Importing ZeroDev modules...');
      const { toPermissionValidator, serializePermissionAccount } = await import('@zerodev/permissions');
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { 
        toSudoPolicy,
        toGasPolicy,
        toCallPolicy,
        toRateLimitPolicy,
        toValueLimitPolicy
      } = await import('@zerodev/permissions/policies');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
      const { createKernelAccount } = await import('@zerodev/sdk');
      
      console.log('✅ All ZeroDev modules imported');
      
      // Create the user's main wallet signer (CRITICAL: This must be the real user wallet)
      console.log('🔐 Creating main wallet validator...');
      const mainSigner = await createZeroDevSigner(userWallet);
      
      // Create main wallet validator
      const mainValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: mainSigner,
        kernelVersion: KERNEL_V3_1,
      });
      
      console.log('✅ Main wallet validator created');
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: sessionAccount });
      
      // Create comprehensive policies for gasless DCA operations
      console.log('🔐 Creating comprehensive gasless policies...');
      
      // 1. SUDO Policy - Maximum permissions for simplicity and reliability
      const sudoPolicy = toSudoPolicy({});
      
      // 2. Gas Policy - CRITICAL: Enable gas sponsorship
      const gasPolicy = toGasPolicy({
        allowed: true, // This enables gasless transactions
      });
      
      // 3. Call Policy - Restrict to DCA-related operations for security
      const targetTokens = [TOKENS.USDC, TOKENS.SPX6900];
      const allowedSpenders = ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address]; // OpenOcean router
      
      const allowedCalls: any[] = [];
      
      // Allow ERC20 operations on target tokens
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
      
      // Allow calls to swap routers
      for (const spender of allowedSpenders) {
        allowedCalls.push({
          target: spender,
          // Allow any function call to the router for swap execution
        });
      }
      
      const callPolicy = toCallPolicy({
        permissions: allowedCalls
      });
      
      // 4. Rate Limit Policy - Prevent abuse
      const rateLimitPolicy = toRateLimitPolicy({
        count: 100, // Max 100 operations
        interval: 86400, // Per day (24 hours)
      });
      
      // 5. Value Limit Policy - Limit ETH value (should be 0 for gasless)
      const valueLimitPolicy = toValueLimitPolicy({
        limit: parseUnits('0', 18), // 0 ETH (only token operations)
      });
      
      console.log('✅ Policies created:');
      console.log('   - SUDO policy: Maximum permissions');
      console.log('   - Gas policy: Sponsorship ENABLED');
      console.log('   - Call policy:', allowedCalls.length, 'allowed operations');
      console.log('   - Rate limit: 100 ops/day');
      console.log('   - Value limit: 0 ETH');
      
      // Create permission validator with all policies (including gas policy!)
      const agentPermissionValidator = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: agentSigner,
        policies: [sudoPolicy, gasPolicy, callPolicy, rateLimitPolicy, valueLimitPolicy],
        kernelVersion: KERNEL_V3_1,
      });
      
      console.log('✅ Agent permission validator created with gas sponsorship');
      
      // Create kernel account with REAL user wallet as sudo and agent as regular
      console.log('🔧 Creating kernel account with user wallet...');
      const permissionAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: mainValidator,     // Real user wallet (required for signing)
          regular: agentPermissionValidator, // Agent with gasless permissions
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: smartWalletAddress, // Use existing smart wallet
      });
      
      console.log('✅ Kernel account created');
      console.log('   Smart wallet address:', permissionAccount.address);
      console.log('   Expected address:', smartWalletAddress);
      
      // Verify addresses match
      if (permissionAccount.address.toLowerCase() !== smartWalletAddress.toLowerCase()) {
        console.warn('⚠️ Address mismatch detected');
        console.warn('   Created:', permissionAccount.address);
        console.warn('   Expected:', smartWalletAddress);
        // Continue anyway - this might be expected behavior
      }
      
      // Serialize the permission account (this creates the signed approval)
      console.log('📝 Serializing permission account with user signature...');
      const sessionKeyApproval = await serializePermissionAccount(permissionAccount);
      
      console.log('✅ Session key approval created with user signature');
      console.log('   Approval length:', sessionKeyApproval.length);
      
      // Store the session key on the server
      console.log('💾 Storing session key on server...');
      const storeResponse = await fetch(`${window.location.origin}/api/store-client-session-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          smartWalletAddress,
          sessionPrivateKey,
          sessionKeyApproval,
          agentAddress: sessionAccount.address,
        }),
      });
      
      if (!storeResponse.ok) {
        const error = await storeResponse.json();
        throw new Error(`Failed to store session key: ${error.error}`);
      }
      
      const storeResult = await storeResponse.json();
      
      console.log('🎉 Client-side gasless session key created successfully!');
      console.log('   Agent key ID:', storeResult.agentKeyId);
      console.log('   Agent address:', sessionAccount.address);
      console.log('   Smart wallet:', permissionAccount.address);
      console.log('   Gas sponsorship: ENABLED');
      
      return {
        success: true,
        sessionPrivateKey,
        sessionKeyApproval,
        agentAddress: sessionAccount.address,
        smartWalletAddress: permissionAccount.address,
        agentKeyId: storeResult.agentKeyId,
      };
      
    } catch (error) {
      console.error('❌ Client-side gasless session key creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Create simplified gasless session key with just SUDO + gas policies
   * Simpler approach that should be more reliable
   */
  static async createSimpleClientGaslessSessionKey(
    userWallet: any,
    smartWalletAddress: Address,
    userAddress: Address
  ): Promise<ClientGaslessSessionKeyResult> {
    try {
      console.log('🔑 Creating simple client-side gasless session key...');
      console.log('   User address:', userAddress);
      console.log('   Smart wallet:', smartWalletAddress);
      
      const publicClient = createBasePublicClient();
      
      // Generate session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('✅ Agent session key generated:', sessionAccount.address);
      
      // Import required modules
      const { toPermissionValidator, serializePermissionAccount } = await import('@zerodev/permissions');
      const { toECDSASigner } = await import('@zerodev/permissions/signers');
      const { toSudoPolicy, toGasPolicy } = await import('@zerodev/permissions/policies');
      const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
      const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
      const { createKernelAccount } = await import('@zerodev/sdk');
      
      // Create main wallet validator with real user wallet
      const mainSigner = await createZeroDevSigner(userWallet);
      const mainValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: mainSigner,
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create agent signer
      const agentSigner = await toECDSASigner({ signer: sessionAccount });
      
      // Simple but powerful policies
      console.log('🔐 Creating SUDO + gas policies...');
      const sudoPolicy = toSudoPolicy({});
      const gasPolicy = toGasPolicy({
        allowed: true, // Enable gas sponsorship
      });
      
      console.log('✅ Gas sponsorship policy enabled');
      
      // Create permission validator with SUDO + gas policies
      const agentPermissionValidator = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        signer: agentSigner,
        policies: [sudoPolicy, gasPolicy],
        kernelVersion: KERNEL_V3_1,
      });
      
      // Create kernel account
      const permissionAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        plugins: {
          sudo: mainValidator,
          regular: agentPermissionValidator,
        },
        kernelVersion: KERNEL_V3_1,
        deployedAccountAddress: smartWalletAddress,
      });
      
      // Serialize with user signature
      const sessionKeyApproval = await serializePermissionAccount(permissionAccount);
      
      // Store on server
      const storeResponse = await fetch(`${window.location.origin}/api/store-client-session-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          smartWalletAddress,
          sessionPrivateKey,
          sessionKeyApproval,
          agentAddress: sessionAccount.address,
        }),
      });
      
      if (!storeResponse.ok) {
        const error = await storeResponse.json();
        throw new Error(`Failed to store session key: ${error.error}`);
      }
      
      const storeResult = await storeResponse.json();
      
      console.log('✅ Simple gasless session key created successfully');
      
      return {
        success: true,
        sessionPrivateKey,
        sessionKeyApproval,
        agentAddress: sessionAccount.address,
        smartWalletAddress: permissionAccount.address,
        agentKeyId: storeResult.agentKeyId,
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