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
            Simplified ZeroDev DCA
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Test the simplified ZeroDev DCA system based on working examples
            with KERNEL_V3_1, simple sudo policy, and built-in paymaster
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              title: 'KERNEL_V3_1',
              description:
                'Consistent kernel version following working examples',
              icon: '🔐',
            },
            {
              title: 'Built-in Paymaster',
              description:
                "ZeroDev's proven paymaster approach for gas sponsorship",
              icon: '⚡',
            },
            {
              title: 'Simple Sudo Policy',
              description:
                'toSudoPolicy({}) - simple and reliable like examples',
              icon: '🔗',
            },
            {
              title: 'Session Keys',
              description: 'Following 1-click-trading.ts pattern exactly',
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
              <h3 className="text-lg font-semibold text-white mb-3">
                🔧 Setup
              </h3>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li>1. Connect your wallet (Wagmi or Privy supported)</li>
                <li>2. Enter a demo private key (or click "Use Demo Key")</li>
                <li>3. Enter amount (start with 0.01 USDC for testing)</li>
                <li>4. Click "Start Simplified ZeroDev DCA"</li>
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                ⚡ Process
              </h3>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li>1. Smart wallet deployed using KERNEL_V3_1</li>
                <li>2. Session key created with simple sudo policy</li>
                <li>3. USDC approval (gas-free via built-in paymaster)</li>
                <li>4. USDC → SPX swap via OpenOcean (gas-free)</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <h4 className="text-blue-300 font-semibold mb-2">
              💡 Testing Notes
            </h4>
            <ul className="space-y-1 text-blue-200 text-sm">
              <li>
                • Smart wallet deployed using KERNEL_V3_1 (like working
                examples)
              </li>
              <li>
                • Session key created with simple sudo policy (toSudoPolicy({}))
              </li>
              <li>
                • All transactions sponsored by ZeroDev's built-in paymaster
              </li>
              <li>
                • Follows the exact patterns from 1-click-trading.ts example
              </li>
              <li>• Demo private key used for testing session key creation</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <h4 className="text-yellow-300 font-semibold mb-2">
              ⚠️ Test Environment
            </h4>
            <p className="text-yellow-200 text-sm">
              This is the simplified ZeroDev DCA implementation based on working
              examples. Use small amounts (0.01-0.1 USDC) for testing. The
              system uses KERNEL_V3_1 consistently, simple sudo policy, and
              ZeroDev's built-in paymaster for reliable operation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
