'use client';
import '../../polyfills';
import { useState } from 'react';
import AutomatedDCAComponent from '../../components/DCA/AutomatedDCAComponent';
import Header from '../../components/SmartWallet/Header';

export default function AutomatedDCAPage() {
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
            Gelato Automated DCA
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Fully automated DCA powered by Gelato Network. Smart contract
            automation ensures reliable execution with multi-aggregator rate
            optimization.
          </p>
        </div>

        {/* Key Differences */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Gelato Automation Architecture
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Smart Contract */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <h3 className="text-blue-300 font-semibold mb-3">
                  🔗 Smart Contract
                </h3>
                <ul className="space-y-2 text-blue-200 text-sm">
                  <li>• Orders registered on-chain</li>
                  <li>• Gelato resolver checks readiness</li>
                  <li>• Decentralized automation</li>
                  <li>• Trustless execution</li>
                </ul>
              </div>

              {/* Multi-Aggregator */}
              <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
                <h3 className="text-purple-300 font-semibold mb-3">
                  🔄 Multi-Aggregator
                </h3>
                <ul className="space-y-2 text-purple-200 text-sm">
                  <li>• OpenOcean integration</li>
                  <li>• 1inch protocol support</li>
                  <li>• Paraswap comparison</li>
                  <li>• Best rate selection</li>
                </ul>
              </div>

              {/* Gelato Network */}
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <h3 className="text-green-300 font-semibold mb-3">
                  ⚡ Gelato Network
                </h3>
                <ul className="space-y-2 text-green-200 text-sm">
                  <li>• Automatic execution</li>
                  <li>• 24/7 monitoring</li>
                  <li>• Gas optimization</li>
                  <li>• Reliable infrastructure</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              title: 'Smart Contract Automation',
              description: 'Orders stored on-chain with Gelato execution',
              icon: '🔗',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              title: 'Multi-Aggregator Rates',
              description: 'Best rates from OpenOcean, 1inch, Paraswap',
              icon: '🔄',
              color: 'from-purple-500 to-pink-500',
            },
            {
              title: 'Gas-Free Execution',
              description: 'ZeroDev sponsors all transaction costs',
              icon: '⚡',
              color: 'from-yellow-500 to-orange-500',
            },
            {
              title: 'Gelato Reliability',
              description: 'Decentralized automation infrastructure',
              icon: '⚙️',
              color: 'from-green-500 to-emerald-500',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700 text-center"
            >
              <div
                className={`text-4xl mb-3 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* DCA Component */}
        <div className="max-w-2xl mx-auto mb-12">
          <AutomatedDCAComponent
            onOrderCreated={handleOrderCreated}
            className="w-full"
          />
        </div>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">
            How Gelato DCA Works
          </h2>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Setup & Registration
                </h3>
                <p className="text-gray-300 text-sm">
                  Create your DCA order with one-click setup. Order parameters
                  are registered in the Gelato automation smart contract at{' '}
                  <code className="text-blue-300">
                    0xcb3E5B789Ff429C54dc940c5e495F278e13eAC8d
                  </code>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Gelato Monitoring
                </h3>
                <p className="text-gray-300 text-sm">
                  Gelato Network calls the smart contract's{' '}
                  <code className="text-blue-300">checker()</code> function
                  every 5 minutes to identify orders ready for execution.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Multi-Aggregator Execution
                </h3>
                <p className="text-gray-300 text-sm">
                  When ready, Gelato triggers execution. Our system compares
                  rates across OpenOcean, 1inch, and Paraswap to find the best
                  price for your swap.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Gas-Free Delivery
                </h3>
                <p className="text-gray-300 text-sm">
                  ZeroDev smart wallet executes the swap with the best rate. SPX
                  tokens are delivered to your external wallet with all gas
                  costs sponsored.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <h4 className="text-blue-300 font-semibold mb-2">
              🔒 Security & Monitoring
            </h4>
            <ul className="space-y-1 text-blue-200 text-sm">
              <li>
                • Smart contract deployed at{' '}
                <code>0xcb3E5B789Ff429C54dc940c5e495F278e13eAC8d</code>
              </li>
              <li>
                • Gelato task executes every 5 minutes with reliability
                guarantees
              </li>
              <li>
                • Multi-aggregator ensures optimal pricing and reduces MEV
              </li>
              <li>
                • ZeroDev smart wallets provide gas sponsorship and security
              </li>
              <li>• Full on-chain audit trail via contract events</li>
              <li>
                • Monitor progress:{' '}
                <a
                  href="https://app.gelato.network"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Gelato Dashboard
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
