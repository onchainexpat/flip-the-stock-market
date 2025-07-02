'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from 'wagmi';

interface OldWallet {
  address: string;
  kernelVersion: string;
  usdcBalance: string;
  ethBalance: string;
  isDeployed: boolean;
}

export function useKernelVersionMigration() {
  const { address: externalWallet } = useAccount();
  const { user } = usePrivy();
  const { data: walletClient } = useWalletClient();
  const [isExecuting, setIsExecuting] = useState(false);

  const {
    writeContract,
    data: contractHash,
    error: contractError,
    isPending: isContractPending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: contractHash,
  });

  /**
   * Execute migration with kernel version compatibility
   */
  const executeMigrationTransaction = async (
    oldWallet: OldWallet,
    destinationAddress: string,
    migrationType: 'new_wallet' | 'external',
  ) => {
    if (!externalWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsExecuting(true);

    try {
      console.log('🚀 Starting kernel-version-aware migration...');
      console.log(`📍 From: ${oldWallet.address} (${oldWallet.kernelVersion})`);
      console.log(`📍 To: ${destinationAddress}`);

      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const usdcAmount = BigInt(
        Math.floor(Number(oldWallet.usdcBalance) * 1000000),
      );

      // Generate USDC transfer calldata
      const transferCalldata = `0xa9059cbb${destinationAddress.slice(2).padStart(64, '0')}${usdcAmount.toString(16).padStart(64, '0')}`;

      console.log('💰 Migration details:');
      console.log(`   Amount: ${oldWallet.usdcBalance} USDC`);
      console.log(`   Kernel: ${oldWallet.kernelVersion}`);
      console.log(`   From: ${oldWallet.address}`);
      console.log(`   To: ${destinationAddress}`);

      // The key insight: Gas sponsorship only works through ZeroDev's bundler infrastructure
      // For KERNEL_V3_1 wallets, the paymaster should still work if we use the right approach
      console.log('🎁 Attempting direct execution with proper gas handling...');

      if (oldWallet.kernelVersion === 'KERNEL_V3_1') {
        console.log(
          '🚀 KERNEL_V3_1 detected - attempting ZeroDev paymaster execution...',
        );
        toast('Executing with ZeroDev paymaster for KERNEL_V3_1 wallet...', {
          duration: 4000,
        });

        // For KERNEL_V3_1, only try sponsored execution (no fallback)
        await executeWithSponsorship(
          oldWallet,
          destinationAddress,
          transferCalldata,
        );
      } else {
        console.log(
          '🔄 KERNEL_V3_0 - attempting ZeroDev paymaster execution...',
        );
        toast('Executing with ZeroDev paymaster...', { duration: 3000 });

        // For current kernel version, only try sponsored execution (no fallback)
        await executeWithSponsorship(
          oldWallet,
          destinationAddress,
          transferCalldata,
        );
      }
    } catch (error) {
      console.error('❌ Migration execution failed:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('1002') ||
        errorMessage.includes('execution reverted')
      ) {
        toast.error(
          '❌ Smart wallet authorization failed. Your connected wallet may not be the owner of this old smart wallet.',
          { duration: 8000 },
        );
        console.log('💡 Authorization issue detected');
        console.log(
          '   Try connecting the original wallet that created this smart wallet',
        );
      } else {
        toast.error(`Migration failed: ${errorMessage}`);
      }

      setIsExecuting(false);
    }
  };

  /**
   * Execute without gas sponsorship (for incompatible kernel versions)
   */
  const executeWithoutSponsorship = async (
    oldWallet: OldWallet,
    destinationAddress: string,
    transferCalldata: string,
  ) => {
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const packedCalldata = `0x${USDC_ADDRESS.slice(2).toLowerCase()}${'0'.repeat(64)}${transferCalldata.slice(2)}`;

    console.log('💳 Executing with regular gas payment...');

    // Use writeContract with regular gas payment for proper ABI encoding
    await writeContract({
      address: oldWallet.address as Address,
      account: externalWallet,
      chain: base,
      abi: [
        {
          name: 'execute',
          type: 'function',
          stateMutability: 'payable',
          inputs: [
            { name: '', type: 'uint256' },
            { name: 'execMode', type: 'bytes32' },
            { name: 'executionCalldata', type: 'bytes' },
          ],
          outputs: [],
        },
      ],
      functionName: 'execute',
      args: [
        BigInt(0), // first parameter
        '0x0100000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // execMode
        packedCalldata as `0x${string}`, // executionCalldata
      ],
    });

    toast.success(
      'Transaction sent! You paid gas fees. Waiting for confirmation...',
    );
  };

  /**
   * Execute with ZeroDev paymaster - PROPER ZERODEV INFRASTRUCTURE
   */
  const executeWithSponsorship = async (
    oldWallet: OldWallet,
    destinationAddress: string,
    transferCalldata: string,
  ) => {
    console.log('🚀 ZeroDev Paymaster-Sponsored Execution');
    console.log(
      '📍 Smart Wallet:',
      oldWallet.address,
      `(${oldWallet.kernelVersion})`,
    );
    console.log('📍 Connected EOA:', externalWallet);
    console.log('📍 To:', destinationAddress);
    console.log('💰 Amount:', oldWallet.usdcBalance, 'USDC');

    if (!walletClient || !externalWallet) {
      throw new Error('No wallet connected');
    }

    try {
      // Import viem components
      const { createPublicClient, http, parseAbi } = await import('viem');

      // Import ZeroDev SDK components
      const {
        createKernelAccountClient,
        createKernelAccount,
        createZeroDevPaymasterClient,
      } = await import('@zerodev/sdk');

      const { KERNEL_V3_1, KERNEL_V3_0, getEntryPoint } = await import(
        '@zerodev/sdk/constants'
      );

      const { signerToEcdsaValidator } = await import(
        '@zerodev/ecdsa-validator'
      );

      const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
      if (!projectId) {
        throw new Error('ZeroDev project ID not configured');
      }

      console.log('🔍 Using ZeroDev Project ID:', projectId);

      // Determine kernel version and entry point for the old wallet
      const kernelVersionConstant =
        oldWallet.kernelVersion === 'KERNEL_V3_0' ? KERNEL_V3_0 : KERNEL_V3_1;
      const entryPoint = getEntryPoint(
        oldWallet.kernelVersion === 'KERNEL_V3_0' ? '0.7' : '0.6',
      );

      console.log(
        '🔍 Kernel Version:',
        oldWallet.kernelVersion,
        kernelVersionConstant,
      );
      console.log('🔍 Entry Point:', entryPoint);

      // Try v3 API first (newer), then fallback to v2
      let zeroDevRpcUrl = `https://rpc.zerodev.app/api/v3/${projectId}/chain/8453`;
      let paymasterUrl = `https://rpc.zerodev.app/api/v3/${projectId}/paymaster`;

      console.log('🔍 ZeroDev Project ID:', projectId);
      console.log('🔍 Trying v3 API first...');
      console.log('🔍 ZeroDev RPC URL:', zeroDevRpcUrl);

      let publicClient;
      try {
        // Test v3 API endpoint first
        publicClient = createPublicClient({
          chain: base,
          transport: http(zeroDevRpcUrl),
        });

        // Test if the v3 endpoint works by calling getChainId
        await publicClient.getChainId();
        console.log('✅ ZeroDev v3 API working');
      } catch (v3Error) {
        console.log('⚠️ v3 API failed, trying v2 fallback...');
        console.log('v3 Error:', v3Error.message);

        // Fallback to v2 API
        zeroDevRpcUrl = `https://rpc.zerodev.app/api/v2/bundler/${projectId}`;
        paymasterUrl = `https://rpc.zerodev.app/api/v2/paymaster/${projectId}`;

        console.log('🔍 Fallback ZeroDev RPC URL:', zeroDevRpcUrl);

        publicClient = createPublicClient({
          chain: base,
          transport: http(zeroDevRpcUrl),
        });

        try {
          // Test if the v2 endpoint works
          await publicClient.getChainId();
          console.log('✅ ZeroDev v2 API working');
        } catch (v2Error) {
          console.error('❌ Both v3 and v2 APIs failed');
          console.error('v3 Error:', v3Error.message);
          console.error('v2 Error:', v2Error.message);
          throw new Error(
            `ZeroDev project ID ${projectId} not found on Base network. Please verify your project is configured for Base (Chain ID 8453) at https://dashboard.zerodev.app/`,
          );
        }
      }

      console.log('✅ ZeroDev public client created');

      // Create a SEPARATE regular Base public client for kernel account creation
      // ZeroDev's public client might not work properly for createKernelAccount
      console.log(
        '🔧 Creating regular Base public client for kernel account creation...',
      );
      const regularPublicClient = createPublicClient({
        chain: base,
        transport: http(), // Use default Base RPC
      });

      console.log('✅ Regular Base public client created');

      // Create paymaster client
      const paymasterClient = createZeroDevPaymasterClient({
        chain: base,
        transport: http(paymasterUrl),
        entryPoint,
      });

      console.log('✅ ZeroDev paymaster client created');

      // Create a signer from the connected wallet client
      console.log('🔧 Using wallet client as signer...');
      if (!walletClient.account) {
        throw new Error('No account available in wallet client');
      }

      const signer = walletClient;

      console.log('✅ Signer created:', signer.account.address);

      // Create ECDSA validator
      console.log('🔧 Creating ECDSA validator...');
      console.log('🔍 Public client:', publicClient);
      console.log('🔍 Signer:', signer);
      console.log('🔍 Signer account:', signer.account);
      console.log('🔍 Entry point:', entryPoint);
      console.log('🔍 Kernel version constant:', kernelVersionConstant);

      // Test both public clients
      try {
        const chainId = await publicClient.getChainId();
        console.log('✅ ZeroDev public client working, chain ID:', chainId);

        const regularChainId = await regularPublicClient.getChainId();
        console.log(
          '✅ Regular public client working, chain ID:',
          regularChainId,
        );

        const blockNumber = await regularPublicClient.getBlockNumber();
        console.log(
          '✅ Regular public client working, latest block:',
          blockNumber,
        );
      } catch (clientError) {
        console.error('❌ Public client not working:', clientError);
        throw new Error(`Public client failed: ${clientError.message}`);
      }

      // Use the regular public client for ECDSA validator creation
      console.log(
        '🔧 Creating ECDSA validator with regular Base public client...',
      );
      const ecdsaValidator = await signerToEcdsaValidator(regularPublicClient, {
        signer,
        entryPoint,
        kernelVersion: kernelVersionConstant,
      });

      console.log('✅ ECDSA validator created:', ecdsaValidator);
      console.log('🔍 Validator type:', typeof ecdsaValidator);
      console.log('🔍 Validator keys:', Object.keys(ecdsaValidator || {}));

      // KEY INSIGHT: We need to create a NEW kernel account that represents the EXISTING smart wallet
      // but configure it with the original owner's signer so UserOperations can be sponsored

      console.log(
        '🔧 Creating sponsored kernel account for existing smart wallet...',
      );
      console.log('🏠 Target wallet:', oldWallet.address);
      console.log('🔍 Re-creating account to match existing wallet address...');

      // The trick: We need to recreate the EXACT same kernel account that would produce
      // the same address as the old wallet, then use that for sponsored execution

      // Create kernel account using the validator - this should match the old wallet address
      console.log('🔧 Creating kernel account with configuration:');
      console.log('   EntryPoint:', entryPoint);
      console.log('   Kernel Version:', kernelVersionConstant);
      console.log('   ECDSA Validator:', ecdsaValidator);
      console.log(
        '   Using regular Base public client for kernel account creation...',
      );

      const kernelAccount = await createKernelAccount(regularPublicClient, {
        entryPoint,
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion: kernelVersionConstant,
      });

      console.log(
        '🏠 Recreated kernel account address:',
        kernelAccount.address,
      );
      console.log('🏠 Target old wallet address:', oldWallet.address);
      console.log('🔍 Kernel account object:', kernelAccount);
      console.log('🔍 Kernel account keys:', Object.keys(kernelAccount || {}));

      // Check if addresses match
      if (
        kernelAccount.address.toLowerCase() !== oldWallet.address.toLowerCase()
      ) {
        // Address mismatch - this is actually expected for existing wallets
        // The issue is that we can't perfectly recreate the original kernel account parameters
        console.warn(
          '⚠️ Address mismatch detected - cannot recreate exact kernel account',
        );
        console.warn('   Recreated:', kernelAccount.address);
        console.warn('   Expected:', oldWallet.address);
        console.warn('🔄 Switching to direct execution approach...');

        // Instead of failing, let's try a direct approach using the existing smart wallet
        // We'll use the existing ECDSA validator and recreated kernel account, but override the address
        console.log(
          '🔧 Using kernel account as base and overriding address...',
        );

        // Use the kernel account but override its address to match the existing wallet
        const existingAccount = {
          ...kernelAccount,
          address: oldWallet.address as Address,
          // Mark as already deployed to prevent initCode generation
          isDeployed: async () => true,
          // Override generateInitCode to return empty since wallet is already deployed
          generateInitCode: async () => '0x' as `0x${string}`,
        };

        console.log(
          '🔧 Overrode kernel account address and marked as deployed',
        );

        console.log('✅ Created kernel account with overridden address');
        console.log(
          '🏠 Using existing smart wallet address:',
          existingAccount.address,
        );
        console.log(
          '🔍 Account has encodeCalls method:',
          typeof existingAccount.encodeCalls,
        );
        console.log(
          '🔍 Account isDeployed function:',
          typeof existingAccount.isDeployed,
        );
        console.log(
          '🔍 Account generateInitCode function:',
          typeof existingAccount.generateInitCode,
        );

        // Create kernel account client with the existing account
        const kernelClient = createKernelAccountClient({
          account: existingAccount,
          chain: base,
          bundlerTransport: http(zeroDevRpcUrl),
          middleware: {
            sponsorUserOperation: paymasterClient.sponsorUserOperation,
          },
        });

        console.log(
          '✅ Kernel account client created for existing wallet with paymaster',
        );

        // Execute the USDC transfer using the existing smart wallet
        const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const usdcAmount = BigInt(
          Math.floor(Number(oldWallet.usdcBalance) * 1000000),
        );

        console.log(
          '🔄 Executing sponsored USDC transfer from existing smart wallet...',
        );
        console.log('   Smart Wallet:', existingAccount.address);
        console.log('   USDC Contract:', USDC_ADDRESS);
        console.log('   Amount:', usdcAmount.toString());
        console.log('   To:', destinationAddress);

        // Execute the USDC transfer using the sponsored kernel client
        const usdcAbi = parseAbi([
          'function transfer(address to, uint256 amount) returns (bool)',
        ]);

        const txHash = await kernelClient.writeContract({
          address: USDC_ADDRESS as Address,
          abi: usdcAbi,
          functionName: 'transfer',
          args: [destinationAddress as Address, usdcAmount],
        });

        console.log('✅ Transaction submitted with ZeroDev paymaster!');
        console.log('📍 Transaction Hash:', txHash);

        toast.success(
          '🎉 Transaction submitted with gas sponsorship! Waiting for confirmation...',
        );

        // Success - mark as complete
        setIsExecuting(false);

        return txHash;
      }

      console.log(
        '✅ Address match confirmed - connected wallet owns the old smart wallet',
      );

      // Create kernel account client with paymaster for sponsored execution
      console.log(
        '🔧 Creating kernel account client with ZeroDev paymaster...',
      );
      console.log('🔍 Using bundler URL:', zeroDevRpcUrl);

      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: base,
        bundlerTransport: http(zeroDevRpcUrl),
        middleware: {
          sponsorUserOperation: paymasterClient.sponsorUserOperation,
        },
      });

      console.log(
        '✅ Kernel account client created with paymaster sponsorship',
      );

      // Now execute the USDC transfer using the sponsored kernel client
      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const usdcAmount = BigInt(
        Math.floor(Number(oldWallet.usdcBalance) * 1000000),
      );

      console.log('🔄 Executing sponsored USDC transfer...');
      console.log('   Smart Wallet:', kernelAccount.address);
      console.log('   USDC Contract:', USDC_ADDRESS);
      console.log('   Amount:', usdcAmount.toString());
      console.log('   To:', destinationAddress);

      // Execute the USDC transfer using the sponsored kernel client
      const usdcAbi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);

      const txHash = await kernelClient.writeContract({
        address: USDC_ADDRESS as Address,
        abi: usdcAbi,
        functionName: 'transfer',
        args: [destinationAddress as Address, usdcAmount],
      });

      console.log('✅ Transaction submitted with ZeroDev paymaster!');
      console.log('📍 Transaction Hash:', txHash);

      toast.success(
        '🎉 Transaction submitted with gas sponsorship! Waiting for confirmation...',
      );

      // Success - mark as complete
      setIsExecuting(false);

      return txHash;
    } catch (error) {
      console.error('❌ ZeroDev paymaster execution failed:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('execution reverted') ||
        errorMessage.includes('unauthorized')
      ) {
        console.warn('⚠️ Authorization failed - this might be due to:');
        console.warn(
          '   1. The connected wallet is not the original owner of the smart wallet',
        );
        console.warn('   2. The kernel version/configuration has changed');
        console.warn('   3. Session keys or permissions have been revoked');

        // Let's try the fallback approach - direct execution on the smart wallet
        console.log('🔄 Falling back to direct smart wallet execution...');
        throw new Error(
          `ZeroDev paymaster execution failed: ${errorMessage}. Try connecting the original wallet that created this smart wallet.`,
        );
      }

      throw error;
    }
  };

  return {
    executeMigrationTransaction,
    isExecuting: isExecuting || isContractPending || isConfirming,
    transactionHash: contractHash,
    isSuccess,
    error: contractError,
  };
}
