'use client';

import React, { useState, useEffect } from 'react';
import { useUnifiedDCAProvider } from '@/hooks/useOpenOceanDCAProvider';
import { Clock, DollarSign, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface OpenOceanDCAFormProps {
  onOrderCreated?: (order: any) => void;
  onError?: (error: string) => void;
}

export function OpenOceanDCAForm({ onOrderCreated, onError }: OpenOceanDCAFormProps) {
  const { createOpenOceanOrder, isSupported, walletStatus } = useUnifiedDCAProvider();
  
  const [formData, setFormData] = useState({
    totalAmount: '',
    intervalHours: '24',
    numberOfBuys: '10',
    minPrice: '',
    maxPrice: '',
  });
  
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [orderSummary, setOrderSummary] = useState<any>(null);

  // Calculate derived values
  const totalAmount = parseFloat(formData.totalAmount) || 0;
  const intervalHours = parseFloat(formData.intervalHours) || 24;
  const numberOfBuys = parseInt(formData.numberOfBuys) || 1;
  const perExecutionAmount = totalAmount / numberOfBuys;
  const totalDurationDays = (intervalHours * numberOfBuys) / 24;
  const intervalSeconds = intervalHours * 3600;

  // Validation
  useEffect(() => {
    const errors: Record<string, string> = {};

    if (totalAmount && totalAmount < 5) {
      errors.totalAmount = 'Minimum order amount is $5 USD';
    }

    if (intervalHours && intervalHours < 1/60) {
      errors.intervalHours = 'Minimum interval is 1 minute (0.0167 hours)';
    }

    if (numberOfBuys && (numberOfBuys < 1 || numberOfBuys > 1000)) {
      errors.numberOfBuys = 'Number of buys must be between 1 and 1000';
    }

    if (perExecutionAmount < 0.01) {
      errors.perExecution = 'Per-execution amount too small';
    }

    setValidationErrors(errors);
  }, [totalAmount, intervalHours, numberOfBuys, perExecutionAmount]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateOrder = async () => {
    if (!isSupported) {
      toast.error('OpenOcean DCA not supported with current wallet');
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix validation errors before creating order');
      return;
    }

    setIsCreating(true);
    
    try {
      const order = await createOpenOceanOrder({
        provider: {} as any, // Will be populated by the hook
        usdcAmount: totalAmount,
        intervalHours,
        numberOfBuys,
        minPrice: formData.minPrice || undefined,
        maxPrice: formData.maxPrice || undefined,
      });

      toast.success('OpenOcean DCA order created successfully!');
      onOrderCreated?.(order);
      
      // Reset form
      setFormData({
        totalAmount: '',
        intervalHours: '24',
        numberOfBuys: '10',
        minPrice: '',
        maxPrice: '',
      });
      
    } catch (error) {
      console.error('Error creating OpenOcean DCA order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    if (days < 7) return `${days.toFixed(1)}d`;
    return `${(days / 7).toFixed(1)}w`;
  };

  return (
    <div className="space-y-6">
      {/* Wallet Status */}
      <div className={`p-3 rounded-lg border ${
        isSupported 
          ? 'border-green-500/30 bg-green-500/10' 
          : 'border-red-500/30 bg-red-500/10'
      }`}>
        <div className="flex items-center gap-2">
          {isSupported ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">
            {isSupported ? 'OpenOcean DCA Supported' : 'OpenOcean DCA Not Supported'}
          </span>
        </div>
        <div className="text-sm text-gray-400 mt-1">
          Current wallet: {walletStatus}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Total Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Total Amount (USDC)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={formData.totalAmount}
              onChange={(e) => handleInputChange('totalAmount', e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter total USDC amount"
              min="5"
              step="0.01"
            />
          </div>
          {validationErrors.totalAmount && (
            <div className="text-red-400 text-sm mt-1">{validationErrors.totalAmount}</div>
          )}
        </div>

        {/* Interval Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Interval Between Buys (Hours)
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={formData.intervalHours}
              onChange={(e) => handleInputChange('intervalHours', e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter interval in hours"
              min="0.0167"
              step="0.1"
            />
          </div>
          {validationErrors.intervalHours && (
            <div className="text-red-400 text-sm mt-1">{validationErrors.intervalHours}</div>
          )}
          <div className="text-xs text-gray-400 mt-1">
            Minimum: 1 minute (0.0167 hours)
          </div>
        </div>

        {/* Number of Buys */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Buys
          </label>
          <div className="relative">
            <RefreshCw className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={formData.numberOfBuys}
              onChange={(e) => handleInputChange('numberOfBuys', e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter number of buys"
              min="1"
              max="1000"
              step="1"
            />
          </div>
          {validationErrors.numberOfBuys && (
            <div className="text-red-400 text-sm mt-1">{validationErrors.numberOfBuys}</div>
          )}
        </div>

        {/* Price Range (Optional) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Min Price (Optional)
            </label>
            <input
              type="number"
              value={formData.minPrice}
              onChange={(e) => handleInputChange('minPrice', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Min price"
              step="0.0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Price (Optional)
            </label>
            <input
              type="number"
              value={formData.maxPrice}
              onChange={(e) => handleInputChange('maxPrice', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Max price"
              step="0.0001"
            />
          </div>
        </div>
      </div>

      {/* Order Summary */}
      {totalAmount > 0 && numberOfBuys > 0 && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="font-medium text-white mb-3">Order Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Amount:</span>
              <span className="text-white">${totalAmount.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Per Execution:</span>
              <span className="text-white">${perExecutionAmount.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Frequency:</span>
              <span className="text-white">Every {formatDuration(intervalHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Duration:</span>
              <span className="text-white">{totalDurationDays.toFixed(1)} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Platform Fee:</span>
              <span className="text-white">1% per execution</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gas Fees:</span>
              <span className="text-orange-400">Paid by user</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Execution:</span>
              <span className="text-blue-400">OpenOcean managed</span>
            </div>
            {(formData.minPrice || formData.maxPrice) && (
              <div className="flex justify-between">
                <span className="text-gray-400">Price Range:</span>
                <span className="text-white">
                  {formData.minPrice && `Min: $${formData.minPrice}`}
                  {formData.minPrice && formData.maxPrice && ' - '}
                  {formData.maxPrice && `Max: $${formData.maxPrice}`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Order Button */}
      <button
        onClick={handleCreateOrder}
        disabled={!isSupported || isCreating || Object.keys(validationErrors).length > 0 || !totalAmount}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isSupported && !isCreating && Object.keys(validationErrors).length === 0 && totalAmount
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-gray-600 cursor-not-allowed text-gray-400'
        }`}
      >
        {isCreating ? (
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Creating OpenOcean DCA Order...
          </div>
        ) : (
          'Create OpenOcean DCA Order'
        )}
      </button>

      {/* Disclaimers */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>• OpenOcean DCA orders are executed by OpenOcean's infrastructure</p>
        <p>• You will pay gas fees for each execution</p>
        <p>• Orders can be cancelled through the dashboard</p>
        <p>• Minimum order amount: $5 USD</p>
        <p>• Platform fee: 1% per execution (20% shared with OpenOcean)</p>
      </div>
    </div>
  );
}