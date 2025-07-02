'use client';

import { ExternalLink, RefreshCw, Wallet, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { useKernelVersionMigration } from '../hooks/useKernelVersionMigration';

interface OldWallet {
  address: string;
  kernelVersion: string;
  usdcBalance: string;
  ethBalance: string;
  isDeployed: boolean;
}

interface SmartWalletMigrationProps {
  currentSmartWallet?: string;
  onMigrationComplete?: () => void;
}

export default function SmartWalletMigration({
  currentSmartWallet,
  onMigrationComplete,
}: SmartWalletMigrationProps) {
  const { address: externalWallet } = useAccount();
  const [oldWallets, setOldWallets] = useState<OldWallet[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Kernel-version-aware migration hook
  const {
    executeMigrationTransaction,
    isExecuting: isDirectExecuting,
    transactionHash,
    isSuccess: isDirectSuccess,
  } = useKernelVersionMigration();

  // Scan for old smart wallets using API
  const scanForOldWallets = async () => {
    if (!externalWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsScanning(true);

    try {
      console.log('🔍 Scanning for old smart wallets via API...');

      const response = await fetch(
        `/api/smart-wallet-migration?userAddress=${externalWallet}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan for old wallets');
      }

      setOldWallets(data.oldWallets || []);

      if (data.oldWallets?.length > 0) {
        console.log(
          `✅ Found ${data.oldWallets.length} old wallets with funds`,
        );
        toast.success(data.message);
      } else {
        console.log('✅ No old wallets with funds found');
        toast.success('No old smart wallets with funds found');
      }
    } catch (error) {
      console.error('❌ Scan error:', error);
      toast.error('Failed to scan for old wallets');
    } finally {
      setIsScanning(false);
    }
  };

  // Direct migration with wallet signing
  const migrateWithSigning = async (
    fromWallet: OldWallet,
    toAddress: string,
    migrationType: 'new_wallet' | 'external',
  ) => {
    if (!externalWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    setSelectedWallet(fromWallet.address);

    try {
      await executeMigrationTransaction(fromWallet, toAddress, migrationType);
    } catch (error) {
      console.error('❌ Direct migration error:', error);
      setSelectedWallet(null);
    }
  };

  // Migrate funds using API (fallback to manual)
  const migrateFunds = async (
    fromWallet: OldWallet,
    toAddress: string,
    migrationType: 'new_wallet' | 'external',
  ) => {
    if (!externalWallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsMigrating(true);
    setSelectedWallet(fromWallet.address);

    try {
      console.log('🚀 Starting migration via API...');
      console.log(
        `📍 From: ${fromWallet.address} (${fromWallet.kernelVersion})`,
      );
      console.log(`📍 To: ${toAddress}`);

      toast.loading('Preparing migration with gas sponsorship...', {
        duration: 3000,
      });

      const response = await fetch('/api/smart-wallet-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldWalletAddress: fromWallet.address,
          oldWalletKernelVersion: fromWallet.kernelVersion,
          destinationAddress: toAddress,
          userAddress: externalWallet,
          migrationType,
          executeImmediately: true, // Try automatic execution first
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      if (data.executed) {
        // Migration was executed successfully
        toast.success('🎉 Migration completed with gas sponsorship!', {
          duration: 5000,
        });
        console.log('✅ Migration transaction hashes:', data.transactionHashes);

        // Refresh the wallet list
        setTimeout(() => {
          scanForOldWallets();
          if (onMigrationComplete) {
            onMigrationComplete();
          }
        }, 2000);
      } else if (data.requiresManualExecution) {
        // Automatic execution failed, provide manual instructions
        const reason =
          data.executionError || 'Automatic execution not available';
        toast.error(`${reason} - opening manual instructions`, {
          duration: 8000,
        });

        console.log('📋 MANUAL MIGRATION INSTRUCTIONS:');
        console.log(`🔗 Basescan URL: ${data.manualInstructions.basescanUrl}`);
        console.log(
          '⚠️ Automatic execution requires your private key, which we cannot access for security',
        );
        console.log('💡 Manual execution via Basescan is the secure approach');
        console.log('');
        data.manualInstructions.instructions.forEach((instruction: string) => {
          console.log(instruction);
        });

        console.log('📋 Parameters for Basescan:');
        data.manualInstructions.parameters.forEach((param: any, i: number) => {
          console.log(`${i + 1}. ${param.description}`);
          console.log(`   execMode: ${param.execMode}`);
          console.log(`   executionCalldata: ${param.executionCalldata}`);
        });

        // Open Basescan in a new tab
        window.open(data.manualInstructions.basescanUrl, '_blank');
      } else {
        // Just showing migration plan
        toast.success('Migration plan created - execute when ready');
        console.log('📋 Migration plan:', data.transactions);
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
      toast.error(error instanceof Error ? error.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
      setSelectedWallet(null);
    }
  };

  // Auto-scan on component mount
  useEffect(() => {
    if (externalWallet) {
      scanForOldWallets();
    }
  }, [externalWallet]);

  // Handle direct transaction success
  useEffect(() => {
    if (isDirectSuccess && transactionHash) {
      console.log('✅ Direct migration completed:', transactionHash);
      toast.success('🎉 Migration completed! Funds transferred successfully.');
      setSelectedWallet(null);

      // Refresh wallet list after successful migration
      setTimeout(() => {
        scanForOldWallets();
        if (onMigrationComplete) {
          onMigrationComplete();
        }
      }, 2000);
    }
  }, [isDirectSuccess, transactionHash, onMigrationComplete]);

  if (!externalWallet) {
    return null;
  }

  if (oldWallets.length === 0 && !isScanning) {
    return null;
  }

  return (
    <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-orange-300 font-medium flex items-center gap-2">
          <Wallet size={16} />
          Smart Wallet Migration
        </h4>
        <button
          onClick={scanForOldWallets}
          disabled={isScanning}
          className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-1"
        >
          <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
          {isScanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {isScanning && (
        <div className="text-orange-200 text-sm text-center py-2">
          🔍 Scanning for old smart wallets with funds...
        </div>
      )}

      {oldWallets.length > 0 && (
        <div className="space-y-3">
          <p className="text-orange-200 text-sm">
            Found {oldWallets.length} old smart wallet(s) with funds that can be
            migrated:
          </p>

          {oldWallets.map((wallet) => (
            <div
              key={wallet.address}
              className="bg-orange-900/30 border border-orange-600 rounded-lg p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-orange-300 font-medium text-sm">
                    {wallet.kernelVersion}
                  </div>
                  <div className="text-orange-200 font-mono text-xs">
                    {wallet.address}
                  </div>
                </div>
                <a
                  href={`https://basescan.org/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300"
                >
                  <ExternalLink size={14} />
                </a>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-orange-200 text-sm">
                  <div>{wallet.usdcBalance} USDC</div>
                  <div>{wallet.ethBalance} ETH</div>
                </div>
              </div>

              <div className="space-y-2">
                {/* Direct wallet signing buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      migrateWithSigning(
                        wallet,
                        currentSmartWallet || '',
                        'new_wallet',
                      )
                    }
                    disabled={isDirectExecuting || !currentSmartWallet}
                    className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded flex items-center justify-center gap-1"
                  >
                    {isDirectExecuting && selectedWallet === wallet.address ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <Zap size={12} />
                        Sign & Send to New Wallet
                      </>
                    )}
                  </button>

                  <button
                    onClick={() =>
                      migrateWithSigning(wallet, externalWallet, 'external')
                    }
                    disabled={isDirectExecuting}
                    className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded flex items-center justify-center gap-1"
                  >
                    {isDirectExecuting && selectedWallet === wallet.address ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <Zap size={12} />
                        Sign & Send to External
                      </>
                    )}
                  </button>
                </div>

                {/* Manual Basescan fallback */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      migrateFunds(
                        wallet,
                        currentSmartWallet || '',
                        'new_wallet',
                      )
                    }
                    disabled={isMigrating || !currentSmartWallet}
                    className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white text-xs rounded flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={10} />
                    Manual (New)
                  </button>

                  <button
                    onClick={() =>
                      migrateFunds(wallet, externalWallet, 'external')
                    }
                    disabled={isMigrating}
                    className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white text-xs rounded flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={10} />
                    Manual (External)
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="text-orange-200 text-xs space-y-1">
            <div>
              ⚡ <strong>Sign & Send</strong>: Direct wallet signing
              (recommended)
            </div>
            <div>
              🔧 <strong>Manual</strong>: Basescan contract interaction
              (fallback)
            </div>
            <div>
              💡 <strong>KERNEL_V3_1</strong>: Gas-free with paymaster
              sponsorship
            </div>
            <div>
              ⚠️ <strong>KERNEL_V3_0</strong>: You pay gas fees (version
              incompatibility)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
