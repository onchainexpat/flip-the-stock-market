'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

// Coinbase paymaster endpoint for Base
const PAYMASTER_URL =
  process.env.NEXT_PUBLIC_COINBASE_PAYMASTER_AND_BUILDER_ENDPOINT ||
  'https://api.developer.coinbase.com/rpc/v1/base/paymaster';

interface SmartWalletDeployerProps {
  onDeploymentComplete?: (smartWalletAddress: string) => void;
}

export default function SmartWalletDeployer({
  onDeploymentComplete,
}: SmartWalletDeployerProps) {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [isDeploying, setIsDeploying] = useState(false);
  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(
    null,
  );

  // Get the embedded wallet
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );

  useEffect(() => {
    const checkSmartWallet = async () => {
      if (!ready || !authenticated || !embeddedWallet) {
        return;
      }

      // For now, we'll just log that we have an embedded wallet
      // The actual smart wallet deployment will happen when needed
      console.log('Embedded wallet detected:', embeddedWallet.address);
      console.log('Wallet type:', embeddedWallet.walletClientType);

      // Check if this is a Coinbase Smart Wallet
      if (
        embeddedWallet.walletClientType === 'coinbase_wallet' ||
        embeddedWallet.connectorType === 'coinbase_wallet'
      ) {
        console.log('Coinbase Smart Wallet detected');
        setSmartWalletAddress(embeddedWallet.address);

        if (onDeploymentComplete) {
          onDeploymentComplete(embeddedWallet.address);
        }
      } else {
        console.log(
          'Privy embedded wallet - smart wallet deployment available on first transaction',
        );
        // Smart wallet will be deployed on first transaction
      }
    };

    checkSmartWallet();
  }, [ready, authenticated, embeddedWallet, onDeploymentComplete]);

  // Check localStorage for existing smart wallet
  useEffect(() => {
    if (embeddedWallet && !smartWalletAddress) {
      const stored = localStorage.getItem(
        `smartWallet_${embeddedWallet.address}`,
      );
      if (stored) {
        setSmartWalletAddress(stored);
        if (onDeploymentComplete) {
          onDeploymentComplete(stored);
        }
      }
    }
  }, [embeddedWallet, smartWalletAddress, onDeploymentComplete]);

  if (!ready || !authenticated || !embeddedWallet) {
    return null;
  }

  return (
    <div className="hidden">
      {/* This component handles smart wallet deployment in the background */}
      {isDeploying && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            <span>Setting up smart wallet...</span>
          </div>
        </div>
      )}
    </div>
  );
}
