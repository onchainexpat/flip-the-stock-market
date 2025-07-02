'use client';

import { AlertCircle, ArrowRight, Repeat, Shield, X, Zap } from 'lucide-react';

interface DCACreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  orderDetails: {
    totalAmount: string;
    frequency: string;
    duration: string;
    amountPerOrder: string;
    numberOfOrders: number;
    platformFee: string;
    netAmount: string;
  };
  isLoading?: boolean;
}

export default function DCACreationModal({
  isOpen,
  onClose,
  onConfirm,
  orderDetails,
  isLoading = false,
}: DCACreationModalProps) {
  if (!isOpen) return null;

  const getFrequencyDisplay = (frequency: string) => {
    switch (frequency) {
      case 'hourly':
        return 'Every Hour';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return frequency;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 relative animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <Repeat size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Create DCA Order
            </h3>
            <p className="text-sm text-gray-400">Set up automated investing</p>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Investment</span>
              <span className="text-white font-medium">
                ${orderDetails.totalAmount}
              </span>
            </div>

            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Frequency</span>
                <span className="text-white">
                  {getFrequencyDisplay(orderDetails.frequency)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-400">Duration</span>
                <span className="text-white">{orderDetails.duration} days</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-400">Total Orders</span>
                <span className="text-white">
                  {orderDetails.numberOfOrders}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Amount per Order</span>
                <span className="text-white">
                  ${orderDetails.amountPerOrder}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Platform Fee (0.1%)</span>
                <span className="text-orange-400">
                  -${orderDetails.platformFee}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Net Investment</span>
                <span className="text-green-400 font-medium">
                  ${orderDetails.netAmount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Gas Fees</span>
                <span className="text-green-400 font-medium">
                  Sponsored (FREE)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Steps */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <Zap className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="text-blue-400 font-medium mb-2">
                What happens next?
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold text-xs mt-0.5">
                    1.
                  </span>
                  <p className="text-gray-300">
                    <span className="font-medium">
                      Send USDC to Smart Wallet
                    </span>
                    <br />
                    Transfer ${orderDetails.totalAmount} from your wallet to
                    enable automated trading
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold text-xs mt-0.5">
                    2.
                  </span>
                  <p className="text-gray-300">
                    <span className="font-medium">
                      Create Automation Session
                    </span>
                    <br />
                    Generate session key for automated DCA execution over{' '}
                    {orderDetails.duration} days
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Shield className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="text-green-400 font-medium mb-1">
                Smart Wallet Benefits
              </p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• All gas fees sponsored - completely free</li>
                <li>• Automated execution without manual signatures</li>
                <li>• SPX6900 delivered directly to your main wallet</li>
                <li>• Cancel or pause anytime from the dashboard</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-6">
          <div className="flex gap-2 items-start">
            <AlertCircle
              className="text-orange-400 flex-shrink-0 mt-0.5"
              size={16}
            />
            <p className="text-xs text-orange-400">
              You'll see 2 wallet signature requests. Both are required to set
              up automated DCA investing.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                Create DCA Order
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
