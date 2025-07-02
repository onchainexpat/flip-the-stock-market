'use client';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Hex } from 'viem';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';

interface SmartWalletUpgradeProps {
  onUpgradeComplete?: () => void;
  onSkip?: () => void;
  className?: string;
}

type UpgradeStep = 'intro' | 'signing' | 'submitting' | 'success' | 'error';

export default function SmartWalletUpgrade({
  onUpgradeComplete,
  onSkip,
  className = '',
}: SmartWalletUpgradeProps) {
  const [step, setStep] = useState<UpgradeStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [hasActiveDelegation, setHasActiveDelegation] = useState<
    boolean | null
  >(null);

  const { address, walletInfo, upgradeToDelegated } = useUnifiedWallet();

  // Check if user already has EIP-7702 delegation
  useEffect(() => {
    console.log('SmartWalletUpgrade: checking delegation', {
      address,
      walletInfo,
    });
    if (walletInfo) {
      const hasDelegation = walletInfo.type === 'eip7702_delegated';
      console.log(
        'SmartWalletUpgrade: hasDelegation =',
        hasDelegation,
        'walletInfo.type =',
        walletInfo.type,
      );
      setHasActiveDelegation(hasDelegation);

      if (hasDelegation && onUpgradeComplete) {
        onUpgradeComplete();
      }
    } else if (address) {
      console.log(
        'SmartWalletUpgrade: no walletInfo, setting hasDelegation = false',
      );
      setHasActiveDelegation(false);
    }
  }, [address, walletInfo, onUpgradeComplete]);

  const handleUpgrade = useCallback(async () => {
    if (!address || !upgradeToDelegated) {
      toast.error('Wallet not connected or upgrade not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('signing');

    try {
      toast('Starting EIP-7702 upgrade...', { icon: 'ℹ️' });

      await upgradeToDelegated();

      setStep('success');
      toast.success('Smart wallet upgrade successful!');

      if (onUpgradeComplete) {
        onUpgradeComplete();
      }
    } catch (error: any) {
      console.error('Upgrade failed:', error);

      let errorMessage = 'Upgrade failed';
      if (error.message?.includes('User denied')) {
        errorMessage = 'Authorization was cancelled';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fee';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setStep('error');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [address, upgradeToDelegated, onUpgradeComplete]);

  const handleRetry = useCallback(() => {
    setStep('intro');
    setError(null);
    setTransactionHash(null);
  }, []);

  if (hasActiveDelegation === null) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (hasActiveDelegation) {
    return null; // Already upgraded
  }

  return (
    <div
      className={`w-full max-w-md mx-auto bg-gray-900 rounded-lg p-6 ${className}`}
    >
      {step === 'intro' && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Upgrade to Smart Wallet
            </h2>
            <p className="text-gray-400 text-sm">
              Enable advanced features like gas-free transactions and DCA
              automation
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  className="w-3 h-3 text-white"
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
              <div>
                <h3 className="text-white font-medium">
                  Gas-Free Transactions
                </h3>
                <p className="text-gray-400 text-sm">
                  All your transactions will be sponsored
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  className="w-3 h-3 text-white"
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
              <div>
                <h3 className="text-white font-medium">DCA Automation</h3>
                <p className="text-gray-400 text-sm">
                  Set up recurring SPX6900 purchases
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  className="w-3 h-3 text-white"
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
              <div>
                <h3 className="text-white font-medium">Batch Transactions</h3>
                <p className="text-gray-400 text-sm">
                  Execute multiple actions in one transaction
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
            <p className="text-blue-200 text-sm">
              <strong>What this does:</strong> EIP-7702 temporarily upgrades
              your existing wallet address with smart contract capabilities.
              Your address stays the same.
            </p>
          </div>

          <div className="space-y-2">
            {upgradeToDelegated ? (
              <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'Processing...' : 'Upgrade to Smart Wallet'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                  <p className="text-yellow-200 text-sm">
                    <strong>External Wallet Required:</strong> EIP-7702 upgrades
                    currently require an external wallet (like MetaMask) to
                    submit the delegation transaction.
                  </p>
                </div>
                <button
                  disabled={true}
                  className="w-full px-4 py-3 bg-gray-600 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                >
                  Connect External Wallet to Upgrade
                </button>
              </div>
            )}

            {onSkip && (
              <button
                onClick={onSkip}
                className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'signing' && (
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <h2 className="text-xl font-bold text-white">Sign Authorization</h2>
          <p className="text-gray-400">
            Please sign the EIP-7702 authorization in your wallet to enable
            smart wallet features.
          </p>
        </div>
      )}

      {step === 'submitting' && (
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <h2 className="text-xl font-bold text-white">
            Submitting Transaction
          </h2>
          <p className="text-gray-400">
            Submitting your EIP-7702 delegation transaction to the blockchain...
          </p>
        </div>
      )}

      {step === 'success' && (
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
          <h2 className="text-xl font-bold text-white">Upgrade Complete!</h2>
          <p className="text-gray-400">
            Your wallet has been successfully upgraded with smart contract
            capabilities.
          </p>
          {transactionHash && (
            <a
              href={`https://basescan.org/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-400 hover:text-blue-300 text-sm underline"
            >
              View Transaction
            </a>
          )}
          <button
            onClick={onUpgradeComplete}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
          >
            Continue to DCA
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Upgrade Failed</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="space-y-2">
            <button
              onClick={handleRetry}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
            >
              Try Again
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
