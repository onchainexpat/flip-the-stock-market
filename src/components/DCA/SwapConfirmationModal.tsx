'use client';

import { AlertCircle, ArrowRight, DollarSign, Shield, X } from 'lucide-react';

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  swapDetails: {
    orderId: string;
    fromToken: string;
    toToken: string;
    exchangeRate: string;
    router: string;
    slippage: string;
    needsApproval?: boolean;
  };
  isLoading?: boolean;
}

export default function SwapConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  swapDetails,
  isLoading = false,
}: SwapConfirmationModalProps) {
  if (!isOpen) return null;

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
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Confirm DCA Swap
            </h3>
            <p className="text-sm text-gray-400">Review transaction details</p>
          </div>
        </div>

        {/* Swap Details */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Order ID</span>
              <span className="text-white font-mono text-sm">
                {swapDetails.orderId}
              </span>
            </div>

            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">From</span>
                <span className="text-white font-medium">
                  {swapDetails.fromToken}
                </span>
              </div>
              <div className="flex items-center justify-center my-2">
                <ArrowRight size={16} className="text-gray-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">To</span>
                <span className="text-white font-medium">
                  {swapDetails.toToken}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Exchange Rate</span>
                <span className="text-white">{swapDetails.exchangeRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Router</span>
                <span className="text-white font-mono text-sm">
                  {swapDetails.router}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Slippage</span>
                <span className="text-orange-400">{swapDetails.slippage}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Gas</span>
                <span className="text-green-400 font-medium">
                  Sponsored (FREE)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">SPX Delivery</span>
                <span className="text-purple-400 font-medium">
                  Your external wallet ✓
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Shield className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="text-blue-400 font-medium mb-2">
                What happens next?
              </p>
              {swapDetails.needsApproval ? (
                <div className="space-y-2">
                  <p className="text-gray-300">
                    You'll need to sign <span className="font-semibold text-white">2 transactions</span>:
                  </p>
                  <div className="ml-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span className="text-gray-300">USDC spending approval</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span className="text-gray-300">Execute the swap</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    Both signatures authorize your smart wallet to complete this specific swap.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-300">
                    You'll need to sign <span className="font-semibold text-white">1 transaction</span> to execute the swap.
                  </p>
                  <p className="text-gray-400 text-xs">
                    USDC approval already exists. The signature will authorize your smart wallet to execute this specific swap.
                  </p>
                </div>
              )}
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
              The next screen will show a wallet signature request. This is
              normal and required to execute the swap through your smart wallet.
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
                Processing...
              </>
            ) : (
              <>
                Confirm Swap
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
