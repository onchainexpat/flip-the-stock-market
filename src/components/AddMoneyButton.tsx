'use client';
import {
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Plus,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';

interface AddMoneyButtonProps {
  className?: string;
  onFundingComplete?: () => void;
  walletAddress?: string;
  walletType?:
    | 'external_wallet'
    | 'zerodev_smart'
    | 'coinbase_smart'
    | 'embedded_privy'
    | null;
}

export default function AddMoneyButton({
  className = '',
  onFundingComplete,
  walletAddress,
  walletType,
}: AddMoneyButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const { address: fallbackAddress } = useAccount();

  // Use the provided wallet address (smart wallet) or fallback to wagmi address
  const fundingAddress = walletAddress || fallbackAddress;
  const isSmartWallet =
    walletType === 'zerodev_smart' || walletType === 'coinbase_smart';

  // Get wallet type display name
  const getWalletTypeDisplay = () => {
    switch (walletType) {
      case 'zerodev_smart':
        return 'ZeroDev Smart Wallet';
      case 'coinbase_smart':
        return 'Coinbase Smart Wallet';
      case 'external_wallet':
        return 'External Wallet';
      case 'embedded_privy':
        return 'Privy Wallet';
      default:
        return 'Smart Wallet';
    }
  };

  const fundingOptions = [
    {
      id: 'card',
      name: 'Debit Card',
      description: 'Add money instantly',
      icon: CreditCard,
      fee: 'Free',
      processingTime: 'Instant',
      popular: true,
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      description: 'No fees, takes 1-2 days',
      icon: Plus,
      fee: 'Free',
      processingTime: '1-2 business days',
      popular: false,
    },
    {
      id: 'external',
      name: 'External Wallet',
      description: 'Send USDC from another wallet',
      icon: Wallet,
      fee: 'Free',
      processingTime: 'Instant',
      popular: false,
    },
  ];

  const copyAddress = async () => {
    if (!fundingAddress) return;

    try {
      await navigator.clipboard.writeText(fundingAddress);
      setCopiedAddress(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      toast.error('Failed to copy address');
    }
  };

  const handleFundingMethod = (methodId: string) => {
    if (methodId === 'external') {
      // Don't close modal for external wallet - show address
      return;
    }

    // This would integrate with OnchainKit Fund components when available
    // For now, show a message about the funding process
    toast.success('Funding interface would open here');
    setIsOpen(false);
    if (onFundingComplete) {
      onFundingComplete();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`
          bg-gradient-to-r from-green-600 to-emerald-600 
          hover:from-green-700 hover:to-emerald-700 
          text-white font-semibold py-3 px-6 rounded-lg 
          flex items-center gap-2 transition-all duration-200
          shadow-lg hover:shadow-xl transform hover:scale-105
          ${className}
        `}
      >
        <Plus size={16} />
        <span>Add Money</span>
        <ArrowRight size={14} />
      </button>

      {/* Funding Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add Money</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {fundingOptions.map((option) => (
                <div key={option.id}>
                  <button
                    onClick={() => handleFundingMethod(option.id)}
                    className="w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-blue-500 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                        <option.icon size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {option.name}
                          </span>
                          {option.popular && (
                            <span className="px-2 py-1 bg-blue-600 text-xs text-white rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {option.description}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-green-400">
                            Fee: {option.fee}
                          </span>
                          <span className="text-xs text-gray-500">
                            {option.processingTime}
                          </span>
                        </div>
                      </div>
                      {option.id !== 'external' && (
                        <ArrowRight
                          size={16}
                          className="text-gray-400 group-hover:text-blue-400"
                        />
                      )}
                    </div>
                  </button>

                  {/* External Wallet Address Display */}
                  {option.id === 'external' && fundingAddress && (
                    <div className="mt-3 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">
                          Send USDC to:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-400">
                            Base Network
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              isSmartWallet
                                ? 'bg-green-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}
                          >
                            {getWalletTypeDisplay()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg border border-gray-600">
                        <code className="flex-1 text-sm text-gray-300 font-mono break-all">
                          {fundingAddress}
                        </code>
                        <button
                          onClick={copyAddress}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center"
                          title="Copy address"
                        >
                          {copiedAddress ? (
                            <Check size={16} className="text-white" />
                          ) : (
                            <Copy size={16} className="text-white" />
                          )}
                        </button>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-yellow-400">
                          <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                          <span>Only send USDC on Base Network</span>
                        </div>

                        {isSmartWallet ? (
                          <>
                            <div className="flex items-center gap-2 text-xs text-green-400">
                              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                              <span>
                                Funds will be available for automated DCA
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-blue-400">
                              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                              <span>Gas-free transactions enabled</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-2 text-xs text-orange-400 bg-orange-900/20 p-2 rounded">
                            <span className="w-2 h-2 bg-orange-400 rounded-full mt-1 flex-shrink-0"></span>
                            <span>
                              ⚠️ For automated DCA, deploy your smart wallet
                              first. External wallet funds require manual
                              management.
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-blue-400">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          <span>Minimum transfer: $1 USDC</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300">
                💡 Your money is converted to USD for investing. All
                transactions are secure and protected.
              </p>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
