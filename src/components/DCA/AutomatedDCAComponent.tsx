'use client';

import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  Repeat,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount, useReadContracts } from 'wagmi';
import { type Address, erc20Abi } from 'viem';
import { TOKENS } from '../../utils/openOceanApi';
import { useOneClickDCA } from '../../services/oneClickDCAService';

interface DCAOrder {
  id: string;
  userAddress: string;
  totalAmount: number;
  frequency: string;
  duration: number;
  status: string;
  createdAt: string;
  smartWalletAddress: string;
}

interface AutomatedDCAComponentProps {
  className?: string;
  onOrderCreated?: () => void;
}

interface DCAFormData {
  amount: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration: string;
}

export default function AutomatedDCAComponent({
  className = '',
  onOrderCreated,
}: AutomatedDCAComponentProps) {
  const { address: userWalletAddress, isConnected } = useAccount();
  const { executeOneClickDCA, isReady } = useOneClickDCA();

  // Form state
  const [formData, setFormData] = useState<DCAFormData>({
    amount: '100',
    frequency: 'daily',
    duration: '30',
  });

  // Process state
  const [isCreating, setIsCreating] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(null);
  const [showFundingInstructions, setShowFundingInstructions] = useState(false);
  
  // Order history state
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());

  // Fetch USDC balance
  const { data: balanceData } = useReadContracts({
    contracts: [
      {
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userWalletAddress as Address],
        chainId: 8453,
      },
    ],
    query: {
      enabled: !!userWalletAddress && isConnected,
      refetchInterval: 30000,
    },
  });

  const usdcBalance = balanceData?.[0]?.result
    ? Number(balanceData[0].result) / 1e6
    : 0;

  // Calculate order details
  const calculateOrders = () => {
    const days = parseInt(formData.duration) || 0;
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
  const amountPerOrder = parseFloat(formData.amount) / numberOfOrders;
  const platformFeePercentage = 0; // No platform fee
  const platformFeePerOrder = amountPerOrder * (platformFeePercentage / 100);
  const netAmountPerOrder = amountPerOrder - platformFeePerOrder;
  const totalPlatformFees = parseFloat(formData.amount) * (platformFeePercentage / 100);

  // Load user's DCA orders
  const loadOrders = async () => {
    if (!userWalletAddress) return;
    
    setLoadingOrders(true);
    try {
      const response = await fetch(`/api/dca-orders-v2?userAddress=${userWalletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load orders when wallet connects
  useEffect(() => {
    if (isConnected && userWalletAddress) {
      loadOrders();
    }
  }, [isConnected, userWalletAddress]);

  // Cancel order function
  const cancelOrder = async (orderId: string) => {
    if (!userWalletAddress) return;
    
    setCancellingOrders(prev => new Set(prev).add(orderId));
    
    try {
      const response = await fetch(`/api/delete-order?orderId=${orderId}&userAddress=${userWalletAddress}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Order cancelled successfully');
        loadOrders(); // Reload orders
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order');
    } finally {
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const createAutomatedDCAOrder = async () => {
    if (!isConnected || !userWalletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!isReady) {
      toast.error('Wallet not ready for one-click DCA');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsCreating(true);

    try {
      console.log('🚀 Starting one-click DCA setup...');

      const result = await executeOneClickDCA({
        amount: formData.amount,
        frequency: formData.frequency,
        duration: formData.duration,
        platformFeePercentage,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create DCA order');
      }
      
      console.log('✅ One-click DCA complete:', result);
      
      setOrderId(result.orderId!);
      setSmartWalletAddress(result.smartWalletAddress!);
      setShowFundingInstructions(true);

      toast.success(
        `🎉 One-click DCA setup complete! Your automated DCA is now active.`,
        { duration: 8000 }
      );

      // Reload orders to show the new one
      loadOrders();

      if (onOrderCreated) {
        onOrderCreated();
      }

    } catch (error: any) {
      console.error('❌ One-click DCA failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to setup DCA',
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <Shield className="mx-auto w-12 h-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Connect Wallet Required
          </h3>
          <p className="text-gray-400">
            Please connect your wallet to create automated DCA orders
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
          <Repeat size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">One-Click Automated DCA</h3>
          <p className="text-sm text-gray-400">
            Single transaction sets up everything: wallet, funding, and automation
          </p>
        </div>
      </div>

      {!showFundingInstructions ? (
        <>
          {/* One-Click Description */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
            <h4 className="text-blue-300 font-semibold mb-2">🚀 One-Click Setup Process</h4>
            <p className="text-blue-200 text-sm mb-3">
              When you click "One-Click DCA Setup", we'll handle everything in a single flow:
            </p>
            <ul className="space-y-1 text-blue-200 text-xs">
              <li>• Deploy your gas-sponsored smart wallet</li>
              <li>• Request USDC transfer from your wallet to the smart wallet</li>
              <li>• Set up automated trading permissions</li>
              <li>• Create your DCA order with server-managed execution</li>
            </ul>
          </div>

          {/* Form */}
          <div className="space-y-4 mb-6">
            {/* Amount Input */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                <DollarSign size={16} className="inline mr-1" />
                Total Amount (USDC)
              </label>
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
                  className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={isCreating}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                  Balance: ${usdcBalance.toFixed(2)}
                </div>
              </div>
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
                        ? 'bg-green-600 border-green-600 text-white'
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
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isCreating}
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Order Summary</h4>
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
                <span className="text-white">${platformFeePerOrder.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Net amount per order:</span>
                <span className="text-white">${netAmountPerOrder.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                <span className="text-gray-400">Total platform fees:</span>
                <span className="text-white">${totalPlatformFees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
            <h4 className="text-green-300 font-medium mb-3">
              ✅ True Automation Features
            </h4>
            <div className="space-y-2 text-sm text-green-200">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                <span>Executes automatically - no need to be online</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-blue-400" />
                <span>Server-managed keys stored securely</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-400" />
                <span>Gas-free transactions via ZeroDev</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-purple-400" />
                <span>Runs on schedule even when you're away</span>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={createAutomatedDCAOrder}
            disabled={
              isCreating ||
              !formData.amount ||
              parseFloat(formData.amount) <= 0 ||
              !parseInt(formData.duration)
            }
            className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all duration-200 ${
              isCreating || !formData.amount || parseFloat(formData.amount) <= 0
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 transform hover:scale-[1.02]'
            } flex items-center justify-center gap-2`}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up One-Click DCA...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                One-Click DCA Setup
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </>
      ) : (
        /* Funding Instructions */
        <div className="space-y-6">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h4 className="text-green-300 font-semibold mb-2">
              ✅ One-Click DCA Setup Complete!
            </h4>
            <p className="text-green-200 text-sm">
              Your automated DCA order is active and funded. Trades will execute automatically on schedule.
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Order Details</h4>
            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Order ID:</span>
                <div className="text-white font-mono text-sm">{orderId}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Total Amount:</span>
                <div className="text-white font-semibold">${formData.amount} USDC</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Frequency:</span>
                <div className="text-white capitalize">{formData.frequency}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Duration:</span>
                <div className="text-white">{formData.duration} days</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Amount per Trade:</span>
                <div className="text-white">${amountPerOrder.toFixed(2)} USDC</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h4 className="text-blue-300 font-medium mb-2">What Happens Next?</h4>
            <ol className="space-y-2 text-blue-200 text-sm">
              <li>✅ Smart wallet deployed and funded with {formData.amount} USDC</li>
              <li>✅ Agent permissions set up for automated execution</li>
              <li>🕐 DCA executions will start according to your {formData.frequency} schedule</li>
              <li>📈 SPX tokens will be sent to your wallet after each swap</li>
              <li>🔔 Monitor progress through your wallet or our dashboard</li>
            </ol>
          </div>

          <button
            onClick={() => {
              setShowFundingInstructions(false);
              setOrderId(null);
              setSmartWalletAddress(null);
              setFormData({
                amount: '100',
                frequency: 'daily',
                duration: '30',
              });
            }}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
          >
            Create Another Order
          </button>
        </div>
      )}

      {/* Order History Section */}
      {isConnected && (
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={20} />
            Your DCA Orders
          </h3>
          
          {loadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Repeat className="mx-auto w-12 h-12 text-gray-500 mb-4" />
              <p className="text-gray-400">No DCA orders yet</p>
              <p className="text-gray-500 text-sm">Create your first automated DCA order above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-white font-medium">
                        ${order.totalAmount} USDC → SPX
                      </div>
                      <div className="text-gray-400 text-sm">
                        {order.frequency} • {order.duration} days
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'active' 
                          ? 'bg-green-900 text-green-300' 
                          : order.status === 'completed'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {order.status}
                      </div>
                      {order.status === 'active' && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          disabled={cancellingOrders.has(order.id)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                          title="Cancel Order"
                        >
                          {cancellingOrders.has(order.id) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Order ID:</span>
                      <div className="text-white font-mono text-xs">
                        {order.id.slice(-8)}...
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Created:</span>
                      <div className="text-white">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Smart Wallet:</span>
                      <div className="text-white font-mono text-xs">
                        {order.smartWalletAddress?.slice(0, 6)}...{order.smartWalletAddress?.slice(-4)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}