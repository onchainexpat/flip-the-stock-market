'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import { useSmartWalletDeployment } from '../../hooks/useSmartWalletDeployment';

export default function SmartWalletDeployer() {
  const [testAddress, setTestAddress] = useState(
    '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  );
  const [testValue, setTestValue] = useState('0.001');

  const {
    account,
    client,
    isDeployed,
    isDeploying,
    deploymentTxHash,
    error,
    deploySmartWallet,
    sendSponsoredTransaction,
    canDeploy,
    reset,
    smartWalletAddress,
    userWalletAddress,
  } = useSmartWalletDeployment();

  const handleDeploy = async () => {
    console.log('🔥 User clicked deploy button');
    const result = await deploySmartWallet();

    if (result) {
      console.log('🎊 Deployment successful!');
      console.log('Result:', result);
    } else {
      console.log('💥 Deployment failed');
    }
  };

  const handleSendTransaction = async () => {
    if (!testAddress) {
      console.error('❌ No test address provided');
      return;
    }

    console.log('🔥 User clicked send transaction button');
    const txHash = await sendSponsoredTransaction(
      testAddress as `0x${string}`,
      parseEther(testValue),
    );

    if (txHash) {
      console.log('🎊 Transaction successful:', txHash);
    } else {
      console.log('💥 Transaction failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        🔧 ZeroDev Smart Wallet Deployer
      </h2>

      {/* User Info */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          User Info
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              User Wallet:
            </span>
            <span className="ml-2 font-mono text-gray-900 dark:text-white">
              {userWalletAddress || 'Not connected'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Smart Wallet:
            </span>
            <span className="ml-2 font-mono text-gray-900 dark:text-white">
              {smartWalletAddress || 'Not deployed'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Status:
            </span>
            <span
              className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                isDeployed
                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                  : isDeploying
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
              }`}
            >
              {isDeployed
                ? '✅ Deployed'
                : isDeploying
                  ? '⏳ Deploying...'
                  : '❌ Not Deployed'}
            </span>
          </div>
        </div>
      </div>

      {/* Deployment Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Smart Wallet Deployment
        </h3>

        {!isDeployed && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Deploy a ZeroDev Kernel smart wallet with gas sponsorship. The
              deployment will be free for the user!
            </p>

            <button
              onClick={handleDeploy}
              disabled={!canDeploy}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                canDeploy && !isDeploying
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {isDeploying
                ? '⏳ Deploying Smart Wallet...'
                : '🚀 Deploy Smart Wallet (Gas Sponsored!)'}
            </button>
          </div>
        )}

        {isDeployed && deploymentTxHash && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center mb-2">
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✅ Smart Wallet Deployed!
              </span>
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">
              <div>
                Address: <span className="font-mono">{smartWalletAddress}</span>
              </div>
              <div>
                Tx Hash: <span className="font-mono">{deploymentTxHash}</span>
              </div>
              <div className="mt-2 font-medium">
                💰 Gas was sponsored - user paid $0!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Transaction Section */}
      {isDeployed && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Test Sponsored Transaction
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ETH Amount
              </label>
              <input
                type="text"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="0.001"
              />
            </div>

            <button
              onClick={handleSendTransaction}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              💰 Send Sponsored Transaction
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-red-600 dark:text-red-400 font-medium">
              ❌ Error
            </span>
          </div>
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Reset Button */}
      {(isDeployed || error) && (
        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          🔄 Reset
        </button>
      )}

      {/* Console Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          📋 Console Instructions
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Open your browser's developer console (F12) to see detailed logs of
          the smart wallet deployment and transaction processes. All operations
          are logged with emojis for easy identification.
        </p>
      </div>
    </div>
  );
}
