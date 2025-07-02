'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import EmailLogin from '../../components/EmailLogin';
import SmartWalletUpgrade from '../../components/SmartWalletUpgrade';
import { useUnifiedWallet } from '../../hooks/useUnifiedWallet';

export default function LoginPage() {
  const { authenticated, ready } = usePrivy();
  const { walletInfo, isReady } = useUnifiedWallet();
  const router = useRouter();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Redirect to main page if already authenticated and has smart wallet
  useEffect(() => {
    console.log('Redirect effect:', {
      authenticated,
      isReady,
      walletInfo,
      needsUpgrade: walletInfo?.needsUpgrade,
    });
    if (authenticated && isReady && walletInfo && !walletInfo.needsUpgrade) {
      console.log('Redirecting to main page...');
      router.push('/');
    }
  }, [authenticated, isReady, walletInfo, router]);

  // Show upgrade flow after successful email login
  useEffect(() => {
    console.log('Upgrade effect:', {
      authenticated,
      isReady,
      walletInfo,
      needsUpgrade: walletInfo?.needsUpgrade,
      showUpgrade,
    });
    if (authenticated && isReady && walletInfo?.needsUpgrade && !showUpgrade) {
      console.log('Showing upgrade flow...');
      setShowUpgrade(true);
    }
  }, [authenticated, isReady, walletInfo, showUpgrade]);

  const handleEmailLoginSuccess = () => {
    // Email login successful, wait for wallet info to load
    console.log(
      'Email login successful, authenticated:',
      authenticated,
      'isReady:',
      isReady,
      'walletInfo:',
      walletInfo,
    );
    // The useEffect above will handle showing the upgrade flow or redirect
  };

  const handleUpgradeComplete = () => {
    router.push('/dca-v2');
  };

  const handleSkipUpgrade = () => {
    router.push('/');
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-black to-purple-900/20"></div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SPX6900
            </h1>
            <p className="text-xl text-gray-300 mb-8">Flip The Stock Market</p>
          </div>

          {!authenticated && (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
              <EmailLogin onSuccess={handleEmailLoginSuccess} />
            </div>
          )}

          {authenticated && showUpgrade && (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
              <SmartWalletUpgrade
                onUpgradeComplete={handleUpgradeComplete}
                onSkip={handleSkipUpgrade}
              />
            </div>
          )}

          {authenticated && !showUpgrade && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome Back!</h2>
              <p className="text-gray-400">
                You're successfully logged in. Redirecting to the app...
              </p>
            </div>
          )}

          {/* Features showcase */}
          <div className="space-y-4 text-center">
            <h3 className="text-lg font-semibold text-gray-300">
              What you get with SPX6900:
            </h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center space-x-3 text-gray-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Gas-free transactions</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Automated DCA investing</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Smart wallet features</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-400">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>Real-time market tracking</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500">
            <p>
              Powered by <span className="text-blue-400">Privy</span>,{' '}
              <span className="text-purple-400">Base</span>, and{' '}
              <span className="text-green-400">EIP-7702</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
