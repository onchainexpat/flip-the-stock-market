'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { parseEther, parseUnits, type Address, erc20Abi, encodeFunctionData } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { 
  createBasePublicClient,
  createZeroDevKernelAccount,
  createZeroDevKernelClient,
} from '../utils/zerodev';
import { TOKENS } from '../utils/openOceanApi';

export interface OneClickDCAParams {
  amount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: string;
  platformFeePercentage?: number;
}

export interface OneClickDCAResult {
  success: boolean;
  orderId?: string;
  smartWalletAddress?: Address;
  txHash?: string;
  error?: string;
}

export class OneClickDCAService {
  
  /**
   * Execute complete one-click DCA setup
   * This handles: smart wallet deployment + USDC transfer + approvals + DCA creation
   */
  static async executeOneClickDCA(
    params: OneClickDCAParams,
    userWalletAddress: Address,
    wallet: any // Privy wallet instance
  ): Promise<OneClickDCAResult> {
    try {
      console.log('🚀 Starting one-click DCA setup...');
      
      const { amount, frequency, duration, platformFeePercentage = 0 } = params;
      const totalAmountWei = parseUnits(amount, 6); // USDC has 6 decimals
      
      // Step 1: Deploy smart wallet if needed
      console.log('📦 Setting up smart wallet...');
      const publicClient = createBasePublicClient();
      
      const kernelAccount = await createZeroDevKernelAccount(
        publicClient,
        wallet,
        base,
      );
      
      const kernelClient = await createZeroDevKernelClient(kernelAccount, base);
      console.log('✅ Smart wallet ready:', kernelAccount.address);
      
      // Step 1.5: Generate session key for automation
      console.log('🔑 Generating session key for automation...');
      let sessionPrivateKey = generatePrivateKey();
      let sessionAccount = privateKeyToAccount(sessionPrivateKey);
      console.log('✅ Session key generated:', sessionAccount.address);
      
      // Step 1.6: Create gasless session key with user's wallet signature
      console.log('🔐 Creating gasless session key with user signature...');
      console.log('   Session key address:', sessionAccount.address);
      console.log('   Smart wallet address:', kernelAccount.address);
      
      let sessionKeyApproval = null;
      let agentKeyId = null;
      
      try {
        // Import the client-side gasless session key service
        const { ClientGaslessSessionKeyService } = await import('./clientGaslessSessionKeyService');
        
        console.log('🚀 Creating client-side gasless session key...');
        
        // Use the simple approach for reliability
        const sessionKeyResult = await ClientGaslessSessionKeyService.createSimpleClientGaslessSessionKey(
          wallet,
          kernelAccount.address,
          userWalletAddress
        );
        
        if (sessionKeyResult.success) {
          sessionKeyApproval = sessionKeyResult.sessionKeyApproval;
          agentKeyId = sessionKeyResult.agentKeyId;
          
          // Override the generated session key with the one from the service
          sessionPrivateKey = sessionKeyResult.sessionPrivateKey!;
          sessionAccount = privateKeyToAccount(sessionPrivateKey);
          
          console.log('✅ Gasless session key created successfully!');
          console.log('   Agent key ID:', agentKeyId);
          console.log('   Agent address:', sessionKeyResult.agentAddress);
          console.log('   Gas sponsorship: ENABLED');
        } else {
          console.error('❌ Gasless session key creation failed:', sessionKeyResult.error);
          // Continue with fallback approach
          sessionKeyApproval = null;
          agentKeyId = null;
        }
        
      } catch (error) {
        console.error('❌ Client-side session key creation failed:', error);
        console.error('   Stack:', error.stack);
        // Continue - order will be created but automation may not work optimally
        sessionKeyApproval = null;
        agentKeyId = null;
      }
      
      // Step 1.7: Gas sponsorship enabled - no ETH funding needed
      console.log('✅ Gas sponsorship enabled - smart wallet doesn\'t need ETH funding');
      console.log('   Transactions will be sponsored by ZeroDev paymaster');

      // Step 2: Create batched transaction for USDC transfer + approvals
      console.log('💰 Preparing batched transaction...');
      
      // Encode USDC transfer from user wallet to smart wallet
      const transferCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [kernelAccount.address, totalAmountWei],
      });
      
      // Encode USDC approval for OpenOcean router
      const approveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64', totalAmountWei],
      });
      
      // Step 3: Execute the batched transaction via user's wallet
      console.log('🔄 Requesting user signature for batched transaction...');
      
      // Get ethereum provider from wallet  
      const provider = await wallet.getEthereumProvider();
      
      // For now, we'll do this in separate steps but we can optimize later
      // First, transfer USDC to smart wallet
      const transferTxHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: userWalletAddress,
          to: TOKENS.USDC,
          data: transferCalldata,
        }],
      });
      
      console.log('✅ USDC transferred to smart wallet:', transferTxHash);
      
      // Step 4: Set up approvals on the smart wallet (gas-sponsored)
      console.log('🔐 Setting up smart wallet approvals...');
      
      const approveTxHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        data: approveCalldata,
        value: parseEther('0'),
      });
      
      console.log('✅ Smart wallet approvals set:', approveTxHash);
      
      // Step 5: Create DCA order server-side
      console.log('📋 Creating DCA order...');
      
      const response = await fetch(`${window.location.origin}/api/dca-orders-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: userWalletAddress,
          smartWalletAddress: kernelAccount.address,
          totalAmount: amount,
          frequency,
          duration,
          platformFeePercentage,
          // Use the client-created agent key if available, otherwise fallback
          agentKeyId: agentKeyId, // Use pre-created gasless agent key
          sessionPrivateKey: agentKeyId ? null : sessionPrivateKey, // Legacy fallback
          sessionKeyApproval: agentKeyId ? null : sessionKeyApproval, // Legacy fallback
        }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to create DCA order';
        try {
          const errorData = await response.text();
          console.error('DCA order creation failed:', errorData);
          const error = JSON.parse(errorData);
          errorMessage = error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      console.log('🎉 One-click DCA setup complete!');
      
      return {
        success: true,
        orderId: result.order.id,
        smartWalletAddress: kernelAccount.address,
        txHash: transferTxHash,
      };
      
    } catch (error) {
      console.error('❌ One-click DCA failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * React hook for one-click DCA functionality
 */
export function useOneClickDCA() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  const executeOneClickDCA = async (params: OneClickDCAParams): Promise<OneClickDCAResult> => {
    if (!user?.wallet?.address || wallets.length === 0) {
      return {
        success: false,
        error: 'Wallet not connected',
      };
    }
    
    return OneClickDCAService.executeOneClickDCA(
      params,
      user.wallet.address as Address,
      wallets[0] // Pass the actual wallet
    );
  };
  
  return {
    executeOneClickDCA,
    isReady: !!user?.wallet?.address && wallets.length > 0,
  };
}