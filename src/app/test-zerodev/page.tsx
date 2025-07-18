'use client';

import ZeroDevDCAComponent from '../../components/DCA/ZeroDevDCAComponent';

export default function TestZeroDevPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              🧪 ZeroDev Smart Wallet Test
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Test the ZeroDev Kernel smart wallet deployment with gas
              sponsorship. This demonstrates how users can deploy and use smart
              wallets without paying gas fees.
            </p>
          </div>

          {/* SmartWalletDeployer temporarily disabled */}

          {/* Simplified ZeroDev DCA Component */}
          <div className="mt-8">
            <ZeroDevDCAComponent />
          </div>

          <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              📝 Integration Details
            </h2>
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ZeroDev Project ID:
                </span>
                <span className="ml-2 font-mono">
                  485df233-2a0d-4aee-b94a-b266be42ea55
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Network:
                </span>
                <span className="ml-2">Base (Chain ID: 8453)</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  RPC Endpoint:
                </span>
                <span className="ml-2 font-mono break-all">
                  https://rpc.zerodev.app/api/v3/485df233-2a0d-4aee-b94a-b266be42ea55/chain/8453
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Features:
                </span>
                <ul className="ml-6 mt-2 list-disc">
                  <li>Gas sponsorship via ZeroDev paymaster</li>
                  <li>Kernel v3 smart accounts</li>
                  <li>ECDSA validator for signature verification</li>
                  <li>EIP-7702 support for EOA upgrades</li>
                  <li>No dependency on Coinbase infrastructure</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
