'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Filter, ExternalLink, Clock, DollarSign, TrendingUp, Zap, AlertCircle, CheckCircle, Pause, Play, X } from 'lucide-react';
import { useUnifiedDCAProvider } from '@/hooks/useOpenOceanDCAProvider';
import { toast } from 'react-hot-toast';

interface UnifiedDCADashboardProps {
  className?: string;
  onCreateNewOrder?: () => void;
}

type OrderStatus = 'active' | 'completed' | 'cancelled' | 'paused' | 'expired';
type ProviderType = 'smart_wallet' | 'openocean';

interface UnifiedOrder {
  id: string;
  provider: ProviderType;
  orderHash?: string;
  userAddress: string;
  totalAmount: string;
  executedAmount: string;
  status: OrderStatus;
  executionsCount: number;
  createdAt: number;
  nextExecutionAt: number;
  expiresAt: number;
  // Smart wallet specific
  frequency?: string;
  totalExecutions?: number;
  sessionKeyAddress?: string;
  // OpenOcean specific
  intervalSeconds?: number;
  numberOfBuys?: number;
  remainingMakerAmount?: string;
  openOceanStatus?: number;
}

export function UnifiedDCADashboard({ 
  className = '',
  onCreateNewOrder
}: UnifiedDCADashboardProps) {
  const { getMyOrders, cancelOpenOceanOrder } = useUnifiedDCAProvider();
  
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<UnifiedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load orders
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would fetch from the unified API
      // For now, we'll simulate with OpenOcean orders
      const openOceanOrders = await getMyOrders();
      
      // Transform OpenOcean orders to unified format
      const unifiedOrders: UnifiedOrder[] = openOceanOrders.map(order => ({
        id: order.id || order.orderHash,
        provider: 'openocean' as const,
        orderHash: order.orderHash,
        userAddress: order.userAddress,
        totalAmount: order.totalAmount?.toString() || '0',
        executedAmount: order.executedAmount?.toString() || '0',
        status: order.status as OrderStatus,
        executionsCount: order.executionsCount || 0,
        createdAt: order.createdAt || Date.now(),
        nextExecutionAt: order.nextExecutionAt || Date.now(),
        expiresAt: order.expiresAt || Date.now(),
        intervalSeconds: order.intervalSeconds,
        numberOfBuys: order.numberOfBuys,
        remainingMakerAmount: order.remainingMakerAmount?.toString(),
        openOceanStatus: order.openOceanStatus,
      }));

      setOrders(unifiedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load DCA orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter orders
  useEffect(() => {
    let filtered = orders;
    
    if (selectedProvider !== 'all') {
      filtered = filtered.filter(order => order.provider === selectedProvider);
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }
    
    setFilteredOrders(filtered);
  }, [orders, selectedProvider, selectedStatus]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, []);

  // Refresh orders
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
    toast.success('Orders refreshed');
  };

  // Cancel order
  const handleCancelOrder = async (order: UnifiedOrder) => {
    if (!order.orderHash) return;
    
    try {
      if (order.provider === 'openocean') {
        await cancelOpenOceanOrder(order.orderHash);
        toast.success('Order cancelled successfully');
      } else {
        // Handle smart wallet cancellation
        toast.info('Smart wallet order cancellation not implemented yet');
      }
      
      // Refresh orders
      await loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(seconds / 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  // Get status color
  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      active: 'text-green-400',
      completed: 'text-blue-400',
      cancelled: 'text-red-400',
      paused: 'text-yellow-400',
      expired: 'text-gray-400'
    };
    return colors[status] || 'text-gray-400';
  };

  // Get provider icon
  const getProviderIcon = (provider: ProviderType) => {
    if (provider === 'openocean') {
      return <TrendingUp className="w-5 h-5 text-purple-400" />;
    }
    return <Zap className="w-5 h-5 text-blue-400" />;
  };

  // Calculate progress
  const calculateProgress = (order: UnifiedOrder) => {
    const executed = parseFloat(order.executedAmount);
    const total = parseFloat(order.totalAmount);
    return total > 0 ? (executed / total) * 100 : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">DCA Dashboard</h1>
          <p className="text-gray-400">
            Manage your Dollar-Cost Averaging orders across all providers
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          {onCreateNewOrder && (
            <button
              onClick={onCreateNewOrder}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create New Order
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-gray-300">Total Invested</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${orders.reduce((sum, order) => sum + parseFloat(order.executedAmount), 0).toFixed(2)}
          </div>
        </div>
        
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Active Orders</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {orders.filter(order => order.status === 'active').length}
          </div>
        </div>
        
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">Total Executions</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {orders.reduce((sum, order) => sum + order.executionsCount, 0)}
          </div>
        </div>
        
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-gray-300">Completed Orders</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {orders.filter(order => order.status === 'completed').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Filters:</span>
        </div>
        
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value as ProviderType | 'all')}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
        >
          <option value="all">All Providers</option>
          <option value="smart_wallet">Smart Wallet</option>
          <option value="openocean">OpenOcean</option>
        </select>
        
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'all')}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="paused">Paused</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No DCA Orders Found</h3>
            <p className="text-gray-400 mb-4">
              {selectedProvider !== 'all' || selectedStatus !== 'all' 
                ? 'No orders match your current filters'
                : 'Create your first DCA order to get started'
              }
            </p>
            {onCreateNewOrder && (
              <button
                onClick={onCreateNewOrder}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create Your First Order
              </button>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
              {/* Order Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getProviderIcon(order.provider)}
                  <div>
                    <div className="font-medium text-white">
                      {order.provider === 'openocean' ? 'OpenOcean DCA' : 'Smart Wallet DCA'}
                    </div>
                    <div className="text-sm text-gray-400">
                      Created {formatTime(order.createdAt)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.toUpperCase()}
                  </span>
                  
                  {order.orderHash && (
                    <a
                      href={`https://basescan.org/tx/${order.orderHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Total Amount</div>
                  <div className="text-lg font-semibold text-white">
                    ${parseFloat(order.totalAmount).toFixed(2)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">Executed</div>
                  <div className="text-lg font-semibold text-white">
                    ${parseFloat(order.executedAmount).toFixed(2)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">Progress</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${calculateProgress(order)}%` }}
                      />
                    </div>
                    <span className="text-sm text-white">
                      {calculateProgress(order).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Executions</div>
                  <div className="text-white">
                    {order.executionsCount}
                    {order.provider === 'openocean' && order.numberOfBuys 
                      ? ` of ${order.numberOfBuys}`
                      : order.totalExecutions 
                      ? ` of ${order.totalExecutions}`
                      : ''
                    }
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">
                    {order.status === 'active' ? 'Next Execution' : 'Last Execution'}
                  </div>
                  <div className="text-white">
                    {formatTime(order.nextExecutionAt)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {order.status === 'active' && (
                  <button
                    onClick={() => handleCancelOrder(order)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel Order
                  </button>
                )}
                
                <button
                  onClick={() => toast.info('Order details modal coming soon')}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}