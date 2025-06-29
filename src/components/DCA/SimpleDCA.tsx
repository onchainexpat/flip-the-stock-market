'use client';
// Using Coinbase Wallet SDK with smartWalletOnly preference for automatic smart wallet deployment
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Repeat,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { PLATFORM_FEE_PERCENTAGE, TOKENS, zeroXApi } from '../../utils/0xApi';
import { coinbaseSmartWalletService } from '../../lib/coinbaseSmartWalletService';
import AddMoneyButton from '../AddMoneyButton';
import EmailLogin from '../EmailLogin';
import WalletWrapper from '../WalletWrapper';

interface SimpleDCAProps {
  className?: string;
  onOrderCreated?: () => void;
}

export default function SimpleDCA({
  className = '',
  onOrderCreated,
}: SimpleDCAProps) {
  const { address, isConnected } = useAccount();
  const [emailWalletAddress, setEmailWalletAddress] = useState<string | null>(null);
  
  // Use email wallet address if available, otherwise use connected wallet
  const balanceAddress = emailWalletAddress || address;
  const isWalletReady = isConnected || !!emailWalletAddress;

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
    if (balanceAddress) {
      console.log('=== SMART WALLET BALANCE DEBUG ===');
      console.log('Connected wallet address:', address);
      console.log('Email wallet address:', emailWalletAddress);
      console.log('Balance address being checked:', balanceAddress);
      console.log('Wallet type:', emailWalletAddress ? 'Email Smart Wallet' : 'Connected Wallet');
      console.log('Is wallet ready:', isWalletReady);
      console.log('USDC token address:', TOKENS.USDC);
      console.log('Balance data:', balanceData);
      console.log('Raw balance result:', balanceData?.[0]?.result);
      console.log('Formatted USD balance:', usdBalance);
      console.log('Query enabled:', !!balanceAddress && isWalletReady);
      console.log('=== END BALANCE DEBUG ===');
    }
  }, [address, emailWalletAddress, balanceAddress, balanceData, usdBalance, isWalletReady]);

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
      const price = await zeroXApi.getSPX6900Price();
      setCurrentPrice(price.price);
    } catch (error) {
      // Silent price fetch failure - use cached data if available
      if (currentPrice !== null) {
        toast.error('Failed to fetch current price');
      }
    } finally {
      setPriceLoading(false);
    }
  };

  // Fetch price impact and route data for individual orders
  const fetchPriceImpact = async () => {
    if (!formData.amount || !numberOfOrders) return;

    setImpactLoading(true);
    try {
      const amountPerOrderInCents =
        (Number.parseFloat(formData.amount) / numberOfOrders) * 1e6; // Convert to base units

      // Get full quote data including route information
      const response = await fetch(
        `/api/0x-price?sellToken=${TOKENS.USDC}&buyToken=${TOKENS.SPX6900}&sellAmount=${Math.floor(amountPerOrderInCents)}`,
      );
      const data = await response.json();

      if (response.ok) {
        setPriceImpact(Number.parseFloat(data.estimatedPriceImpact));
        setRouteData(data.route);
      } else {
        throw new Error(data.error || 'Failed to fetch price data');
      }
    } catch (error) {
      // Use fallback estimate based on order size
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
  }, []);

  // Fetch price impact when order parameters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchPriceImpact();
    }, 500); // Debounce to avoid too many API calls

    return () => clearTimeout(debounceTimer);
  }, [formData.amount, formData.frequency, formData.duration]);

  // Create DCA order
  const createDCAOrder = async () => {

    if (!isWalletReady || !balanceAddress) {
      // Silent validation - no user notification about technical details
      return;
    }

    // Check USD balance
    if (hasInsufficientBalance) {
      toast.error(
        `Insufficient balance. You have $${usdBalance.toFixed(2)} but need $${totalAmount.toFixed(2)}.`,
      );
      return;
    }

    const numberOfOrders = calculateOrders();
    setIsCreating(true);

    try {
      console.log('Creating DCA order with Coinbase Smart Wallet...');
      
      const totalAmount = Number.parseFloat(formData.amount);
      
      // Check if wallet supports session keys
      const supportsSessionKeys = await coinbaseSmartWalletService.supportsSessionKeys(
        balanceAddress as `0x${string}`
      );
      
      if (!supportsSessionKeys) {
        toast.error('Your wallet does not support automated trading. Please use a Coinbase Smart Wallet.');
        return;
      }
      
      // Generate session key for automated DCA execution
      console.log('Generating session key for automated DCA...');
      const sessionKeyData = await coinbaseSmartWalletService.generateSessionKey(
        balanceAddress as `0x${string}`,
        [
          {
            target: TOKENS.USDC, // Allow spending USDC
            valueLimit: BigInt(totalAmount * 1e6), // Total DCA amount limit
            functionSelectors: ['0xa9059cbb', '0x095ea7b3'], // transfer, approve
          },
          {
            target: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Allow any contract calls for swaps
            valueLimit: BigInt(totalAmount * 1e6),
            functionSelectors: ['0x'], // Any function selector for 0x swaps
          }
        ]
      );
      
      console.log(`✅ Session key generated: ${sessionKeyData.sessionAddress}`);
      toast.success('Smart wallet session created for automated investing!', {
        duration: 4000,
      });

      // Create DCA order via API
      const response = await fetch('/api/dca-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: balanceAddress,
          sessionKeyAddress: sessionKeyData.sessionAddress,
          sessionKeyData: JSON.stringify(sessionKeyData), // Store full session key data
          totalAmount: formData.amount,
          frequency: formData.frequency,
          duration: formData.duration,
          platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
          estimatedPriceImpact: priceImpact || undefined,
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
        `DCA order created! ${numberOfOrders} orders of $${amountPerOrder} each`,
      );
      // Order created successfully

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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create order',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleEmailSuccess = () => {
    toast.success('Email login successful! You can now start investing.');
  };

  if (!isWalletReady) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-gray-900 rounded-lg p-6 text-center">
          <div className="mb-4">
            <TrendingUp size={48} className="mx-auto text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            DCA into SPX6900
          </h3>
          <p className="text-gray-400 mb-6">
            Automatically invest in SPX6900 with scheduled purchases
          </p>
          
          {/* Email Login Option */}
          <div className="mb-6">
            <EmailLogin onSuccess={handleEmailSuccess} />
          </div>
          
          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="text-gray-400 text-sm">or</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>
          
          {/* External Wallet Connection */}
          <div>
            <h4 className="text-white font-medium mb-3">Connect External Wallet</h4>
            <WalletWrapper className="w-full" />
          </div>
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
          <h3 className="text-lg font-semibold text-white">Auto-Invest</h3>
          <p className="text-sm text-gray-400">
            Scheduled investing made simple
          </p>
        </div>
      </div>

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
              <AddMoneyButton className="text-xs py-1 px-2 text-xs" />
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className={`w-full bg-gray-800 border rounded-lg px-4 py-3 pr-16 text-white placeholder-gray-400 focus:outline-none ${
                hasInsufficientBalance
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-700 focus:border-blue-500'
              }`}
              placeholder="100"
              min="1"
              step="0.01"
            />
            <button
              type="button"
              onClick={handleMaxAmount}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              MAX
            </button>
          </div>
          {hasInsufficientBalance && (
            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm mb-2">
                Insufficient balance. You need ${(totalAmount - usdBalance).toFixed(2)} more.
              </p>
              <AddMoneyButton 
                className="text-sm py-2 px-4" 
                onFundingComplete={() => {
                  // Refresh balance after funding
                  window.location.reload();
                }}
              />
            </div>
          )}
        </div>

        {/* Frequency Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Clock size={16} className="inline mr-1" />
            Frequency
          </label>
          <select
            value={formData.frequency}
            onChange={(e) =>
              setFormData({ ...formData, frequency: e.target.value as any })
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="hourly">Every Hour</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Duration Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Calendar size={16} className="inline mr-1" />
            Duration (days)
          </label>
          <input
            type="number"
            value={formData.duration}
            onChange={(e) =>
              setFormData({ ...formData, duration: e.target.value })
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="30"
            min="1"
          />
        </div>
      </div>

      {/* Order Summary */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-300 mb-3">
          Order Summary
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Orders:</span>
            <span className="text-white">{numberOfOrders}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount per Order:</span>
            <span className="text-white">
              ${amountPerOrder.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Platform Fee (0.1%):</span>
            <span className="text-orange-400">
              -${totalPlatformFees.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Net Amount per Order:</span>
            <span className="text-green-400">
              ${netAmountPerOrder.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Est. SPX6900 per Order:</span>
            <span className="text-purple-400">
              {currentPrice
                ? `~${(netAmountPerOrder / currentPrice).toFixed(2)} SPX`
                : '---'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price Impact:</span>
            <span
              className={`${priceImpact !== null ? (priceImpact < 1 ? 'text-green-400' : priceImpact < 3 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-400'}`}
            >
              {impactLoading ? (
                <div className="animate-pulse">Loading...</div>
              ) : priceImpact !== null ? (
                `~${priceImpact.toFixed(2)}%`
              ) : (
                'Calculating...'
              )}
            </span>
          </div>
          {routeData && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <button
                onClick={() => setShowRouteDetails(!showRouteDetails)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-gray-400">Best route:</span>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm">
                    {routeData.fills?.length || 0} hop
                    {routeData.fills?.length !== 1 ? 's' : ''}
                  </span>
                  {showRouteDetails ? (
                    <ChevronUp size={14} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                </div>
              </button>

              {showRouteDetails && (
                <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">
                    Route Breakdown:
                  </div>
                  <div className="space-y-2">
                    {routeData.tokens?.map((token: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs text-gray-300">
                          {token.symbol || token.address?.slice(0, 6) + '...'}
                        </span>
                        {index < routeData.tokens.length - 1 && (
                          <ArrowRight size={12} className="text-gray-500" />
                        )}
                      </div>
                    ))}
                  </div>

                  {routeData.fills && routeData.fills.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-2">
                        Route Details:
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          // Group fills by trading pair to show the route structure properly
                          const routePaths = new Map();

                          routeData.fills.forEach((fill: any) => {
                            const fromToken =
                              routeData.tokens.find(
                                (t: any) =>
                                  t.address.toLowerCase() ===
                                  fill.from.toLowerCase(),
                              )?.symbol || 'Unknown';
                            const toToken =
                              routeData.tokens.find(
                                (t: any) =>
                                  t.address.toLowerCase() ===
                                  fill.to.toLowerCase(),
                              )?.symbol || 'Unknown';
                            const pairKey = `${fromToken}-${toToken}`;

                            if (!routePaths.has(pairKey)) {
                              routePaths.set(pairKey, []);
                            }
                            routePaths.get(pairKey).push(fill);
                          });

                          return Array.from(routePaths.entries()).map(
                            (
                              [pairKey, fills]: [string, any[]],
                              index: number,
                            ) => (
                              <div key={index} className="text-xs">
                                <div className="text-gray-300 font-medium">
                                  {pairKey.replace('-', ' → ')}
                                </div>
                                {fills.map((fill: any, fillIndex: number) => (
                                  <div
                                    key={fillIndex}
                                    className="flex justify-between ml-2 mt-1"
                                  >
                                    <span className="text-gray-400">
                                      {fill.source}
                                    </span>
                                    <span className="text-blue-400">
                                      {(
                                        (Number(fill.proportionBps) / 10000) *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ),
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Estimated Duration:</span>
            <span className="text-white">{formData.duration} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">First Execution:</span>
            <span className="text-green-400 font-medium">Immediate</span>
          </div>
          {/* Gas fees always sponsored - no need to display */}
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Fee Breakdown:</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-300">Input Amount:</span>
            <span className="text-white">${formData.amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">
              Platform Fee ({PLATFORM_FEE_PERCENTAGE}%):
            </span>
            <span className="text-orange-400">
              -${totalPlatformFees.toFixed(3)}
            </span>
          </div>
          <div className="border-t border-gray-700 pt-1 mt-1">
            <div className="flex justify-between font-medium">
              <span className="text-gray-300">Amount to Invest:</span>
              <span className="text-green-400">
                $
                {(
                  Number.parseFloat(formData.amount) - totalPlatformFees
                ).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Order Button */}
      <button
        onClick={() => {
          // Always allow DCA creation if user has sufficient USDC
          // Smart wallet deployment will happen automatically if needed
          createDCAOrder();
        }}
        disabled={
          isCreating ||
          !isWalletReady ||
          hasInsufficientBalance
        }
        className="
          w-full bg-gradient-to-r from-blue-600 to-purple-600 
          hover:from-blue-700 hover:to-purple-700 
          disabled:from-gray-600 disabled:to-gray-700
          text-white font-semibold py-3 px-4 rounded-lg 
          flex items-center justify-center gap-2 
          transition-all duration-200
          disabled:cursor-not-allowed
        "
        title={
          hasInsufficientBalance ? 'Insufficient USDC balance' : 
          !isWalletReady ? 'Connect wallet or login with email to continue' : ''
        }
      >
        {isCreating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Creating Order...
          </>
        ) : (
          <>
            <Repeat size={16} />
            Start Auto-Investing
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {/* Technical details completely hidden from users - no UI shown */}

      {/* Gas concepts completely hidden from users */}
    </div>
  );
}
