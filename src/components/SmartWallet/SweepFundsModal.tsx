'use client';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { erc20Abi } from 'viem';
import { useReadContracts } from 'wagmi';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';
import { TOKENS, formatTokenAmount } from '../../utils/dexApi';

interface SweepFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartWalletAddress: string;
  externalWalletAddress: string;
}

export default function SweepFundsModal({
  isOpen,
  onClose,
  smartWalletAddress,
  externalWalletAddress,
}: SweepFundsModalProps) {
  const { sendBatchTransactions } = useUnifiedSmartWallet();
  const [isSweeping, setIsSweeping] = useState(false);

  // Fetch smart wallet token balances
  const { data: smartWalletBalanceData, refetch: refetchSmartWalletBalances } =
    useReadContracts({
      contracts: [
        {
          address: TOKENS.USDC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [smartWalletAddress as `0x${string}`],
          chainId: 8453,
        },
        {
          address: TOKENS.SPX6900,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [smartWalletAddress as `0x${string}`],
          chainId: 8453,
        },
      ],
      query: {
        enabled: !!smartWalletAddress && isOpen,
        refetchInterval: 30000,
      },
    });

  // Fetch external wallet token balances
  const { data: externalWalletBalanceData } = useReadContracts({
    contracts: [
      {
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [externalWalletAddress as `0x${string}`],
        chainId: 8453,
      },
      {
        address: TOKENS.SPX6900,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [externalWalletAddress as `0x${string}`],
        chainId: 8453,
      },
    ],
    query: {
      enabled: !!externalWalletAddress && isOpen,
      refetchInterval: 30000,
    },
  });

  const smartWalletUsdcBalance =
    smartWalletBalanceData?.[0]?.result?.toString() || '0';
  const smartWalletSpxBalance =
    smartWalletBalanceData?.[1]?.result?.toString() || '0';

  const externalWalletUsdcBalance =
    externalWalletBalanceData?.[0]?.result?.toString() || '0';
  const externalWalletSpxBalance =
    externalWalletBalanceData?.[1]?.result?.toString() || '0';

  // Calculate new balances after sweep
  const newExternalUsdcBalance = (
    BigInt(externalWalletUsdcBalance) + BigInt(smartWalletUsdcBalance)
  ).toString();
  const newExternalSpxBalance = (
    BigInt(externalWalletSpxBalance) + BigInt(smartWalletSpxBalance)
  ).toString();

  const hasTokensToSweep =
    smartWalletUsdcBalance !== '0' || smartWalletSpxBalance !== '0';

  const handleSweepFunds = async () => {
    if (!hasTokensToSweep) {
      toast.error('No tokens to sweep from smart wallet');
      return;
    }

    setIsSweeping(true);

    try {
      const transactions = [];

      // Add USDC transfer if balance > 0
      if (smartWalletUsdcBalance !== '0') {
        transactions.push({
          to: TOKENS.USDC,
          data: `0xa9059cbb${externalWalletAddress.slice(2).padStart(64, '0')}${BigInt(smartWalletUsdcBalance).toString(16).padStart(64, '0')}` as `0x${string}`,
          value: BigInt(0),
          executeFrom: 'smart_wallet' as const,
          description: `Transfer ${formatTokenAmount(smartWalletUsdcBalance, 6)} USDC to external wallet`,
        });
      }

      // Add SPX6900 transfer if balance > 0
      if (smartWalletSpxBalance !== '0') {
        transactions.push({
          to: TOKENS.SPX6900,
          data: `0xa9059cbb${externalWalletAddress.slice(2).padStart(64, '0')}${BigInt(smartWalletSpxBalance).toString(16).padStart(64, '0')}` as `0x${string}`,
          value: BigInt(0),
          executeFrom: 'smart_wallet' as const,
          description: `Transfer ${formatTokenAmount(smartWalletSpxBalance, 8)} SPX6900 to external wallet`,
        });
      }

      if (transactions.length === 0) {
        toast.error('No tokens to transfer');
        return;
      }

      console.log('=== SWEEP TRANSACTION DEBUG ===');
      console.log('Transactions to execute:', transactions);
      console.log('Smart wallet USDC balance:', smartWalletUsdcBalance);
      console.log('Smart wallet SPX balance:', smartWalletSpxBalance);
      console.log('External wallet address:', externalWalletAddress);
      console.log('=== END DEBUG ===');

      toast.loading('Sweeping funds to external wallet...', { duration: 3000 });

      // Execute batch transaction
      const txHashes = await sendBatchTransactions(transactions);
      console.log('Sweep transactions:', txHashes);

      toast.success(
        `✅ Funds swept successfully! ${transactions.length} token${transactions.length > 1 ? 's' : ''} transferred to your external wallet.`,
        { duration: 6000 },
      );

      // Refresh balances after successful sweep
      setTimeout(() => {
        refetchSmartWalletBalances();
      }, 2000);

      // Close modal after success
      onClose();
    } catch (error) {
      console.error('Failed to sweep funds:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to sweep funds. Please try again.',
      );
    } finally {
      setIsSweeping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <ArrowUpRight size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Sweep Funds</h2>
              <p className="text-sm text-gray-400">
                Transfer all tokens to your main wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Smart Wallet Balances */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Smart Wallet (Current)
            </h3>
            <div className="space-y-3 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">$</span>
                  </div>
                  <span className="text-gray-300">USDC</span>
                </div>
                <span className="text-white font-medium">
                  {formatTokenAmount(smartWalletUsdcBalance, 6)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">S</span>
                  </div>
                  <span className="text-gray-300">SPX6900</span>
                </div>
                <span className="text-white font-medium">
                  {formatTokenAmount(smartWalletSpxBalance, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* Arrow Indicator */}
          <div className="flex justify-center">
            <div className="bg-blue-500/20 rounded-full p-3">
              <ArrowRight size={24} className="text-blue-400" />
            </div>
          </div>

          {/* External Wallet Balances (After Sweep) */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Main Wallet (After Sweep)
            </h3>
            <div className="space-y-3 bg-green-900/20 rounded-lg p-4 border border-green-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">$</span>
                  </div>
                  <span className="text-gray-300">USDC</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">
                    {formatTokenAmount(externalWalletUsdcBalance, 6)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-400 font-medium">
                    {formatTokenAmount(newExternalUsdcBalance, 6)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">S</span>
                  </div>
                  <span className="text-gray-300">SPX6900</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">
                    {formatTokenAmount(externalWalletSpxBalance, 8)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-400 font-medium">
                    {formatTokenAmount(newExternalSpxBalance, 8)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!hasTokensToSweep && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm text-center">
                No tokens available to sweep from your smart wallet
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSweepFunds}
            disabled={!hasTokensToSweep || isSweeping}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              hasTokensToSweep && !isSweeping
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSweeping ? 'Sweeping...' : 'Sweep Funds'}
          </button>
        </div>
      </div>
    </div>
  );
}
