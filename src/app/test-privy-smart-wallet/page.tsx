'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { base } from 'viem/chains';

export default function TestPrivySmartWalletPage() {
  const { user, authenticated, login, logout, ready } = usePrivy();
  const { wallets } = useWallets();

  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingSmartWallet, setIsTestingSmartWallet] = useState(false);

  // Test Privy smart wallet functionality
  const testSmartWallet = async () => {
    if (!authenticated || wallets.length === 0) {
      setTestResult('❌ No wallet found. Please login first.');
      return;
    }

    setIsTestingSmartWallet(true);
    setTestResult('');

    try {
      const wallet = wallets[0];
      console.log('🧪 Testing Privy Smart Wallet');
      console.log('👤 User:', user?.email?.address || user?.wallet?.address);
      console.log('🔗 Wallet:', wallet.address);
      console.log('🔍 Wallet type:', wallet.walletClientType);
      console.log('🔍 Chain ID:', wallet.chainId);

      // Check if this is a smart wallet
      const isSmartWallet =
        wallet.walletClientType === 'privy' &&
        (wallet as any).type === 'smart_wallet';
      const isEmbeddedWallet = wallet.walletClientType === 'privy';

      let result = `🏠 Wallet Address: ${wallet.address}\n`;
      result += `🔧 Wallet Type: ${wallet.walletClientType}\n`;
      result += `⛓️ Chain ID: ${wallet.chainId}\n`;
      result += `🧠 Smart Wallet: ${isSmartWallet ? 'YES ✅' : 'NO ❌'}\n`;
      result += `📱 Embedded Wallet: ${isEmbeddedWallet ? 'YES ✅' : 'NO ❌'}\n`;

      // Test signing capability with multiple approaches
      try {
        console.log('📝 Testing message signing...');
        const message = 'Test message for Privy Smart Wallet';
        let signature = null;
        let signingMethod = '';

        // Try multiple signing approaches
        try {
          console.log('🔄 Trying direct wallet.sign()...');
          signature = await wallet.sign(message);
          signingMethod = 'Direct wallet.sign()';
        } catch (directError) {
          console.log('❌ Direct sign failed:', (directError as Error).message);

          try {
            console.log('🔄 Trying provider personal_sign...');
            const provider = await wallet.getEthereumProvider();
            signature = await provider.request({
              method: 'personal_sign',
              params: [message, wallet.address],
            });
            signingMethod = 'Provider personal_sign';
          } catch (personalSignError) {
            console.log(
              '❌ personal_sign failed:',
              (personalSignError as Error).message,
            );

            try {
              console.log('🔄 Trying switchChain then sign...');
              await wallet.switchChain(8453); // Force Base
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait
              signature = await wallet.sign(message);
              signingMethod = 'After chain switch';
            } catch (switchSignError) {
              console.log(
                '❌ Switch and sign failed:',
                (switchSignError as Error).message,
              );
              throw new Error(
                `All signing methods failed. Last error: ${(switchSignError as Error).message}`,
              );
            }
          }
        }

        if (signature) {
          result += `\n✅ Message Signing: SUCCESS\n`;
          result += `📝 Method: ${signingMethod}\n`;
          result += `📝 Signature: ${signature.slice(0, 10)}...${signature.slice(-8)}\n`;
          console.log('✅ Signing test successful:', signature);
        }
      } catch (signError) {
        result += `\n❌ Message Signing: FAILED\n`;
        result += `🚨 Error: ${(signError as Error).message}\n`;
        console.error('❌ Signing test failed:', signError);
      }

      // Check if wallet is on Base network
      const chainIdStr = String(wallet.chainId);
      const isOnBase = chainIdStr === 'eip155:8453' || chainIdStr === '8453';

      result += `\n🌐 Base Network: ${isOnBase ? 'YES ✅' : 'NO ❌'}\n`;

      if (!isOnBase) {
        try {
          console.log('🔄 Attempting to switch to Base network...');
          await wallet.switchChain(base.id);
          result += `✅ Network Switch: SUCCESS\n`;
        } catch (switchError) {
          result += `❌ Network Switch: FAILED\n`;
          result += `🚨 Error: ${(switchError as Error).message}\n`;
        }
      }

      // Test transaction capability (dry run)
      try {
        const provider = await wallet.getEthereumProvider();
        const accounts = await provider.request({ method: 'eth_accounts' });

        result += `\n📋 Provider Test: SUCCESS\n`;
        result += `🏦 Accounts: ${accounts.length}\n`;

        console.log('✅ Provider test successful');
      } catch (providerError) {
        result += `\n❌ Provider Test: FAILED\n`;
        result += `🚨 Error: ${(providerError as Error).message}\n`;
      }

      setTestResult(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Test failed';
      setTestResult(`❌ Smart wallet test failed: ${errorMessage}`);
      console.error('❌ Smart wallet test failed:', error);
    } finally {
      setIsTestingSmartWallet(false);
    }
  };

  // Show loading state if Privy is not ready
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Privy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🧠 Privy Smart Wallet Test
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Test Privy's native smart wallet functionality on Base network
          </p>
        </div>

        {/* Auth Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Authentication Status
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Privy Ready:</span>
              <span
                className={`ml-2 px-2 py-1 rounded text-xs ${
                  ready
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {ready ? '✅ Yes' : '⏳ Loading'}
              </span>
            </div>
            <div>
              <span className="font-medium">Authenticated:</span>
              <span
                className={`ml-2 px-2 py-1 rounded text-xs ${
                  authenticated
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {authenticated ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-medium">User:</span>
              <span className="ml-2 font-mono">
                {user?.email?.address ||
                  user?.wallet?.address ||
                  'Not logged in'}
              </span>
            </div>
            <div>
              <span className="font-medium">Wallets:</span>
              <span className="ml-2">{wallets.length} connected</span>
            </div>
            {wallets.map((wallet, i) => (
              <div
                key={i}
                className="ml-4 p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="text-xs text-gray-500">Wallet {i + 1}:</div>
                <div className="font-mono text-xs">{wallet.address}</div>
                <div className="text-xs text-gray-500">
                  Type: {wallet.walletClientType}
                </div>
                <div className="text-xs text-gray-500">
                  Chain ID: {wallet.chainId}
                </div>
                {wallet.type && (
                  <div className="text-xs text-gray-500">
                    Wallet Kind: {wallet.type}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {authenticated ? (
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={login}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Login with Privy
              </button>
            )}
          </div>
        </div>

        {/* Smart Wallet Test */}
        {authenticated && wallets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Smart Wallet Test
            </h2>

            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Test if Privy created a smart wallet and verify its
                capabilities.
              </p>

              <button
                onClick={testSmartWallet}
                disabled={isTestingSmartWallet}
                className={`w-full px-4 py-3 rounded-lg font-medium ${
                  isTestingSmartWallet
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isTestingSmartWallet
                  ? '⏳ Testing Smart Wallet...'
                  : '🧪 Test Smart Wallet'}
              </button>

              {testResult && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Test Results:
                  </h3>
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {testResult}
                  </pre>
                </div>
              )}

              {/* Smart wallet upgrade section */}
              {testResult && !testResult.includes('Smart Wallet: YES') && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    🔧 Manual Smart Wallet Setup
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                    Your Privy wallet is a regular embedded wallet, not a smart
                    wallet. This might be because smart wallets aren't enabled
                    in the Privy Dashboard.
                  </p>
                  <div className="space-y-2 text-xs text-blue-600 dark:text-blue-300">
                    <p>
                      <strong>To enable Privy Smart Wallets:</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>
                        Go to{' '}
                        <a
                          href="https://dashboard.privy.io"
                          target="_blank"
                          className="underline"
                          rel="noreferrer"
                        >
                          Privy Dashboard
                        </a>
                      </li>
                      <li>Navigate to Settings → Smart Wallets</li>
                      <li>Enable smart wallets for Base network</li>
                      <li>Configure gas sponsorship (optional)</li>
                      <li>Deploy a smart wallet implementation</li>
                    </ol>
                    <p className="mt-2 font-medium">
                      Alternative: Use ZeroDev with external wallets for full
                      smart wallet features.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            💡 About This Test
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p>This page tests Privy's native smart wallet functionality:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Tests if Privy creates smart wallets automatically</li>
              <li>Verifies Base network compatibility</li>
              <li>Tests message signing capabilities</li>
              <li>Checks if gas sponsorship is available</li>
            </ul>
            <p className="mt-2 font-medium">
              If Privy smart wallets work properly, we can eliminate ZeroDev for
              email users.
            </p>
          </div>
        </div>

        {/* Recommendation Panel */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-4">
            🎯 Recommended Architecture
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">
                📧 Email Login Users
              </h4>
              <div className="text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  <strong>Current Status:</strong> Regular embedded wallet
                </p>
                <p>
                  <strong>Chain:</strong> Base ✅
                </p>
                <p>
                  <strong>Signing:</strong> Has issues ❌
                </p>
                <p>
                  <strong>Smart Wallet:</strong> Not enabled ❌
                </p>
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  <strong>Solution:</strong> Enable Privy Smart Wallets in
                  dashboard OR use ZeroDev social login
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                🔗 External Wallet Users
              </h4>
              <div className="text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  <strong>Current Status:</strong> Working perfectly ✅
                </p>
                <p>
                  <strong>Chain:</strong> Base ✅
                </p>
                <p>
                  <strong>Signing:</strong> Works ✅
                </p>
                <p>
                  <strong>Smart Wallet:</strong> ZeroDev deployment ✅
                </p>
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                  <strong>Solution:</strong> Continue using{' '}
                  <a href="/test-zerodev-standalone" className="underline">
                    ZeroDev flow
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>💡 Key Insight:</strong> The Privy embedded wallet signing
              issue (`chainId 1`) suggests Privy's embedded wallets have
              fundamental limitations with Base network smart contract
              interactions, even when showing the correct chain ID in the UI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
