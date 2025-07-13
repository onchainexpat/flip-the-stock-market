'use client';

import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Repeat,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { type Address, erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { useClearSigning } from '../../hooks/useClearSigning';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';
import {
  PLATFORM_FEE_PERCENTAGE,
  TOKENS,
  openOceanApi,
} from '../../utils/openOceanApi';
import {
  createDCASessionPermissions,
  createDCASetupBatch,
} from '../../utils/smartWalletBatching';
import AddMoneyButton from '../AddMoneyButton';
import UnifiedLogin from '../UnifiedLogin';

interface SimpleDCAv2Props {
  className?: string;
  onOrderCreated?: () => void;
}

export default function SimpleDCAv2({
  className = '',
  onOrderCreated,
}: SimpleDCAv2Props) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const {
    isReady,
    address: smartWalletAddress,
    walletType,
    hasGasSponsorship,
    needsDeployment,
    sessionKeySupported,
    canCreateDCAOrders,
    generateSessionKey,
    deploySmartWallet,
    sendBatchTransactions,
    isLoading: smartWalletLoading,
    error: smartWalletError,
    activeWallet,
  } = useUnifiedSmartWallet();

  const {
    signDCAOrder,
    signSessionKeyAuthorization,
    signFundTransfer,
    signWithClearMessage,
    signCompleteDCASetup,
  } = useClearSigning();

  // For balance checking and funding, use external wallet address (better UX)
  // The smart wallet will be managed behind the scenes
  const externalWalletAddress = activeWallet?.address || wagmiAddress;
  const balanceAddress = externalWalletAddress; // Check balance from external wallet
  const isWalletReady =
    isReady && !!externalWalletAddress && !!smartWalletAddress;

  const [formData, setFormData] = useState({
    amount: '100',
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly' | 'monthly',
    duration: '30', // days
  });

  const [isCreating, setIsCreating] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  // Fetch USD balance from the smart wallet address
  const { data: balanceData } = useReadContracts({
    contracts: [
      {
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [balanceAddress as `0x${string}`],
        chainId: 8453,
      },
    ],
    query: {
      enabled: !!balanceAddress && isWalletReady,
      refetchInterval: 30000,
    },
  });

  const usdBalance = balanceData?.[0]?.result
    ? Number(balanceData[0].result) / 1e6
    : 0;

  // Debug balance fetching
  useEffect(() => {
    console.log('=== SMART WALLET BALANCE DEBUG v3 ===');
    console.log('Wagmi address:', wagmiAddress);
    console.log('Wagmi isConnected:', isConnected);
    console.log('External wallet address:', externalWalletAddress);
    console.log('Smart wallet address:', smartWalletAddress);
    console.log('Balance address being checked:', balanceAddress);
    console.log('Wallet type:', walletType);
    console.log('Is ready:', isReady);
    console.log('Is wallet ready:', isWalletReady);
    console.log('Has gas sponsorship:', hasGasSponsorship);
    console.log('Can create DCA orders:', canCreateDCAOrders);
    console.log('Needs deployment:', needsDeployment);
    console.log('Smart wallet loading:', smartWalletLoading);
    console.log('Smart wallet error:', smartWalletError);
    console.log('USDC balance:', usdBalance);
    console.log('=== END BALANCE DEBUG v3 ===');
  }, [
    wagmiAddress,
    isConnected,
    externalWalletAddress,
    smartWalletAddress,
    balanceAddress,
    walletType,
    isReady,
    isWalletReady,
    hasGasSponsorship,
    canCreateDCAOrders,
    needsDeployment,
    smartWalletLoading,
    smartWalletError,
    usdBalance,
  ]);

  // Calculate number of orders based on frequency and duration
  const calculateOrders = () => {
    const days = Number.parseInt(formData.duration) || 0;
    switch (formData.frequency) {
      case 'hourly':
        return days * 24;
      case 'daily':
        return days;
      case 'weekly':
        return Math.ceil(days / 7);
      case 'monthly':
        return Math.ceil(days / 30);
      default:
        return days;
    }
  };

  const numberOfOrders = calculateOrders();
  const amountPerOrder = Number.parseFloat(formData.amount) / numberOfOrders;
  const platformFeePerOrder = amountPerOrder * (PLATFORM_FEE_PERCENTAGE / 100);
  const netAmountPerOrder = amountPerOrder - platformFeePerOrder;
  const totalPlatformFees =
    Number.parseFloat(formData.amount) * (PLATFORM_FEE_PERCENTAGE / 100);

  // Balance validation
  const totalAmount = Number.parseFloat(formData.amount) || 0;
  const hasInsufficientBalance = totalAmount > usdBalance;

  // Max button handler
  const handleMaxAmount = () => {
    setFormData((prev) => ({
      ...prev,
      amount: usdBalance.toFixed(2),
    }));
  };

  // Get current SPX6900 price
  const fetchCurrentPrice = async () => {
    setPriceLoading(true);
    try {
      const price = await openOceanApi.getSPX6900Price();
      setCurrentPrice(price.price);
    } catch (error) {
      if (currentPrice !== null) {
        toast.error('Failed to fetch current price');
      }
    } finally {
      setPriceLoading(false);
    }
  };

  // Fetch price impact and route data for individual orders
  const fetchPriceImpact = async () => {
    const amount = Number.parseFloat(formData.amount);
    const orders = calculateOrders();

    if (!amount || !orders || orders === 0) {
      setPriceImpact(0);
      return;
    }

    setImpactLoading(true);
    try {
      const amountPerOrderInCents = (amount / orders) * 1e6;

      // Ensure we have a valid amount
      if (amountPerOrderInCents < 1) {
        setPriceImpact(0.1);
        setImpactLoading(false);
        return;
      }

      const response = await fetch(
        `/api/openocean-price?sellToken=${TOKENS.USDC}&buyToken=${TOKENS.SPX6900}&sellAmount=${Math.floor(amountPerOrderInCents)}`,
      );
      const data = await response.json();

      console.log('Price impact API response:', {
        ok: response.ok,
        status: response.status,
        data,
        estimatedPriceImpact: data.estimatedPriceImpact,
        estimatedPriceImpactType: typeof data.estimatedPriceImpact,
      });

      if (response.ok) {
        const impact = data.estimatedPriceImpact;
        const impactNumber =
          impact && !isNaN(Number.parseFloat(impact))
            ? Number.parseFloat(impact)
            : 0.1; // Default fallback
        setPriceImpact(impactNumber);
        setRouteData(data.route);
      } else {
        throw new Error(data.error || 'Failed to fetch price data');
      }
    } catch (error) {
      const orderSize = Number.parseFloat(formData.amount) / numberOfOrders;
      if (orderSize < 100) {
        setPriceImpact(0.1);
      } else if (orderSize < 500) {
        setPriceImpact(0.3);
      } else {
        setPriceImpact(0.5);
      }
      setRouteData(null);
    } finally {
      setImpactLoading(false);
    }
  };

  // Fetch price on component mount
  useEffect(() => {
    fetchCurrentPrice();
    fetchPriceImpact(); // Also fetch initial price impact
  }, []);

  // Fetch price impact when order parameters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchPriceImpact();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [formData.amount, formData.frequency, formData.duration]);

  // Create DCA order with batched transactions (smart wallet as a service)
  const createDCAOrder = async () => {
    if (!isWalletReady || !balanceAddress || !smartWalletAddress) {
      toast.error('Wallet not ready. Please connect a wallet first.');
      return;
    }

    if (!canCreateDCAOrders) {
      if (needsDeployment) {
        toast.error(
          'Please deploy your smart wallet first to enable automated DCA.',
        );
        return;
      }
      toast.error('Your wallet does not support automated DCA orders.');
      return;
    }

    // Check USD balance in external wallet
    if (hasInsufficientBalance) {
      toast.error(
        `Insufficient balance in your external wallet. You have $${usdBalance.toFixed(2)} but need $${totalAmount.toFixed(2)}.`,
      );
      return;
    }

    setIsCreating(true);

    try {
      console.log('🚀 Creating DCA order with batched smart wallet setup...');
      console.log('📤 External wallet:', externalWalletAddress);
      console.log('🤖 Smart wallet:', smartWalletAddress);
      console.log('💰 Total amount:', totalAmount);

      const totalAmountInWei = BigInt(Math.floor(totalAmount * 1e6)); // USDC has 6 decimals
      const durationInDays = Number.parseInt(formData.duration);

      // Calculate order details
      const orderCount = calculateOrders();

      if (!orderCount || orderCount === 0) {
        toast.error(
          'Invalid duration or frequency. Please check your settings.',
        );
        return;
      }

      const amountPerOrderValue = totalAmount / orderCount;

      console.log('📊 Order calculation:', {
        totalAmount,
        orderCount,
        amountPerOrder: amountPerOrderValue,
        frequency: formData.frequency,
        duration: durationInDays,
      });

      // Step 1: Get combined authorization for DCA setup and funding
      console.log('🔏 Requesting authorization for complete DCA setup...');
      await signCompleteDCASetup(
        smartWalletAddress as `0x${string}`,
        totalAmount,
        amountPerOrderValue,
        formData.frequency,
        orderCount,
        PLATFORM_FEE_PERCENTAGE,
        durationInDays,
      );

      // Step 2: Create batched setup transactions
      toast('Creating transaction batch...', { duration: 2000 });

      const setupBatch = await createDCASetupBatch(
        externalWalletAddress as `0x${string}`,
        smartWalletAddress as `0x${string}`,
        totalAmountInWei,
      );

      // Step 3: Execute the batch (transfer USDC + setup approvals)
      toast('Executing setup transactions...', { duration: 3000 });

      const txHashes = await sendBatchTransactions(setupBatch);
      console.log('✅ Setup batch completed:', txHashes);

      // Helper to convert BigInt to string for JSON serialization
      const serializeBigInt = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(serializeBigInt);
        if (typeof obj === 'object') {
          const result: any = {};
          for (const key in obj) {
            result[key] = serializeBigInt(obj[key]);
          }
          return result;
        }
        return obj;
      };

      // Step 4: Create session key permissions for automated execution
      let sessionKeyData: any;

      if (walletType === 'zerodev_smart') {
        // Create session permissions for ZeroDev
        const sessionPermissions = createDCASessionPermissions(
          smartWalletAddress as `0x${string}`,
          totalAmountInWei,
          durationInDays,
        );

        try {
          // Session key is already authorized in the combined DCA setup signature
          sessionKeyData = await generateSessionKey(sessionPermissions, {
            userWalletAddress: externalWalletAddress as Address,
            totalAmount: totalAmountInWei,
            orderSizeAmount: amountPerOrderValue,
            durationDays: durationInDays,
          });
          console.log(
            '✅ ZeroDev session key with private key created (already authorized in DCA setup)',
          );
        } catch (error) {
          console.log(
            '⚠️ Session key creation failed, using manual execution mode',
          );
          sessionKeyData = {
            sessionAddress: smartWalletAddress,
            permissions: sessionPermissions,
            validUntil:
              Math.floor(Date.now() / 1000) + durationInDays * 24 * 60 * 60,
            validAfter: Math.floor(Date.now() / 1000),
          };
        }
      } else {
        // Fallback for other wallet types
        sessionKeyData = {
          sessionAddress: smartWalletAddress,
          permissions: [],
          validUntil:
            Math.floor(Date.now() / 1000) + durationInDays * 24 * 60 * 60,
          validAfter: Math.floor(Date.now() / 1000),
        };
      }

      // Step 5: Create DCA order via API
      toast('Creating DCA order...', { duration: 2000 });

      const response = await fetch('/api/dca-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: externalWalletAddress, // User's external wallet
          smartWalletAddress: smartWalletAddress, // Smart wallet for execution
          sessionKeyAddress: sessionKeyData.sessionAddress,
          sessionKeyData: JSON.stringify(serializeBigInt(sessionKeyData)),
          totalAmount: formData.amount,
          frequency: formData.frequency,
          duration: formData.duration,
          platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
          estimatedPriceImpact: priceImpact || undefined,
          walletType,
          setupTransactions: txHashes, // Include setup transaction hashes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create DCA order');
      }

      const { order } = await response.json();

      const amountPerOrder = (Number(formData.amount) / numberOfOrders).toFixed(
        2,
      );
      toast.success(
        `🎉 DCA order created! ${numberOfOrders} orders of $${amountPerOrder} each. SPX6900 tokens will be sent to your external wallet after each swap.`,
        { duration: 6000 },
      );

      // Reset form
      setFormData({
        amount: '100',
        frequency: 'daily',
        duration: '30',
      });

      // Notify parent component to refresh
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: any) {
      console.error('❌ DCA order creation failed:', error);

      // Check if user cancelled the signing request
      if (
        error.message?.toLowerCase().includes('user cancelled signing request')
      ) {
        console.log('🚫 User cancelled DCA order creation');
        toast.error('Order creation cancelled');
      } else {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create order',
        );
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoginSuccess = () => {
    toast.success('Login successful! You can now start investing.');
  };

  // Show wallet connection UI if not ready
  if (!isWalletReady) {
    return (
      <div className={`${className}`}>
        {smartWalletError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">⚠️ {smartWalletError}</p>
          </div>
        )}

        <UnifiedLogin onSuccess={handleLoginSuccess} />

        {/* Additional info for external wallets */}
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
          <p className="text-blue-300 text-sm text-center">
            💡 Smart wallet manages DCA automatically, SPX6900 tokens delivered
            to your external wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <Repeat size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Auto-Invest v2</h3>
          <p className="text-sm text-gray-400">
            Smart wallet automation - SPX6900 delivered to your wallet
          </p>
        </div>
      </div>

      {/* Wallet Status */}
      {smartWalletError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">⚠️ {smartWalletError}</p>
        </div>
      )}

      {needsDeployment && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-blue-300 text-sm">
            🚀 Smart wallet needs deployment for gas-free transactions
          </p>
        </div>
      )}

      {/* Current Price */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">SPX6900 Price</span>
          <button
            onClick={fetchCurrentPrice}
            disabled={priceLoading}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {priceLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="mt-1">
          <span className="text-2xl font-bold text-white">
            {currentPrice ? `$${currentPrice.toFixed(4)}` : '---'}
          </span>
        </div>
      </div>

      {/* DCA Form */}
      <div className="space-y-4 mb-6">
        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              <DollarSign size={16} className="inline mr-1" />
              Total Amount (USD)
            </label>
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-400">
                Balance: ${usdBalance.toFixed(2)}
              </div>
              <AddMoneyButton
                className="text-xs py-1 px-2 text-xs"
                walletAddress={externalWalletAddress}
                walletType="external_wallet"
              />
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="100"
              min="1"
              step="0.01"
              className={`w-full p-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                hasInsufficientBalance
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-600 focus:ring-blue-500'
              }`}
            />
            <button
              onClick={handleMaxAmount}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              MAX
            </button>
          </div>
          {hasInsufficientBalance && (
            <p className="text-red-400 text-sm mt-1">
              Insufficient balance. You need ${totalAmount.toFixed(2)} but only
              have ${usdBalance.toFixed(2)}.
            </p>
          )}
        </div>

        {/* Frequency Selection */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            <Clock size={16} className="inline mr-1" />
            Investment Frequency
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'hourly', label: 'Hourly' },
            ].map((freq) => (
              <button
                key={freq.value}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    frequency: freq.value as any,
                  }))
                }
                className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                  formData.frequency === freq.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                {freq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Input */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            <Calendar size={16} className="inline mr-1" />
            Duration (days)
          </label>
          <input
            type="number"
            value={formData.duration}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, duration: e.target.value }))
            }
            placeholder="30"
            min="1"
            max="365"
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300">Order Summary</h4>
          <button
            onClick={() => setShowRouteDetails(!showRouteDetails)}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            Details{' '}
            {showRouteDetails ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Number of orders:</span>
            <span className="text-white">{numberOfOrders}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount per order:</span>
            <span className="text-white">${amountPerOrder.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Platform fee per order:</span>
            <span className="text-white">
              ${platformFeePerOrder.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Net amount per order:</span>
            <span className="text-white">${netAmountPerOrder.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
            <span className="text-gray-400">Total platform fees:</span>
            <span className="text-white">${totalPlatformFees.toFixed(2)}</span>
          </div>
          {priceImpact !== null && (
            <div className="flex justify-between">
              <span className="text-gray-400">Price impact:</span>
              <span
                className={`${(priceImpact || 0) > 1 ? 'text-red-400' : 'text-green-400'}`}
              >
                {impactLoading
                  ? 'Loading...'
                  : `${(priceImpact || 0).toFixed(2)}%`}
              </span>
            </div>
          )}
        </div>

        {showRouteDetails && routeData && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <h5 className="text-xs font-medium text-gray-400 mb-2">
              Route Details
            </h5>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Protocol: {routeData.protocol || 'OpenOcean'}</div>
              <div>Source: {routeData.source || 'Multiple DEXs'}</div>
              {routeData.sources && (
                <div>
                  Sources:{' '}
                  {routeData.sources.map((s: any) => s.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Smart Wallet Automation Info */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
        <h4 className="text-blue-300 font-medium mb-2">
          🤖 Smart Wallet Automation
        </h4>
        <div className="text-blue-200 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span>
              USDC transfers from your wallet to smart wallet for DCA execution
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span>
              SPX6900 tokens automatically sent back to your wallet after each
              swap
            </span>
          </div>
          {hasGasSponsorship && (
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-yellow-400">
                All swap transactions are gas-free
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Create Order Button */}
      <button
        onClick={createDCAOrder}
        disabled={
          isCreating ||
          smartWalletLoading ||
          hasInsufficientBalance ||
          !canCreateDCAOrders ||
          !Number.parseFloat(formData.amount) ||
          !Number.parseInt(formData.duration)
        }
        className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all duration-200 ${
          isCreating ||
          smartWalletLoading ||
          hasInsufficientBalance ||
          !canCreateDCAOrders
            ? 'bg-gray-700 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02]'
        } flex items-center justify-center gap-2`}
      >
        {isCreating || smartWalletLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Creating Order...
          </>
        ) : (
          <>
            <CheckCircle size={20} />
            Create DCA Order
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {!canCreateDCAOrders && needsDeployment && (
        <p className="text-center text-gray-400 text-sm mt-3">
          Deploy your smart wallet first to enable automated DCA orders
        </p>
      )}
    </div>
  );
}
