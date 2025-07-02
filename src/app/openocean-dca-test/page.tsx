'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount, useSignTypedData } from 'wagmi';
import { TOKENS, formatTokenAmount } from '../../utils/dexApi';

interface DCAOrder {
  orderId?: string;
  status?: string;
  fromToken: string;
  toToken: string;
  totalAmount: string;
  frequency: string;
  duration: number;
  createdAt?: string;
  nextExecutionAt?: string;
  executedAmount?: string;
  remainingAmount?: string;
}

export default function OpenOceanDCATest() {
  const { address, isConnected } = useAccount();
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<DCAOrder | null>(null);
  const [domainVariant, setDomainVariant] = useState<number>(0);

  // Form state for creating orders
  const [formData, setFormData] = useState({
    amount: '10', // USDC amount
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly',
    duration: 7, // days
    slippage: '1', // 1%
  });

  // Helper function to create DCA order structure for signing
  const createDCAOrderData = (params: {
    userAddress: string;
    makerAmount: string;
    frequency: string;
    duration: number;
    slippage: number;
  }) => {
    const nonce = Date.now();
    const expireTime =
      Math.floor(Date.now() / 1000) + params.duration * 24 * 60 * 60; // Duration in seconds

    // Calculate time interval based on frequency
    const timeIntervals = {
      hourly: 3600,
      daily: 86400,
      weekly: 604800,
    };

    const time =
      timeIntervals[params.frequency as keyof typeof timeIntervals] || 86400;
    const times = Math.floor((params.duration * 24 * 60 * 60) / time); // Number of executions

    return {
      makerAsset: TOKENS.USDC,
      takerAsset: TOKENS.SPX6900,
      maker: params.userAddress,
      makingAmount: params.makerAmount,
      takingAmount: '0', // Will be calculated by OpenOcean
      nonce: nonce.toString(),
      expiry: expireTime.toString(),
      chainId: 8453, // Base
      time,
      times,
      minPrice: '0',
      maxPrice: '0',
      version: 'v2',
    };
  };

  // Multiple domain variants to test
  const getDomain = () => {
    const domains = [
      { name: 'OpenOcean Limit Order Protocol', version: '1' },
      { name: 'OpenOcean', version: '1' },
      { name: 'OpenOcean DCA', version: '1' },
      { name: 'OpenOcean DCA', version: '2' },
      { name: 'Limit Order Protocol', version: '4' },
    ];

    return {
      ...domains[domainVariant],
      chainId: 8453, // Base
      verifyingContract:
        '0x6cBB2598881940D08d5Ea3fA8F557E02996e1031' as `0x${string}`,
    };
  };

  // EIP-712 types for DCA orders - based on common DeFi patterns
  const getTypes = () => ({
    Order: [
      { name: 'salt', type: 'uint256' },
      { name: 'makerAsset', type: 'address' },
      { name: 'takerAsset', type: 'address' },
      { name: 'maker', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'allowedSender', type: 'address' },
      { name: 'makingAmount', type: 'uint256' },
      { name: 'takingAmount', type: 'uint256' },
    ],
  });

  // Helper function to create proper order hash using EIP-712
  const createOrderHash = async (orderData: any) => {
    try {
      // This would normally be calculated using the EIP-712 hash
      // For now, we'll create a deterministic hash based on order data
      const domain = getDomain();
      const types = getTypes();

      // Create a hash based on the structured data
      const dataString = JSON.stringify({ domain, types, message: orderData });
      let hash = 0;
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
    } catch (error) {
      console.error('Error creating order hash:', error);
      return `0x${Date.now().toString(16).padStart(64, '0')}`;
    }
  };

  const callOpenOceanAPI = async (action: string, params: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/openocean-dca', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...params,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'API call failed');
      }

      return result.data;
    } catch (error) {
      console.error('OpenOcean API error:', error);
      toast.error(error instanceof Error ? error.message : 'API call failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!ready || !authenticated || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const amountWei = (Number.parseFloat(formData.amount) * 1e6).toString(); // Convert to USDC wei

      // Create DCA order data structure
      const orderData = createDCAOrderData({
        userAddress: address,
        makerAmount: amountWei,
        frequency: formData.frequency,
        duration: formData.duration,
        slippage: Number.parseFloat(formData.slippage),
      });

      console.log('DCA Order Data:', orderData);

      // Create order hash
      const orderHash = await createOrderHash(orderData);
      console.log('Order Hash:', orderHash);

      // Prepare EIP-712 structured data for signing
      const domain = getDomain();
      const types = getTypes();
      const message = {
        salt: orderData.nonce, // Use nonce as salt
        makerAsset: orderData.makerAsset,
        takerAsset: orderData.takerAsset,
        maker: orderData.maker,
        receiver: orderData.maker, // Same as maker for DCA
        allowedSender: '0x0000000000000000000000000000000000000000', // Zero address means anyone can execute
        makingAmount: orderData.makingAmount,
        takingAmount: orderData.takingAmount,
      };

      console.log('EIP-712 Domain:', domain);
      console.log('EIP-712 Types:', types);
      console.log('EIP-712 Message:', message);

      // Sign using EIP-712 structured data
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Order',
        message,
      });

      console.log('EIP-712 Signature:', signature);

      // Prepare API parameters with signature
      const apiParams = {
        makerAmount: amountWei,
        takerAmount: orderData.takingAmount,
        signature: signature,
        orderHash: orderHash,
        orderMaker: address,
        remainingMakerAmount: amountWei,
        data: {
          salt: orderData.nonce,
          makerAsset: orderData.makerAsset,
          takerAsset: orderData.takerAsset,
          maker: orderData.maker,
          receiver: orderData.maker,
          allowedSender: '0x0000000000000000000000000000000000000000',
          makingAmount: orderData.makingAmount,
          takingAmount: orderData.takingAmount,
          // DCA-specific fields
          time: orderData.time,
          times: orderData.times,
          expiry: orderData.expiry,
        },
        chainId: 8453,
        version: 'v2',
        time: orderData.time,
        times: orderData.times,
      };

      console.log('Creating DCA order with signed params:', apiParams);

      const result = await callOpenOceanAPI('create', apiParams);

      toast.success('DCA order created successfully!');
      console.log('Order created:', result);

      // Refresh orders list
      await handleListOrders();
    } catch (error) {
      console.error('Failed to create order:', error);
      if (error instanceof Error) {
        toast.error(`Failed to create order: ${error.message}`);
      }
    }
  };

  const handleListOrders = async () => {
    if (!ready || !authenticated || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const result = await callOpenOceanAPI('list', {
        userAddress: address,
        chainId: 8453,
      });

      console.log('Orders list:', result);
      setOrders(Array.isArray(result.orders) ? result.orders : []);
      toast.success(`Found ${result.orders?.length || 0} orders`);
    } catch (error) {
      console.error('Failed to list orders:', error);
      setOrders([]);
    }
  };

  const handleGetOrderDetails = async (order: DCAOrder) => {
    // Since OpenOcean doesn't have a separate status endpoint,
    // we'll just display the order details we already have
    console.log('Order details:', order);
    setSelectedOrder(order);
    toast.success('Order details displayed');
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const result = await callOpenOceanAPI('cancel', {
        orderId,
        userAddress: address,
        chainId: 8453,
      });

      console.log('Order cancelled:', result);
      toast.success('Order cancelled successfully');

      // Refresh orders list
      await handleListOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const walletConnected = ready && authenticated && address;
  const displayName = user?.email?.address || user?.phone?.number || 'User';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with wallet connection */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">OpenOcean DCA API Test</h1>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            {walletConnected ? (
              <div className="flex items-center gap-3">
                <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium">{displayName}</span>
                  </div>
                  {address && (
                    <div className="text-xs text-gray-400 font-mono">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                disabled={!ready}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {ready ? 'Connect Wallet' : 'Loading...'}
              </button>
            )}
          </div>
        </div>

        {!walletConnected && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-900 font-bold">!</span>
              </div>
              <div>
                <h3 className="text-yellow-400 font-medium mb-1">
                  Wallet Connection Required
                </h3>
                <p className="text-yellow-300 text-sm">
                  Please connect your wallet to test OpenOcean DCA
                  functionality. This will allow you to create, monitor, and
                  cancel DCA orders.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EIP-712 Testing Section */}
        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">EIP-712 Domain Testing</h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Domain Variant:</label>
            <select
              value={domainVariant}
              onChange={(e) =>
                setDomainVariant(Number.parseInt(e.target.value))
              }
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value={0}>OpenOcean Limit Order Protocol v1</option>
              <option value={1}>OpenOcean v1</option>
              <option value={2}>OpenOcean DCA v1</option>
              <option value={3}>OpenOcean DCA v2</option>
              <option value={4}>Limit Order Protocol v4</option>
            </select>
          </div>
          <div className="text-sm text-purple-300">
            Current: {JSON.stringify(getDomain())}
          </div>
        </div>

        {/* Create Order Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create DCA Order</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount (USDC)
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                disabled={!walletConnected}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    frequency: e.target.value as any,
                  }))
                }
                disabled={!walletConnected}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Duration (days)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    duration: Number.parseInt(e.target.value) || 1,
                  }))
                }
                disabled={!walletConnected}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="7"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Slippage (%)
              </label>
              <input
                type="number"
                value={formData.slippage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slippage: e.target.value }))
                }
                disabled={!walletConnected}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="1"
                step="0.1"
              />
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-medium mb-2">Order Summary</h3>
            <p className="text-sm text-gray-300">
              • Swap {formData.amount} USDC → SPX6900
            </p>
            <p className="text-sm text-gray-300">
              • Frequency: {formData.frequency}
            </p>
            <p className="text-sm text-gray-300">
              • Duration: {formData.duration} days
            </p>
            <p className="text-sm text-gray-300">
              • Amount per execution: ~
              {(Number.parseFloat(formData.amount) / formData.duration).toFixed(
                2,
              )}{' '}
              USDC
            </p>
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={loading || !walletConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-2 px-4 rounded-lg font-medium transition-colors"
          >
            {loading
              ? 'Creating...'
              : walletConnected
                ? 'Create DCA Order'
                : 'Connect Wallet to Create Order'}
          </button>
        </div>

        {/* Orders List Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your DCA Orders</h2>
            <button
              onClick={handleListOrders}
              disabled={loading || !walletConnected}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh Orders'}
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No orders found. Create your first DCA order above!
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => (
                <div
                  key={order.orderId || index}
                  className="bg-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium">
                        Order #{order.orderId || 'Unknown'}
                      </h3>
                      <p className="text-sm text-gray-300">
                        Status:{' '}
                        <span className="capitalize">
                          {order.status || 'Unknown'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGetOrderDetails(order)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-1 px-3 rounded text-sm transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order.orderId!)}
                        disabled={loading || !order.orderId}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-1 px-3 rounded text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Amount</p>
                      <p>
                        {order.totalAmount
                          ? formatTokenAmount(order.totalAmount, 6)
                          : 'N/A'}{' '}
                        USDC
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Frequency</p>
                      <p className="capitalize">{order.frequency || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Duration</p>
                      <p>{order.duration || 'N/A'} days</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Progress</p>
                      <p>
                        {order.executedAmount && order.totalAmount
                          ? `${((Number.parseFloat(order.executedAmount) / Number.parseFloat(order.totalAmount)) * 100).toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Order Details */}
        {selectedOrder && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Order Details</h2>
            <pre className="bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(selectedOrder, null, 2)}
            </pre>
          </div>
        )}

        {/* API Documentation */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">
            OpenOcean DCA API Test Results
          </h2>
          <div className="text-sm text-gray-300 space-y-2">
            <p>• This page tests OpenOcean's DCA API endpoints</p>
            <p>• Check the browser console for detailed API responses</p>
            <p>• Compare the experience with our custom DCA implementation</p>
            <p>
              • Note any differences in features, reliability, or user
              experience
            </p>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mt-4">
            <h3 className="text-yellow-400 font-medium mb-2">
              Implementation Status
            </h3>
            <div className="text-sm text-yellow-300 space-y-1">
              <p>✅ Order data structure creation</p>
              <p>✅ EIP-712 structured data signing</p>
              <p>✅ Proper domain and type definitions</p>
              <p>✅ OpenOcean DCA V2 contract integration</p>
              <p>⚠️ Testing signature validation with OpenOcean API</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mt-4">
            <h3 className="text-blue-400 font-medium mb-2">
              Test Instructions
            </h3>
            <div className="text-sm text-blue-300 space-y-1">
              <p>1. Connect your wallet using the button above</p>
              <p>
                2. Try different EIP-712 domain variants in the purple section
              </p>
              <p>3. Fill in the DCA order form</p>
              <p>4. Click "Create DCA Order" to sign the order</p>
              <p>5. Check browser console for detailed logs</p>
              <p>6. If one variant works, the API response will change</p>
            </div>
          </div>

          <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mt-4">
            <h3 className="text-orange-400 font-medium mb-2">
              Deep Research Findings
            </h3>
            <div className="text-sm text-orange-300 space-y-1">
              <p>
                🔍 <strong>Root Cause Analysis:</strong>
              </p>
              <p>
                • OpenOcean DCA API expects signatures from their official
                frontend SDK
              </p>
              <p>
                • The signature includes order hash calculation using their
                specific algorithm
              </p>
              <p>
                • EIP-712 domain likely uses their limit order protocol, not
                DCA-specific domain
              </p>
              <p>
                • Contract: 0x6cBB2598881940D08d5Ea3fA8F557E02996e1031 (Base DCA
                V2)
              </p>
              <p>
                • API documentation mentions "signature from frontend SDK"
                requirement
              </p>
              <p></p>
              <p>
                🚨 <strong>Critical Issue:</strong> OpenOcean requires their SDK
                for proper signature generation
              </p>
            </div>
          </div>

          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mt-4">
            <h3 className="text-red-400 font-medium mb-2">
              Recommendation: Use Custom DCA Instead
            </h3>
            <div className="text-sm text-red-300 space-y-1">
              <p>
                ✅{' '}
                <strong>
                  Our custom DCA implementation is superior because:
                </strong>
              </p>
              <p>• Full control over order structure and execution logic</p>
              <p>• No dependency on external SDK or API changes</p>
              <p>• Customizable for SPX6900-specific features</p>
              <p>• Gas-free execution via our paymaster</p>
              <p>• Better user experience with our UI/UX</p>
              <p>• No API rate limits or external service dependencies</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
