'use client';
import { AlertTriangle, Key, Trash2, Wallet, X } from 'lucide-react';
import { formatTokenAmount } from '../../utils/dexApi';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  orderDetails: {
    id: string;
    amountPerOrder: string;
    frequency: string;
    executionsRemaining: number;
    totalAmount: string;
    executedAmount: string;
  };
  isLoading?: boolean;
}

export default function CancelOrderModal({
  isOpen,
  onClose,
  onConfirm,
  orderDetails,
  isLoading = false,
}: CancelOrderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Cancel DCA Order
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-orange-400 font-medium">
                Are you sure you want to cancel this order?
              </p>
              <p className="text-orange-300/70 text-sm">
                This action cannot be undone.
              </p>
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">Order Details</h3>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Amount per execution:</span>
                <span className="text-white font-mono">
                  $
                  {Number.parseFloat(
                    formatTokenAmount(orderDetails.amountPerOrder, 6),
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Frequency:</span>
                <span className="text-white capitalize">
                  {orderDetails.frequency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Executions remaining:</span>
                <span className="text-white">
                  {orderDetails.executionsRemaining}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Remaining value:</span>
                <span className="text-white font-mono">
                  $
                  {Number.parseFloat(
                    formatTokenAmount(
                      (
                        BigInt(orderDetails.totalAmount) -
                        BigInt(orderDetails.executedAmount || '0')
                      ).toString(),
                      6,
                    ),
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">
              What happens when you cancel:
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-sm">
                <Key className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white">
                    Session key expires immediately
                  </span>
                  <p className="text-gray-400">
                    The automated execution permission is revoked
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Wallet className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white">
                    Unused USDC will be automatically returned
                  </span>
                  <p className="text-gray-400">
                    Funds are swept back to your external wallet immediately
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Trash2 className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white">
                    Order is permanently cancelled
                  </span>
                  <p className="text-gray-400">
                    Future executions will not occur
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            disabled={isLoading}
          >
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Cancel Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
