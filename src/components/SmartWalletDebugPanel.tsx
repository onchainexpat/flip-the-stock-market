'use client';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSmartWallet } from '../hooks/useSmartWallet';
import { usePrivySmartWallet } from '../services/privySmartWalletService';

export default function SmartWalletDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const { walletInfo } = useSmartWallet();
  const {
    getSmartWalletAddress,
    getEmbeddedWalletAddress,
    isSmartWalletDeployed,
    getSmartWalletInfo,
    user,
  } = usePrivySmartWallet();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const clearDeploymentData = () => {
    if (walletInfo?.address) {
      localStorage.removeItem(`smartWallet_${walletInfo.address}`);
      localStorage.removeItem('deployedSmartWallets');
      alert('Deployment data cleared! Refresh the page.');
    }
  };

  const getStoredData = () => {
    const smartWalletInfo = getSmartWalletInfo();
    const embeddedWalletAddress = getEmbeddedWalletAddress();

    // Also check for manually created smart wallets
    const manualSmartWallet = embeddedWalletAddress
      ? localStorage.getItem(`manualSmartWallet_${embeddedWalletAddress}`)
      : null;

    // Check for real smart wallets
    const realSmartWallet = embeddedWalletAddress
      ? localStorage.getItem(`realSmartWallet_${embeddedWalletAddress}`)
      : null;

    return {
      embeddedWallet: embeddedWalletAddress || walletInfo?.address,
      smartWalletAddress:
        smartWalletInfo.address || realSmartWallet || manualSmartWallet,
      isSmartWalletDeployed:
        smartWalletInfo.isDeployed || !!realSmartWallet || !!manualSmartWallet,
      canUseSessionKeys:
        smartWalletInfo.canUseSessionKeys ||
        !!realSmartWallet ||
        !!manualSmartWallet,
      walletType: walletInfo?.walletType || 'unknown',
      isSmartContract: walletInfo?.isSmartContract || false,
      hasSessionKeySupport: walletInfo?.hasSessionKeySupport || false,
      manualSmartWallet: manualSmartWallet,
      realSmartWallet: realSmartWallet,
      privyUser: user
        ? {
            id: user.id,
            linkedAccounts: user.linkedAccounts?.length || 0,
            smartWallets:
              user.linkedAccounts?.filter((acc) => acc.type === 'smart_wallet')
                .length || 0,
          }
        : null,
    };
  };

  const storedData = getStoredData();

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-gray-800 text-white p-2 rounded-lg shadow-lg border border-gray-600 hover:bg-gray-700 transition-colors"
        title="Toggle Smart Wallet Debug Panel"
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {isVisible && (
        <div className="mt-2 bg-gray-900 border border-gray-600 rounded-lg p-4 w-96 max-h-96 overflow-y-auto shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">
              Smart Wallet Debug
            </h3>
            <button
              onClick={clearDeploymentData}
              className="text-red-400 hover:text-red-300 transition-colors"
              title="Clear deployment data"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {storedData ? (
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-400">Embedded Wallet:</span>
                <div className="text-white font-mono break-all">
                  {storedData.embeddedWallet}
                </div>
              </div>

              <div>
                <span className="text-gray-400">Smart Wallet:</span>
                <div className="text-white font-mono break-all">
                  {storedData.smartWalletAddress || 'Not deployed'}
                </div>
              </div>

              <div>
                <span className="text-gray-400">Smart Wallet Deployed:</span>
                <div className="text-white">
                  {storedData.isSmartWalletDeployed ? 'Yes' : 'No'}
                </div>
              </div>

              <div>
                <span className="text-gray-400">Session Keys Available:</span>
                <div className="text-white">
                  {storedData.canUseSessionKeys ? 'Yes' : 'No'}
                </div>
              </div>

              <div>
                <span className="text-gray-400">Wallet Type:</span>
                <div className="text-white">{storedData.walletType}</div>
              </div>

              <div>
                <span className="text-gray-400">Is Smart Contract:</span>
                <div className="text-white">
                  {storedData.isSmartContract ? 'Yes' : 'No'}
                </div>
              </div>

              {storedData.privyUser && (
                <div>
                  <span className="text-gray-400">Privy User:</span>
                  <div className="text-white text-xs">
                    ID: {storedData.privyUser.id}
                    <br />
                    Linked Accounts: {storedData.privyUser.linkedAccounts}
                    <br />
                    Smart Wallets: {storedData.privyUser.smartWallets}
                  </div>
                </div>
              )}

              {storedData.realSmartWallet && (
                <div>
                  <span className="text-gray-400">Real Smart Wallet:</span>
                  <div className="text-white font-mono break-all">
                    {storedData.realSmartWallet}
                  </div>
                  <div className="text-green-400 text-xs mt-1">
                    ✓ Coinbase Smart Wallet (ERC-4337)
                  </div>
                </div>
              )}

              {storedData.manualSmartWallet && !storedData.realSmartWallet && (
                <div>
                  <span className="text-gray-400">Manual Smart Wallet:</span>
                  <div className="text-white font-mono break-all">
                    {storedData.manualSmartWallet}
                  </div>
                </div>
              )}

              {user?.linkedAccounts && (
                <div>
                  <span className="text-gray-400">Account Details:</span>
                  <div className="text-white text-xs max-h-32 overflow-y-auto">
                    {user.linkedAccounts.map((account, index) => (
                      <div key={index} className="mb-1 p-1 bg-gray-800 rounded">
                        <strong>Type:</strong> {account.type}
                        <br />
                        <strong>Address:</strong> {account.address}
                        <br />
                        {account.walletClientType && (
                          <>
                            <strong>Client:</strong> {account.walletClientType}
                            <br />
                          </>
                        )}
                        {account.connectorType && (
                          <>
                            <strong>Connector:</strong> {account.connectorType}
                            <br />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-xs">
              No wallet data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
