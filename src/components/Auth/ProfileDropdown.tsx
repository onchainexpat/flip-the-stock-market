'use client';
import { usePrivy } from '@privy-io/react-auth';
import {
  Copy,
  CreditCard,
  Download,
  LogOut,
  QrCode,
  Send,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { base } from 'viem/chains';
import { useAccount, useBalance } from 'wagmi';
import BuyUSDCModal from '../zkp2p/BuyUSDCModal';
import ReceiveModal from './ReceiveModal';

// Token addresses on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX6900_ADDRESS = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';

export default function ProfileDropdown() {
  const { ready, authenticated, user, logout, exportWallet, sendTransaction } =
    usePrivy();
  const { address: wagmiAddress } = useAccount();
  
  // Get wallet address from Privy user object or Wagmi
  const address = user?.wallet?.address || wagmiAddress;
  const [isOpen, setIsOpen] = useState(false);
  const [showBuyUSDC, setShowBuyUSDC] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get USDC balance from wallet
  const { data: usdcBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    token: USDC_ADDRESS,
    chainId: base.id,
  });
  
  // Get SPX6900 balance from wallet
  const { data: spxBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    token: SPX6900_ADDRESS,
    chainId: base.id,
  });

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


  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance: bigint | undefined, decimals = 6) => {
    if (!balance) return '0.00';
    const divisor = BigInt(10 ** decimals);
    const quotient = balance / divisor;
    const remainder = balance % divisor;
    const decimal = remainder.toString().padStart(decimals, '0').slice(0, 2);
    return `${quotient}.${decimal}`;
  };

  if (!ready || !authenticated || !user) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-[#1B2236] hover:bg-[#1B2236]/80 rounded-lg transition-colors"
      >
        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <span className="text-white text-sm max-w-[120px] truncate">
          {user.email?.address || user.phone?.number || 'User'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#1B2236] rounded-xl border border-white/10 shadow-xl z-50">
          {/* User Info Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              
              <div className="space-y-2">
                <div className="text-white font-medium text-lg">
                  {user.email?.address || user.phone?.number || 'User'}
                </div>
                
                {address && (
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-blue-400 text-base font-mono font-medium">
                      {formatAddress(address)}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(address);
                          console.log('Address copied to clipboard');
                          // You could add a toast notification here
                        } catch (error) {
                          console.error('Failed to copy address:', error);
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                      title="Copy address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {address && (
                  <div className="text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full inline-block">
                    Connected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Balances Section */}
          <div className="p-4 border-b border-white/10">
            <div className="space-y-4">
              {/* USDC Balance (Primary) */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">$</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">USDC</div>
                  <div className="text-2xl font-bold text-white">
                    {formatBalance(usdcBalance?.value)}
                  </div>
                </div>
              </div>

              {/* SPX6900 Balance */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">📈</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">SPX6900</div>
                  <div className="text-2xl font-bold text-white">
                    {formatBalance(spxBalance?.value, 8)}
                  </div>
                  {spxBalance && spxBalance.value > 0n && (
                    <div className="text-green-400 text-sm">
                      SPX Holder ✨
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 space-y-1">
            {/* Receive */}
            <button
              onClick={() => {
                console.log('Receive button clicked, address:', address);
                setIsOpen(false);
                
                if (address) {
                  setShowReceive(true);
                } else {
                  console.error('Address not available. User:', user?.wallet?.address, 'Wagmi:', wagmiAddress);
                  alert('❌ Wallet address not available. Please ensure your wallet is properly connected.');
                }
              }}
              className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <QrCode className="w-5 h-5" />
              <span>Receive</span>
            </button>

            {/* Send */}
            <button
              onClick={async () => {
                console.log('Send button clicked');
                setIsOpen(false);

                try {
                  // Open Privy's send transaction modal
                  // This is a basic example - you can customize with specific recipient/amount
                  await sendTransaction({
                    to: '', // Will open modal for user to enter recipient
                    value: '0', // Will open modal for user to enter amount
                  });
                } catch (error) {
                  console.error('Send transaction error:', error);
                  // Fallback: show simple form or message
                  alert(
                    'Send functionality: Please use the main trading interface for now',
                  );
                }
              }}
              className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>Send</span>
            </button>

            {/* Export Wallet */}
            <button
              onClick={async () => {
                console.log('Export wallet button clicked');
                setIsOpen(false);

                try {
                  // Use Privy's built-in export wallet modal
                  await exportWallet();
                } catch (error) {
                  console.error('Export wallet error:', error);
                  alert('Export wallet feature is temporarily unavailable');
                }
              }}
              className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>Export Wallet</span>
            </button>

            {/* DCA Dashboard */}
            <a
              href="/dca"
              className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="text-white">DCA Dashboard</div>
                <div className="text-gray-400 text-xs">
                  Manage auto-purchases
                </div>
              </div>
              <span className="text-blue-400 text-xs">Active</span>
            </a>

            {/* Buy USDC with zkp2p */}
            <button
              onClick={() => {
                console.log('Buy USDC button clicked');
                setShowBuyUSDC(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              <span>Buy USDC with Venmo</span>
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Buy USDC Modal */}
      <BuyUSDCModal
        isOpen={showBuyUSDC}
        onClose={() => setShowBuyUSDC(false)}
      />
      
      {/* Receive Modal */}
      <ReceiveModal
        isOpen={showReceive}
        onClose={() => setShowReceive(false)}
        address={address || ''}
      />
    </div>
  );
}
