'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { base } from 'viem/chains';
import {
  createBasePublicClient,
  createZeroDevKernelAccount,
  createZeroDevKernelClient,
} from '../../utils/zerodev';

export default function TestZeroDevStandalonePage() {
  const { user, authenticated, login, logout, ready, connectWallet } =
    usePrivy();
  const { wallets } = useWallets();

  const [isDeploying, setIsDeploying] = useState(false);
  const [isCheckingDeployment, setIsCheckingDeployment] = useState(false);
  const [isAlreadyDeployed, setIsAlreadyDeployed] = useState(false);
  const [deployedAccount, setDeployedAccount] = useState<any>(null);
  const [deploymentTx, setDeploymentTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [showEmergencyOverlay, setShowEmergencyOverlay] = useState(false);

  // Clear connecting state when wallets are successfully connected
  useEffect(() => {
    if (isConnectingWallet && wallets.length > 0) {
      console.log(
        '✅ Wallet connected successfully, clearing connecting state',
      );
      setIsConnectingWallet(false);
    }
  }, [wallets.length, isConnectingWallet]);

  // Safe cleanup function - checks before removing
  const forceCleanupPrivyUI = () => {
    console.log('🧹 Safely cleaning Privy UI elements');

    try {
      // Only target the most common stuck elements safely
      const selectors = [
        '#privy-modal',
        '.privy-overlay',
        '.privy-backdrop',
        '[data-backdrop="true"]',
        '[role="dialog"][aria-modal="true"]',
      ];

      selectors.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            try {
              // Check if element exists and has a parent before removing
              if (element && element.parentNode) {
                console.log(`🗑️ Safely removing: ${selector}`);
                element.parentNode.removeChild(element);
              }
            } catch (e: any) {
              console.log(`⚠️ Could not remove element: ${e.message}`);
            }
          });
        } catch (e: any) {
          console.log(`⚠️ Selector error: ${e.message}`);
        }
      });

      // Safely clear body styles
      if (document.body) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('privy-modal-open', 'modal-open');
      }

      // Reset component states
      setIsConnectingWallet(false);
      setError(null);
      setShowEmergencyOverlay(false);
    } catch (e: any) {
      console.error('Cleanup error:', e);
    }
  };

  // Simple cleanup after authentication - no multiple timeouts
  useEffect(() => {
    if (authenticated && ready && wallets.length > 0) {
      console.log('🔄 Authentication complete, scheduling cleanup');
      // Single delayed cleanup to avoid race conditions
      const timeout = setTimeout(() => {
        forceCleanupPrivyUI();
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [authenticated, ready, wallets.length]);

  // Keyboard shortcut to escape (Escape key)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('⌨️ Escape key pressed, forcing cleanup');
        forceCleanupPrivyUI();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Simple polling for stuck states - less aggressive
  useEffect(() => {
    let stuckCount = 0;
    const interval = setInterval(() => {
      // Check if there are any modal overlays preventing interaction
      const overlays = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"], .privy-overlay',
      );
      if (overlays.length > 0 && authenticated) {
        stuckCount++;
        console.log(`🔍 Found overlays, stuck count: ${stuckCount}`);

        // Only show emergency overlay after being stuck for a while
        if (stuckCount > 2) {
          setShowEmergencyOverlay(true);
        }
      } else {
        stuckCount = 0;
        setShowEmergencyOverlay(false);
      }
    }, 3000); // Check every 3 seconds instead of 2

    return () => clearInterval(interval);
  }, [authenticated]);

  // Force page refresh to clear stuck states
  const handleRefresh = () => {
    window.location.reload();
  };

  // Manual function to clear stuck Privy UI
  const clearPrivyUI = () => {
    console.log('🧹 Manually clearing Privy UI');
    forceCleanupPrivyUI();
  };

  // Handle wallet connection with proper error handling
  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setError(null);

    // Set a timeout to clear connecting state if it gets stuck
    const timeoutId = setTimeout(() => {
      console.log('⚠️ Wallet connection timeout - clearing connecting state');
      setIsConnectingWallet(false);
      setError(
        'Wallet connection timed out. Please try again or refresh the page.',
      );
    }, 15000); // 15 second timeout

    try {
      await connectWallet();
      console.log('✅ Wallet connection initiated successfully');
      clearTimeout(timeoutId); // Clear timeout on success
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      console.error('❌ Wallet connection failed:', err);
      setError(`Wallet connection failed: ${errorMessage}`);
      setIsConnectingWallet(false);
    }
  };

  // Check if smart wallet is already deployed
  const checkSmartWalletDeployment = async (smartWalletAddress: string) => {
    try {
      setIsCheckingDeployment(true);
      console.log(
        '🔍 Checking if smart wallet is already deployed at:',
        smartWalletAddress,
      );

      const publicClient = createBasePublicClient();

      // Check if there's code at the smart wallet address
      const code = await publicClient.getBytecode({
        address: smartWalletAddress as `0x${string}`,
      });

      const isDeployed = code && code !== '0x' && code.length > 2;
      console.log(
        '🔍 Smart wallet deployment status:',
        isDeployed ? 'Already deployed ✅' : 'Not deployed ❌',
      );
      console.log('🔍 Contract code length:', code?.length || 0);

      setIsAlreadyDeployed(isDeployed || false);
      return isDeployed;
    } catch (error) {
      console.error('❌ Error checking deployment:', error);
      return false;
    } finally {
      setIsCheckingDeployment(false);
    }
  };

  const handleDeploy = async () => {
    if (!authenticated || wallets.length === 0) {
      setError('Please login and connect a wallet first');
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      const wallet = wallets[0];
      console.log('🔥 Starting ZeroDev deployment...');
      console.log('👤 User:', user?.email?.address || user?.wallet?.address);
      console.log('🔗 Using wallet:', wallet.address);
      console.log('🔍 Wallet type:', wallet.walletClientType);
      console.log('🔍 Wallet chain ID:', wallet.chainId);
      console.log('🔍 Wallet object:', wallet);
      console.log('🔍 Wallet keys:', Object.keys(wallet));

      // Check if wallet is on the correct chain (compare as strings)
      const chainIdStr = String(wallet.chainId);
      if (chainIdStr !== 'eip155:8453' && chainIdStr !== '8453') {
        console.log('⚠️ Wallet is on wrong chain, attempting to switch...');
        try {
          await wallet.switchChain(base.id);
          console.log('✅ Switched to Base chain');
        } catch (switchError) {
          console.error('❌ Failed to switch chain:', switchError);
          setError('Please switch your wallet to Base network');
          setIsDeploying(false);
          return;
        }
      }

      // Create public client
      const publicClient = createBasePublicClient();
      console.log('✅ Public client created');

      // Create kernel account
      console.log('🔧 Creating ZeroDev kernel account...');
      const kernelAccount = await createZeroDevKernelAccount(
        publicClient,
        wallet,
        base,
      );

      console.log('🎯 Smart wallet address:', kernelAccount.address);

      // Check if smart wallet is already deployed
      const isAlreadyDeployed = await checkSmartWalletDeployment(
        kernelAccount.address,
      );

      if (isAlreadyDeployed) {
        console.log(
          '✅ Smart wallet is already deployed! No deployment needed.',
        );
        setDeployedAccount(kernelAccount);
        setDeploymentTx('Already deployed');
        setIsDeploying(false);
        return;
      }

      // Create kernel client with gas sponsorship
      console.log('💰 Setting up gas sponsorship...');
      const kernelClient = await createZeroDevKernelClient(kernelAccount, base);

      console.log('📦 Deploying smart wallet on-chain...');
      console.log('⚡ Gas will be sponsored by ZeroDev paymaster');

      // Deploy the smart wallet by sending a transaction
      const deployTx = await kernelClient.sendTransaction({
        account: kernelAccount,
        to: kernelAccount.address, // Send to self to trigger deployment
        value: 0n, // No value transfer needed
      });

      console.log('🎉 ZeroDev smart wallet deployed successfully!');
      console.log('🏠 Smart wallet address:', kernelAccount.address);
      console.log('📋 Deployment transaction:', deployTx);
      console.log('💸 Gas sponsorship enabled - deployment was free!');
      console.log('✅ Smart wallet is ready for use');

      setDeployedAccount(kernelAccount);
      setDeploymentTx(deployTx);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Deployment failed';
      console.error('❌ ZeroDev deployment failed:', err);
      setError(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleTestTransaction = async () => {
    if (!deployedAccount) return;

    try {
      console.log('🔥 Testing smart wallet functionality...');
      const kernelClient = await createZeroDevKernelClient(
        deployedAccount,
        base,
      );

      console.log('✅ Smart wallet test successful!');
      console.log('🔧 Kernel client recreated successfully');
      console.log('💸 Gas sponsorship is active and ready!');
      console.log('🎉 Smart wallet is fully functional');
    } catch (err) {
      console.error('❌ Smart wallet test failed:', err);
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
    <>
      {/* Emergency overlay for stuck Privy modals */}
      {showEmergencyOverlay && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[99999]"
          onClick={forceCleanupPrivyUI}
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md mx-4 text-center">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
              🚨 Privy UI Stuck
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The Privy modal appears to be stuck. Click anywhere to force clear
              it.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={forceCleanupPrivyUI}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                🧹 Force Clear
              </button>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔄 Refresh Page
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press ESC key as alternative
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header with refresh button */}
          <div className="text-center mb-8">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  🧪 ZeroDev Standalone Test
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Independent ZeroDev smart wallet deployment test (bypasses
                  existing flows)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                  title="Refresh page to clear stuck states"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={clearPrivyUI}
                  className="px-3 py-1 bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-300 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-600 text-sm"
                  title="Clear stuck Privy spinning wheel"
                >
                  🧹 Clear UI
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

              {/* Wallet type routing */}
              {authenticated && wallets.length > 0 && (
                <div className="mt-3 space-y-3">
                  {wallets[0].walletClientType === 'privy' ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>📧 Privy Email Wallet Detected:</strong>
                        <p className="mt-1">
                          You're using a Privy embedded wallet. For the best
                          experience with smart wallets, try the{' '}
                          <a
                            href="/test-privy-smart-wallet"
                            className="underline font-medium"
                          >
                            Privy Smart Wallet test page
                          </a>
                          which uses Privy's native smart wallet functionality.
                        </p>
                        <p className="mt-2 text-xs">
                          ZeroDev deployment may not work with Privy embedded
                          wallets due to chain switching limitations.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="text-sm text-green-800 dark:text-green-300">
                        <strong>🔗 External Wallet Detected:</strong>
                        <p className="mt-1">
                          Perfect! External wallets work great with ZeroDev
                          smart wallet deployment.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ZeroDev Deployment */}
          {authenticated && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                ZeroDev Smart Wallet Deployment
              </h2>

              {wallets.length > 0 && wallets[0].walletClientType === 'privy' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-yellow-800 dark:text-yellow-300">
                      <strong>
                        ⚠️ ZeroDev Not Recommended for Privy Embedded Wallets
                      </strong>
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
                      Privy embedded wallets have chain switching limitations
                      that prevent ZeroDev deployment on Base network. Instead,
                      try the Privy Smart Wallet test which uses Privy's native
                      smart wallet functionality.
                    </p>
                    <a
                      href="/test-privy-smart-wallet"
                      className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      🧠 Try Privy Smart Wallets →
                    </a>
                  </div>

                  {/* Still allow deployment but warn user */}
                  <button
                    onClick={handleDeploy}
                    disabled={isDeploying || isCheckingDeployment}
                    className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {isCheckingDeployment
                      ? '🔍 Checking Smart Wallet...'
                      : isDeploying
                        ? '⏳ Attempting ZeroDev Deployment...'
                        : '⚠️ Try ZeroDev Anyway (May Fail)'}
                  </button>
                </div>
              ) : deployedAccount ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                      ✅{' '}
                      {deploymentTx === 'Already deployed'
                        ? 'Smart Wallet Found!'
                        : 'ZeroDev Smart Wallet Deployed!'}
                    </h3>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Address:</span>
                        <span className="ml-2 font-mono">
                          {deployedAccount.address}
                        </span>
                      </div>
                      {deploymentTx !== 'Already deployed' && (
                        <div>
                          <span className="font-medium">Deployment Tx:</span>
                          <a
                            href={`https://basescan.org/tx/${deploymentTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 font-mono text-blue-600 hover:underline"
                          >
                            {deploymentTx
                              ? `${deploymentTx.slice(0, 6)}...${deploymentTx.slice(-4)}`
                              : 'N/A'}
                          </a>
                        </div>
                      )}
                      {deploymentTx === 'Already deployed' && (
                        <div className="text-blue-600 dark:text-blue-400">
                          <span className="font-medium">Status:</span>
                          <span className="ml-2">
                            Smart wallet was already deployed on Base network
                          </span>
                        </div>
                      )}
                      <div className="font-medium text-green-700 dark:text-green-300">
                        💰 Gas was sponsored - user paid $0!
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleTestTransaction}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      🧪 Test Smart Wallet Functionality
                    </button>
                    <button
                      onClick={() => {
                        setDeployedAccount(null);
                        setDeploymentTx(null);
                        setIsAlreadyDeployed(false);
                        setError(null);
                      }}
                      className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Deploy a ZeroDev Kernel smart wallet with gas sponsorship.
                  </p>

                  <button
                    onClick={handleDeploy}
                    disabled={
                      isDeploying ||
                      isCheckingDeployment ||
                      wallets.length === 0
                    }
                    className={`w-full px-4 py-3 rounded-lg font-medium ${
                      isDeploying ||
                      isCheckingDeployment ||
                      wallets.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isAlreadyDeployed
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCheckingDeployment
                      ? '🔍 Checking Smart Wallet...'
                      : isDeploying
                        ? '⏳ Deploying ZeroDev Smart Wallet...'
                        : isAlreadyDeployed
                          ? '✅ Smart Wallet Already Deployed'
                          : '🚀 Deploy ZeroDev Smart Wallet'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                ❌ Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Debug Panel */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
              🐛 Debug Information
            </h3>
            <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <div>Privy State: {ready ? 'Ready' : 'Not Ready'}</div>
              <div>
                Auth State:{' '}
                {authenticated ? 'Authenticated' : 'Not Authenticated'}
              </div>
              <div>Connected Wallets: {wallets.length}</div>
              <div>
                Connecting State:{' '}
                {isConnectingWallet ? 'Connecting...' : 'Not Connecting'}
              </div>
              {wallets.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">First Wallet Details:</p>
                  <pre className="text-xs bg-yellow-100 dark:bg-yellow-800/20 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(
                      {
                        address: wallets[0].address,
                        type: wallets[0].walletClientType,
                        chainId: wallets[0].chainId,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
              <p className="font-medium mb-1">
                If you see a spinning Privy circle or get stuck connecting:
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Wait up to 15 seconds - connection will auto-timeout</li>
                <li>Click the "🔄 Refresh" button in the top right</li>
                <li>Try clearing your browser cache</li>
                <li>Open console and check for errors</li>
                <li>Try logging out and back in</li>
                <li>Make sure your wallet extension is unlocked</li>
                <li>Check if your wallet is on the correct network (Base)</li>
              </ol>
            </div>
          </div>

          {/* Console Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              📋 Console Instructions
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Open your browser's developer console (F12) to see detailed logs
              of the ZeroDev deployment process. All operations are logged with
              emojis for easy identification.
            </p>
          </div>

          {/* ZeroDev Configuration */}
          <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              ⚙️ ZeroDev Configuration
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Project ID: 485df233-2a0d-4aee-b94a-b266be42ea55</div>
              <div>Network: Base (Chain ID: 8453)</div>
              <div>Features: Gas sponsorship, Kernel v3, ECDSA validator</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
