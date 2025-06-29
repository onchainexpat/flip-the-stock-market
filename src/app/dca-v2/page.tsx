'use client';
import '../../polyfills';
import { usePrivy } from '@privy-io/react-auth';
import { Clock, Shield, TrendingUp, Zap } from 'lucide-react';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import DCADashboard from '../../components/DCA/DCADashboard';
import SimpleDCAv2 from '../../components/DCA/SimpleDCAv2';
import Header from '../../components/SmartWallet/Header';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';

export default function DCAv2Page() {
  const { ready, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();
  const { 
    isReady, 
    hasGasSponsorship, 
    walletType, 
    needsDeployment, 
    isLoading,
    deploySmartWallet,
    canCreateDCAOrders,
    isExternalWallet,
    error 
  } = useUnifiedSmartWallet();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOrderCreated = () => {
    // Trigger refresh of dashboard
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDeploySmartWallet = async () => {
    try {
      await deploySmartWallet();
      // Refresh trigger will be handled by the hook state update
    } catch (error) {
      console.error('Failed to deploy smart wallet:', error);
    }
  };

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: 'Gas-Free Transactions',
      description: 'All DCA transactions are sponsored - no gas fees required',
    },
    {
      icon: <Shield className="w-6 h-6 text-green-400" />,
      title: 'Smart Wallet Security',
      description:
        'ERC-4337 smart wallets with session keys for automated execution',
    },
    {
      icon: <Clock className="w-6 h-6 text-blue-400" />,
      title: 'Automated Execution',
      description:
        'Set it and forget it - your DCA orders execute automatically',
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-purple-400" />,
      title: 'Optimal Pricing',
      description: '0x API integration for best swap prices and low slippage',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="container mx-auto px-4 pt-6">
        <Header />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Smart DCA v2
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Dollar-cost average into SPX6900 with gas-free, automated
            transactions powered by smart wallets and session keys
          </p>

          {hasGasSponsorship && (
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
              <Zap size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-medium">
                Gas Sponsorship Active
              </span>
            </div>
          )}
        </div>

        {/* Smart Wallet Status */}
        {ready && authenticated && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Smart Wallet Status</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-red-300 text-sm">⚠️ {error}</p>
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-gray-400 text-sm">Wallet Type:</span>
                  <p className="text-white font-mono">
                    {walletType === 'zerodev_smart' && '🔗 ZeroDev Smart Wallet'}
                    {walletType === 'external_wallet' && '🔗 External Wallet'}
                    {walletType === 'coinbase_smart' && '📧 Coinbase Smart Wallet'}
                    {walletType === 'embedded_privy' && '📧 Privy Embedded Wallet'}
                    {!walletType && 'Not Connected'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Gas Sponsorship:</span>
                  <p className={`font-semibold ${hasGasSponsorship ? 'text-green-400' : 'text-red-400'}`}>
                    {hasGasSponsorship ? '✅ Enabled' : '❌ Disabled'}
                  </p>
                </div>
              </div>
              
              {isExternalWallet && needsDeployment && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
                  <h3 className="text-blue-300 font-semibold mb-2">🚀 Deploy Smart Wallet</h3>
                  <p className="text-blue-200 text-sm mb-3">
                    Deploy your ZeroDev smart wallet to enable gas-free DCA transactions.
                  </p>
                  <button
                    onClick={handleDeploySmartWallet}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {isLoading ? '⏳ Deploying...' : '🚀 Deploy Smart Wallet'}
                  </button>
                </div>
              )}
              
              {walletType === 'embedded_privy' && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                  <h3 className="text-yellow-300 font-semibold mb-2">⚠️ Limited Functionality</h3>
                  <p className="text-yellow-200 text-sm">
                    Privy embedded wallets currently have chain switching issues. For the best experience, 
                    connect an external wallet (MetaMask, Coinbase Wallet, etc.) to use ZeroDev smart wallets.
                  </p>
                </div>
              )}
              
              {canCreateDCAOrders && (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                  <p className="text-green-300 text-sm">
                    ✅ Ready for automated DCA trading with gas sponsorship!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                {feature.icon}
                <h3 className="text-lg font-semibold text-white">
                  {feature.title}
                </h3>
              </div>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* DCA Component */}
        <div className="max-w-md mx-auto mb-12">
          <SimpleDCAv2 onOrderCreated={handleOrderCreated} />
        </div>

        {/* DCA Dashboard */}
        {ready && authenticated && (
          <div className="max-w-6xl mx-auto">
            <DCADashboard refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* Info Section */}
        {ready && authenticated && (
          <div className="mt-12 bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
            <div className="space-y-4 text-gray-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    Create Session Key
                  </h3>
                  <p className="text-sm">
                    Generate a session key that allows automated DCA
                    transactions within your specified limits
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    Set DCA Parameters
                  </h3>
                  <p className="text-sm">
                    Choose your total amount, frequency, and duration for the
                    DCA strategy
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    Automated Execution
                  </h3>
                  <p className="text-sm">
                    Our engine executes your DCA orders automatically using 0x
                    API for optimal pricing
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
