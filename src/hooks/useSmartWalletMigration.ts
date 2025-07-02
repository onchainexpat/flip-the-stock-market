'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import type { Address } from 'viem';
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

interface OldWallet {
  address: string;
  kernelVersion: string;
  usdcBalance: string;
  ethBalance: string;
  isDeployed: boolean;
}

export function useSmartWalletMigration() {
  const { address: externalWallet } = useAccount();
  const [isExecuting, setIsExecuting] = useState(false);

  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Execute migration by calling the USDC contract directly from the smart wallet
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
      console.log('🚀 Starting direct USDC transfer from smart wallet...');
      console.log(`📍 From: ${oldWallet.address} (${oldWallet.kernelVersion})`);
      console.log(`📍 To: ${destinationAddress}`);

      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const usdcAmount = BigInt(
        Math.floor(Number(oldWallet.usdcBalance) * 1000000),
      );

      console.log('💰 Transfer details:');
      console.log(
        `   USDC Amount: ${oldWallet.usdcBalance} USDC (${usdcAmount.toString()} wei)`,
      );
      console.log(`   From Smart Wallet: ${oldWallet.address}`);
      console.log(`   To: ${destinationAddress}`);

      // Execute via the smart wallet (the wallet that actually holds the USDC)
      await executeViaSmartWallet(oldWallet, destinationAddress);
    } catch (error) {
      console.error('❌ Smart wallet execution failed:', error);

      // Check if it's an authorization error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('1002') ||
        errorMessage.includes('execution reverted')
      ) {
        toast.error(
          '❌ Authorization failed. You may not be the owner of this smart wallet. Try manual Basescan approach.',
          { duration: 8000 },
        );
        console.log('💡 This could mean:');
        console.log(
          '   1. Your connected wallet is not the owner of the old smart wallet',
        );
        console.log('   2. The smart wallet requires different authorization');
        console.log('   3. Manual execution via Basescan may work better');
      } else {
        toast.error(`Migration failed: ${errorMessage}`);
      }

      setIsExecuting(false);
    }
  };

  /**
   * Fallback: Execute via smart wallet's execute function
   */
  const executeViaSmartWallet = async (
    oldWallet: OldWallet,
    destinationAddress: string,
  ) => {
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const usdcAmount = BigInt(
      Math.floor(Number(oldWallet.usdcBalance) * 1000000),
    );

    // ERC-20 transfer function calldata: transfer(address,uint256)
    const transferCalldata = `0xa9059cbb${destinationAddress.slice(2).padStart(64, '0')}${usdcAmount.toString(16).padStart(64, '0')}`;
    const packedCalldata = `0x${USDC_ADDRESS.slice(2).toLowerCase()}${'0'.repeat(64)}${transferCalldata.slice(2)}`;

    console.log('🔄 Trying smart wallet execution as fallback...');

    // Try executeFromExecutor first
    try {
      await writeContract({
        address: oldWallet.address as Address,
        abi: [
          {
            name: 'executeFromExecutor',
            type: 'function',
            stateMutability: 'payable',
            inputs: [
              { name: 'payableAmount', type: 'uint256' },
              { name: 'execMode', type: 'bytes32' },
              { name: 'executionCalldata', type: 'bytes' },
            ],
            outputs: [],
          },
        ],
        functionName: 'executeFromExecutor',
        args: [
          0n,
          '0x0100000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          packedCalldata as `0x${string}`,
        ],
      });

      toast.success('Smart wallet execution sent! Waiting for confirmation...');
    } catch (executorError) {
      // Try regular execute as final fallback
      await writeContract({
        address: oldWallet.address as Address,
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
          0n,
          '0x0100000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          packedCalldata as `0x${string}`,
        ],
      });

      toast.success('Smart wallet execution sent! Waiting for confirmation...');
    }
  };

  // Handle transaction success
  if (isSuccess && isExecuting) {
    console.log('✅ Migration transaction confirmed!');
    toast.success('🎉 Migration completed successfully!');
    setIsExecuting(false);
  }

  // Handle transaction error
  if (error && isExecuting) {
    console.error('❌ Transaction failed:', error);
    toast.error('Transaction failed. Check console for details.');
    setIsExecuting(false);
  }

  return {
    executeMigrationTransaction,
    isExecuting: isExecuting || isPending || isConfirming,
    transactionHash: hash,
    isSuccess,
    error,
  };
}
