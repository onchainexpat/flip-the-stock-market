'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import {
  ArrowUpRight,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  LogOut,
  QrCode,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { erc20Abi } from 'viem';
import { useReadContracts } from 'wagmi';
import { useSmartWallet } from '../../hooks/useSmartWallet';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';
import { TOKENS, formatTokenAmount } from '../../utils/dexApi';
import ReceiveModal from './ReceiveModal';
import SweepFundsModal from './SweepFundsModal';

interface UserProfileProps {
  className?: string;
}

export default function UserProfile({ className = '' }: UserProfileProps) {
  const { ready, authenticated, user, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const { address, hasGasSponsorship } = useSmartWallet();
  const {
    activeWallet,
    sendBatchTransactions,
    address: smartWalletAddress,
    canCreateDCAOrders,
  } = useUnifiedSmartWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get external wallet address
  const externalWalletAddress = activeWallet?.address;

  // Fetch token balances
  const { data: balanceData, refetch: refetchBalances } = useReadContracts({
    contracts: [
      {
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 8453, // Base chain
      },
      {
        address: TOKENS.SPX6900,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 8453, // Base chain
      },
    ],
    query: {
      enabled: !!address && authenticated,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  const usdcBalance = balanceData?.[0]?.result
    ? balanceData[0].result.toString()
    : '0';
  const spxBalance = balanceData?.[1]?.result
    ? balanceData[1].result.toString()
    : '0';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!ready || !authenticated || !user) {
    return null;
  }

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  };

  const handleOpenExplorer = () => {
    if (address) {
      window.open(`https://basescan.org/address/${address}`, '_blank');
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Find embedded wallet for export
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );

  const handleExportWallet = async () => {
    try {
      if (!embeddedWallet) {
        toast.error('No embedded wallet found to export');
        return;
      }

      // Show security warning before export
      const confirmed = window.confirm(
        'SECURITY WARNING: This will reveal your private key. Only export if you understand the security implications and need to backup your wallet. Never share your private key with anyone.',
      );

      if (!confirmed) {
        return;
      }

      // Use Privy's exportWallet function
      await exportWallet();
      toast.success('Wallet export initiated - keep your private key secure!');
    } catch (error) {
      console.error('Failed to export wallet:', error);
      toast.error('Failed to export wallet. Please try again.');
    }
  };

  const handleReceiveClick = () => {
    setIsReceiveModalOpen(true);
    setIsOpen(false); // Close dropdown when opening modal
  };

  const handleSweepClick = () => {
    setIsSweepModalOpen(true);
    setIsOpen(false); // Close dropdown when opening modal
  };

  const displayName = user.email?.address || user.phone?.number || 'User';
  const gasSponsored = hasGasSponsorship();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          bg-gradient-to-r from-gray-800 to-gray-900 
          hover:from-gray-700 hover:to-gray-800 
          text-white rounded-lg p-3 
          flex items-center gap-3 transition-all duration-200
          shadow-lg hover:shadow-xl border border-gray-600
        "
      >
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <Wallet size={16} className="text-white" />
        </div>

        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayName}</span>
            {gasSponsored && (
              <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                <Zap size={12} className="text-yellow-400" />
                <span className="text-xs text-yellow-400">Gas Free</span>
              </div>
            )}
          </div>
          {address && (
            <span className="text-xs text-gray-400 font-mono">
              {truncateAddress(address)}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div
          className="
          absolute top-full right-0 mt-2 w-72 
          bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50
          overflow-hidden
        "
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Wallet size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-medium">{displayName}</p>
                <p className="text-gray-400 text-sm">Smart Wallet</p>
              </div>
            </div>

            {address && (
              <div className="mt-3 p-2 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-mono text-sm">
                    {truncateAddress(address)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={handleCopyAddress}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Copy address"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={handleOpenExplorer}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="View on explorer"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gasSponsored && (
              <div className="mt-2 flex items-center gap-2 text-yellow-400 text-sm">
                <Zap size={14} />
                <span>All transactions are sponsored (gas-free)</span>
              </div>
            )}

            {/* Token Balances */}
            <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm font-medium">
                  Balances
                </span>
                <button
                  onClick={() => refetchBalances()}
                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Refresh balances"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-green-400" />
                    <span className="text-gray-300 text-sm">USDC</span>
                  </div>
                  <span className="text-white font-medium text-sm">
                    {formatTokenAmount(usdcBalance, 6)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-purple-400" />
                    <span className="text-gray-300 text-sm">SPX6900</span>
                  </div>
                  <span className="text-white font-medium text-sm">
                    {formatTokenAmount(spxBalance, 8)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={handleReceiveClick}
              className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
            >
              <QrCode size={16} />
              <span>Receive</span>
            </button>

            <button className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 text-gray-300 hover:text-white transition-colors">
              <CreditCard size={16} />
              <span>Buy Crypto</span>
            </button>

            {/* Sweep Funds Button */}
            {externalWalletAddress && smartWalletAddress && (
              <button
                onClick={handleSweepClick}
                className="w-full px-4 py-3 text-left hover:bg-blue-900/20 flex items-center gap-3 transition-colors text-blue-400 hover:text-blue-300"
              >
                <ArrowUpRight size={16} />
                <span>Sweep Funds</span>
                <span className="text-xs text-gray-400 ml-auto">
                  to main wallet
                </span>
              </button>
            )}

            {embeddedWallet && (
              <button
                onClick={handleExportWallet}
                className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
              >
                <Download size={16} />
                <span>Export Wallet</span>
              </button>
            )}

            <button className="w-full px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 text-gray-300 hover:text-white transition-colors">
              <Settings size={16} />
              <span>Settings</span>
            </button>

            <hr className="my-2 border-gray-700" />

            <button
              onClick={logout}
              className="w-full px-4 py-3 text-left hover:bg-red-900/20 flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {address && (
        <ReceiveModal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          address={address}
          displayName={displayName}
        />
      )}

      {/* Sweep Funds Modal */}
      {smartWalletAddress && externalWalletAddress && (
        <SweepFundsModal
          isOpen={isSweepModalOpen}
          onClose={() => setIsSweepModalOpen(false)}
          smartWalletAddress={smartWalletAddress}
          externalWalletAddress={externalWalletAddress}
        />
      )}
    </div>
  );
}
