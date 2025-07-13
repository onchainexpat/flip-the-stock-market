'use client';
import '../../polyfills';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import ZeroDevDCAComponent from '../../components/DCA/ZeroDevDCAComponent';
import Header from '../../components/SmartWallet/Header';

export default function ZeroDevDCAPage() {
  const { isConnected } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOrderCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

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
            ZeroDev DCA
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Test the new agent-created smart wallet DCA system with KERNEL_V3_2 
            and chain abstraction support
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              title: 'Agent-Created Keys',
              description: 'Secure key generation where private keys never leave the agent',
              icon: '🔐',
            },
            {
              title: 'Gas Sponsorship',
              description: 'All transactions sponsored by ZeroDev paymaster',
              icon: '⚡',
            },
            {
              title: 'KERNEL_V3_2',
              description: 'Latest smart wallet with chain abstraction support',
              icon: '🔗',
            },
            {
              title: '3-Step Process',
              description: 'Approve → Swap → Transfer for reliable execution',
              icon: '🔄',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700 text-center"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* DCA Component */}
        <div className="max-w-md mx-auto mb-12">
          <ZeroDevDCAComponent onOrderCreated={handleOrderCreated} />
        </div>

        {/* Instructions */}
        <div className="max-w-4xl mx-auto bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">How to Test</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">🔧 Setup</h3>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li>1. Connect your wallet (external wallet recommended)</li>
                <li>2. Enter a secure password for agent key encryption</li>
                <li>3. Enter amount (start with 0.01 USDC for testing)</li>
                <li>4. Click "Execute DCA Swap"</li>
              </ol>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">⚡ Process</h3>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li>1. Smart wallet created with agent-generated key</li>
                <li>2. USDC approval transaction (gas-free)</li>
                <li>3. USDC → SPX swap via OpenOcean (gas-free)</li>
                <li>4. SPX transferred to your wallet (gas-free)</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <h4 className="text-blue-300 font-semibold mb-2">💡 Testing Notes</h4>
            <ul className="space-y-1 text-blue-200 text-sm">
              <li>• Your smart wallet address will be generated deterministically</li>
              <li>• Agent private key is encrypted and stored locally</li>
              <li>• All transactions are sponsored by ZeroDev paymaster</li>
              <li>• SPX tokens are delivered directly to your connected wallet</li>
              <li>• You can fund the smart wallet from your external wallet</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <h4 className="text-yellow-300 font-semibold mb-2">⚠️ Test Environment</h4>
            <p className="text-yellow-200 text-sm">
              This is a test implementation of the production-ready ZeroDev DCA service. 
              Use small amounts (0.01-0.1 USDC) for testing. The system supports KERNEL_V3_2 
              with chain abstraction and maintains full compatibility with the existing DCA infrastructure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}