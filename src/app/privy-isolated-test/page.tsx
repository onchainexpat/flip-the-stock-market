'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

// Enhanced Privy Test Component (uses existing providers from layout)
export default function PrivyCleanTestPage() {
  const { user, authenticated, login, logout, ready, connectWallet } =
    usePrivy();
  const { wallets } = useWallets();

  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Add debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDebugLogs((prev) => [...prev.slice(-9), logEntry]); // Keep last 10 logs
  };

  // Log state changes
  useEffect(() => {
    addDebugLog(`Privy ready state changed: ${ready}`);
  }, [ready]);

  useEffect(() => {
    addDebugLog(`Authentication state changed: ${authenticated}`);
  }, [authenticated]);

  useEffect(() => {
    addDebugLog(`Wallets count changed: ${wallets.length}`);
  }, [wallets.length]);

  useEffect(() => {
    addDebugLog(`User state changed: ${user ? 'User present' : 'No user'}`);
  }, [user]);

  // Clear connecting state when wallets are successfully connected
  useEffect(() => {
    if (isConnectingWallet && wallets.length > 0) {
      addDebugLog(
        '✅ Wallet connected successfully, clearing connecting state',
      );
      setIsConnectingWallet(false);
      setError(null);
    }
  }, [wallets.length, isConnectingWallet]);

  // Handle wallet connection with proper error handling
  const handleConnectWallet = async () => {
    const attemptNumber = connectionAttempts + 1;
    setConnectionAttempts(attemptNumber);
    setIsConnectingWallet(true);
    setError(null);

    addDebugLog(`🔄 Wallet connection attempt #${attemptNumber} started`);

    // Set a timeout to clear connecting state if it gets stuck
    const timeoutId = setTimeout(() => {
      addDebugLog('⚠️ Wallet connection timeout - clearing connecting state');
      setIsConnectingWallet(false);
      setError(
        `Connection attempt #${attemptNumber} timed out. Please try again.`,
      );
    }, 15000); // 15 second timeout

    try {
      addDebugLog('🔗 Calling Privy connectWallet...');
      await connectWallet();
      addDebugLog('✅ Privy connectWallet call completed');
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      addDebugLog(`❌ Wallet connection failed: ${errorMessage}`);
      setError(`Connection attempt #${attemptNumber} failed: ${errorMessage}`);
      setIsConnectingWallet(false);
    }
  };

  // Force page refresh to clear stuck states
  const handleRefresh = () => {
    addDebugLog('🔄 Refreshing page to clear all states');
    window.location.reload();
  };

  // Reset all states
  const handleReset = () => {
    addDebugLog('🔄 Resetting all states');
    setIsConnectingWallet(false);
    setError(null);
    setConnectionAttempts(0);
    setDebugLogs([]);
  };

  // Diagnostic function to check Privy state
  const runDiagnostics = () => {
    addDebugLog('🔍 Running diagnostics...');
    addDebugLog(`Privy ready: ${ready}`);
    addDebugLog(`Authenticated: ${authenticated}`);
    addDebugLog(
      `User: ${user ? JSON.stringify({ email: user.email?.address, wallet: user.wallet?.address }) : 'null'}`,
    );
    addDebugLog(`Wallets: ${wallets.length} connected`);
    addDebugLog(
      `Connection state: ${isConnectingWallet ? 'connecting' : 'idle'}`,
    );

    // Check if stuck in authentication
    if (ready && !authenticated && user) {
      addDebugLog('⚠️ ISSUE: Ready but not authenticated with user present');
    }

    // Check if stuck after login
    if (ready && authenticated && !user) {
      addDebugLog('⚠️ ISSUE: Authenticated but no user object');
    }
  };

  // Show loading state if Privy is not ready
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Loading Privy...
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header with controls */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                🧪 Enhanced Privy Test
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Clean Privy test with enhanced error handling (uses existing
                provider hierarchy)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runDiagnostics}
                className="px-3 py-1 bg-blue-200 dark:bg-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-300 dark:hover:bg-blue-600 text-sm"
                title="Run diagnostics"
              >
                🔍 Diagnose
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1 bg-yellow-200 dark:bg-yellow-700 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-600 text-sm"
                title="Reset all states"
              >
                🔄 Reset
              </button>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                title="Refresh page to clear stuck states"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
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
              <span className="ml-2 font-mono text-xs">
                {user?.email?.address ||
                  user?.wallet?.address ||
                  'Not logged in'}
              </span>
            </div>
            <div>
              <span className="font-medium">Connected Wallets:</span>
              <span className="ml-2">{wallets.length}</span>
            </div>
            <div>
              <span className="font-medium">Connection Attempts:</span>
              <span className="ml-2">{connectionAttempts}</span>
            </div>
            <div>
              <span className="font-medium">Connecting State:</span>
              <span
                className={`ml-2 px-2 py-1 rounded text-xs ${
                  isConnectingWallet
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {isConnectingWallet ? '⏳ Connecting...' : '✅ Not Connecting'}
              </span>
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
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {authenticated ? (
              <>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Logout
                </button>
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnectingWallet}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isConnectingWallet
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isConnectingWallet
                    ? '⏳ Connecting...'
                    : 'Connect External Wallet'}
                </button>
              </>
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

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">
              ❌ Error
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            >
              Clear Error
            </button>
          </div>
        )}

        {/* Debug Panel */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
            🐛 Debug Information
          </h3>
          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <div>Environment: Enhanced Privy with existing providers</div>
            <div>Page Load Time: {new Date().toLocaleTimeString()}</div>
            <div>Browser: {navigator.userAgent.split(' ')[0]}</div>
            <div>
              Provider Stack: Privy → Wagmi → QueryClient → OnchainKit →
              RainbowKit
            </div>
          </div>

          {/* Real-time Debug Logs */}
          <div className="mt-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
              📝 Real-time Logs:
            </h4>
            <div className="bg-yellow-100 dark:bg-yellow-800/20 rounded p-2 max-h-48 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 italic">
                  No logs yet...
                </div>
              ) : (
                <div className="text-xs font-mono space-y-1">
                  {debugLogs.map((log, i) => (
                    <div
                      key={i}
                      className="text-yellow-700 dark:text-yellow-300"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
            <p className="font-medium mb-1">Troubleshooting steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Uses existing provider hierarchy (no duplicate providers)</li>
              <li>Enhanced connection timeout and error handling</li>
              <li>Connection timeout is set to 15 seconds</li>
              <li>Check browser console for detailed connection logs</li>
              <li>Try different wallet types (MetaMask, Rainbow, etc.)</li>
              <li>Make sure wallet extension is unlocked</li>
              <li>Use Reset button to clear states without page refresh</li>
            </ol>
          </div>
        </div>

        {/* Console Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            📋 Console Instructions
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Open your browser's developer console (F12) to see detailed logs of
            the Privy connection process. This enhanced test uses improved error
            handling while maintaining the existing provider stack.
          </p>
        </div>
      </div>
    </div>
  );
}
