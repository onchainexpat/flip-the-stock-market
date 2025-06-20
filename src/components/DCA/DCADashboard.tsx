'use client';
import { usePrivy } from '@privy-io/react-auth';
import {
  Activity,
  ArrowLeft,
  Check,
  Clock,
  DollarSign,
  History,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import LoginButton from '../Auth/LoginButton';
import ProfileDropdown from '../Auth/ProfileDropdown';
import DCACreateModal from './DCACreateModal';

interface DCAOrder {
  id: string;
  amount: number;
  frequency: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  executedCount: number;
  totalInvested: number;
  spx6900Bought: number;
  avgPrice: number;
  nextExecution?: string;
}

interface DCAExecution {
  id: string;
  orderId: string;
  amount: number;
  spx6900Amount: number;
  price: number;
  fees: number;
  executedAt: string;
  txHash: string;
}

export default function DCADashboard() {
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [executions, setExecutions] = useState<DCAExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();

  useEffect(() => {
    if (authenticated && address) {
      fetchDCAData();
    } else {
      setLoading(false);
    }
  }, [authenticated, address]);

  const fetchDCAData = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const [ordersRes, executionsRes] = await Promise.all([
        fetch(`/api/dca/orders?address=${address}`),
        fetch(`/api/dca/history?address=${address}`),
      ]);

      const ordersData = await ordersRes.json();
      const executionsData = await executionsRes.json();

      if (ordersData.success) {
        setOrders(ordersData.orders || []);
      } else {
        console.error('Failed to fetch orders:', ordersData.error);
        setOrders([]); // Set empty array on error
      }

      if (executionsData.success) {
        setExecutions(executionsData.executions || []);
      } else {
        console.error('Failed to fetch executions:', executionsData.error);
        setExecutions([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching DCA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: 'pause' | 'resume' | 'cancel',
  ) => {
    try {
      const response = await fetch(`/api/dca/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      if (data.success) {
        fetchDCAData(); // Refresh data
      }
    } catch (error) {
      console.error(`Error ${action}ing order:`, error);
    }
  };

  // Calculate stats
  const totalInvested = orders.reduce(
    (sum, order) => sum + order.totalInvested,
    0,
  );
  const totalSPX6900 = orders.reduce(
    (sum, order) => sum + order.spx6900Bought,
    0,
  );
  const activeOrders = orders.filter(
    (order) => order.status === 'active',
  ).length;
  const avgBuyPrice = totalSPX6900 > 0 ? totalInvested / totalSPX6900 : 0;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#131827] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Please login to view your DCA dashboard
          </h2>
          <p className="text-gray-400">
            Connect your wallet to manage your dollar cost averaging orders
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131827] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-white">DCA Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New DCA Order
            </button>
            {ready && authenticated ? <ProfileDropdown /> : <LoginButton />}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-300 text-sm">Total Invested</h3>
                    <div className="text-2xl font-bold text-white">
                      ${totalInvested.toFixed(2)}
                    </div>
                    <div className="text-green-400 text-sm">
                      Automated purchases
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-300 text-sm">SPX6900 Holdings</h3>
                    <div className="text-2xl font-bold text-white">
                      {totalSPX6900.toFixed(2)}
                    </div>
                    <div className="text-blue-400 text-sm">Via DCA</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-300 text-sm">Active Orders</h3>
                    <div className="text-2xl font-bold text-white">
                      {activeOrders}
                    </div>
                    <div className="text-blue-400 text-sm">Running</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-6 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-300 text-sm">Avg Buy Price</h3>
                    <div className="text-2xl font-bold text-white">
                      ${avgBuyPrice.toFixed(3)}
                    </div>
                    <div className="text-gray-400 text-sm">DCA average</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active DCA Orders */}
            <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                DCA Orders
              </h2>

              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No DCA orders yet
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Create your first automated purchase to start dollar cost
                    averaging
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-white transition-colors"
                  >
                    Create DCA Order
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              ${order.amount} {order.frequency}
                            </div>
                            <div className="text-gray-400 text-sm">
                              Created{' '}
                              {new Date(order.createdAt).toLocaleDateString()} •{' '}
                              {order.executedCount} executions
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 text-sm rounded-full ${
                              order.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : order.status === 'paused'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1)}
                          </span>
                          <div className="relative group">
                            <button className="text-gray-400 hover:text-white p-2">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Dropdown menu */}
                            <div className="absolute top-full right-0 mt-1 bg-[#1B2236] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                              <div className="py-1 min-w-[120px]">
                                {order.status === 'active' ? (
                                  <button
                                    onClick={() =>
                                      handleOrderAction(order.id, 'pause')
                                    }
                                    className="w-full px-3 py-2 text-left text-white hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <Pause className="w-4 h-4" />
                                    Pause
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleOrderAction(order.id, 'resume')
                                    }
                                    className="w-full px-3 py-2 text-left text-white hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <Play className="w-4 h-4" />
                                    Resume
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleOrderAction(order.id, 'cancel')
                                  }
                                  className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 mb-1">
                            Total Invested
                          </div>
                          <div className="text-white font-medium">
                            ${order.totalInvested.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">
                            SPX6900 Bought
                          </div>
                          <div className="text-white font-medium">
                            {order.spx6900Bought.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">Avg Price</div>
                          <div className="text-white font-medium">
                            ${order.avgPrice.toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">
                            Next Purchase
                          </div>
                          <div className="text-blue-400 font-medium">
                            {order.nextExecution
                              ? new Date(
                                  order.nextExecution,
                                ).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Executions */}
            <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Executions
              </h2>

              {executions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No executions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.slice(0, 5).map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between p-3 border border-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <div className="text-white text-sm">
                            Bought {execution.spx6900Amount.toFixed(2)} SPX6900
                          </div>
                          <div className="text-gray-400 text-xs">
                            {new Date(execution.executedAt).toLocaleString()} •
                            ${execution.amount} →{' '}
                            {execution.spx6900Amount.toFixed(2)} SPX @ $
                            {execution.price.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm">
                          ${execution.fees.toFixed(3)}
                        </div>
                        <div className="text-gray-400 text-xs">fees</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* DCA Create Modal */}
      <DCACreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchDCAData}
      />
    </div>
  );
}
