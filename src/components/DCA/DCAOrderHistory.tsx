'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  MoreVertical,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';

interface DCAOrder {
  id: string;
  userAddress: string;
  smartWalletAddress: string;
  totalAmount: string;
  amountPerExecution: string;
  totalExecutions: number;
  executionsCompleted: number;
  executionsRemaining: number;
  intervalSeconds: number;
  nextExecutionAt: number | null;
  expiresAt: number;
  createdAt: number;
  status: 'active' | 'completed' | 'cancelled';
  agentKeyId: string;
  lastExecutionHash: string | null;
  totalSpxReceived: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

interface DCAOrderHistoryProps {
  className?: string;
  onOrderUpdate?: () => void;
}

interface CancelModalProps {
  order: DCAOrder;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string, sweepFunds: boolean) => void;
  isLoading: boolean;
}

function CancelModal({ order, isOpen, onClose, onConfirm, isLoading }: CancelModalProps) {
  const [sweepFunds, setSweepFunds] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(order.id, sweepFunds);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Cancel DCA Order</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="text-red-400" size={16} />
              <span className="text-red-400 font-medium">Warning</span>
            </div>
            <p className="text-red-200 text-sm">
              This will permanently cancel your DCA order and stop all future executions.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Order ID:</span>
              <span className="text-white font-mono">{order.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Remaining Amount:</span>
              <span className="text-white">
                {(Number(order.amountPerExecution) * order.executionsRemaining / 1e6).toFixed(6)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Executions Remaining:</span>
              <span className="text-white">{order.executionsRemaining}</span>
            </div>
          </div>

          <div className="p-4 bg-gray-700 rounded-lg">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sweepFunds}
                onChange={(e) => setSweepFunds(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                disabled={isLoading}
              />
              <div>
                <div className="text-white text-sm font-medium">
                  Sweep funds back to your wallet
                </div>
                <div className="text-gray-400 text-xs">
                  Transfer any remaining USDC, SPX, and ETH from the smart wallet back to your original wallet
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Canceling...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Confirm Cancel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeRemaining(nextExecutionAt: number): string {
  const now = Date.now();
  const timeUntil = nextExecutionAt - now;
  
  if (timeUntil <= 0) {
    return 'Due now';
  }
  
  const hours = Math.floor(timeUntil / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatFrequency(intervalSeconds: number): string {
  const hours = intervalSeconds / 3600;
  if (hours === 24) return 'Daily';
  if (hours === 168) return 'Weekly';
  if (hours === 1) return 'Hourly';
  return `Every ${hours}h`;
}

export default function DCAOrderHistory({ className = '', onOrderUpdate }: DCAOrderHistoryProps) {
  const { address: userAddress } = useAccount();
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ order: DCAOrder; isOpen: boolean } | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const fetchOrders = async (page: number = 1) => {
    if (!userAddress) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/dca-order-history?userAddress=${userAddress}&page=${page}&limit=5`
      );
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
        setPagination(data.pagination);
      } else {
        toast.error('Failed to load order history');
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load order history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string, sweepFunds: boolean) => {
    setIsCanceling(true);
    try {
      const response = await fetch('/api/cancel-dca-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userAddress,
          sweepFunds,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('DCA order canceled successfully');
        if (result.sweepResult?.success) {
          toast.success('Funds swept back to your wallet');
        }
        setCancelModal(null);
        fetchOrders(currentPage);
        if (onOrderUpdate) onOrderUpdate();
      } else {
        toast.error(result.error || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setIsCanceling(false);
    }
  };

  useEffect(() => {
    fetchOrders(currentPage);
  }, [userAddress, currentPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (!userAddress) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <Clock className="mx-auto w-12 h-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Connect Wallet Required
          </h3>
          <p className="text-gray-400">
            Please connect your wallet to view order history
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <Clock size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Order History</h3>
            <p className="text-sm text-gray-400">
              Your DCA order history and management
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchOrders(currentPage)}
          disabled={isLoading}
          className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:text-white hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="mx-auto w-12 h-12 text-gray-500 mb-4" />
          <h4 className="text-lg font-medium text-gray-300 mb-2">No Orders Yet</h4>
          <p className="text-gray-400">
            Create your first DCA order to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`bg-gray-800 rounded-lg p-4 border-l-4 ${
                order.status === 'active'
                  ? 'border-green-500'
                  : order.status === 'completed'
                  ? 'border-blue-500'
                  : 'border-red-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white font-medium">
                      {(Number(order.totalAmount) / 1e6).toFixed(2)} USDC → SPX
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'active'
                        ? 'bg-green-900 text-green-300'
                        : order.status === 'completed'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {order.status === 'active' ? (
                        <>
                          <Play size={10} className="inline mr-1" />
                          Active
                        </>
                      ) : order.status === 'completed' ? (
                        <>
                          <CheckCircle size={10} className="inline mr-1" />
                          Completed
                        </>
                      ) : (
                        <>
                          <Pause size={10} className="inline mr-1" />
                          Cancelled
                        </>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Progress:</span>
                      <div className="text-white">
                        {order.executionsCompleted}/{order.totalExecutions}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Frequency:</span>
                      <div className="text-white">
                        {formatFrequency(order.intervalSeconds)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">SPX Received:</span>
                      <div className="text-white">
                        {(Number(order.totalSpxReceived) / 1e18).toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">
                        {order.status === 'active' ? 'Next Execution:' : 'Created:'}
                      </span>
                      <div className="text-white">
                        {order.status === 'active' && order.nextExecutionAt ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeRemaining(order.nextExecutionAt)}
                          </span>
                        ) : (
                          new Date(order.createdAt).toLocaleDateString()
                        )}
                      </div>
                    </div>
                  </div>

                  {order.lastExecutionHash && (
                    <div className="mt-2">
                      <a
                        href={`https://basescan.org/tx/${order.lastExecutionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        View Last Transaction
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {order.status === 'active' && (
                  <div className="ml-4">
                    <button
                      onClick={() => setCancelModal({ order, isOpen: true })}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg"
                      title="Cancel Order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
          <span className="text-sm text-gray-400">
            Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.limit, pagination.totalOrders)} of{' '}
            {pagination.totalOrders} orders
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 bg-purple-600 text-white rounded">
              {pagination.currentPage}
            </span>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <CancelModal
          order={cancelModal.order}
          isOpen={cancelModal.isOpen}
          onClose={() => setCancelModal(null)}
          onConfirm={handleCancelOrder}
          isLoading={isCanceling}
        />
      )}
    </div>
  );
}