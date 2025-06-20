'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface DCACreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DCACreateModal({ isOpen, onClose, onSuccess }: DCACreateModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slippageLoading, setSlippageLoading] = useState(false);
  const [slippageData, setSlippageData] = useState<{
    slippage: number;
    estimatedTokens: number | null;
    priceImpact: number;
    spxPrice: number | null;
    priceError?: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    frequency: 'daily',
    startDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate order details
  const calculateOrderDetails = () => {
    const totalAmount = parseFloat(formData.totalAmount) || 0;
    const orderSize = parseFloat(formData.amount) || 0;
    
    if (totalAmount === 0 || orderSize === 0) {
      return { orderCount: 0, totalAmount: 0, orderSize: 0 };
    }
    
    const orderCount = Math.floor(totalAmount / orderSize);
    return { orderCount, totalAmount, orderSize };
  };

  // Fetch price and slippage data
  const fetchSlippage = async (amount: string) => {
    if (!amount || parseFloat(amount) === 0) {
      setSlippageData(null);
      return;
    }

    setSlippageLoading(true);
    try {
      // First, get the correct SPX price from CoinGecko API
      const priceResponse = await fetch('/api/coingecko');
      const priceData = await priceResponse.json();
      
      console.log('CoinGecko API response:', priceData);
      
      let spxPrice: number | null = null;
      let estimatedTokens: number | null = null;
      let priceError = false;
      
      // Handle different response formats
      if (priceData.spx6900?.usd) {
        // Direct CoinGecko format
        spxPrice = priceData.spx6900.usd;
      } else if (priceData.data?.current_price) {
        // Our wrapped format
        spxPrice = priceData.data.current_price;
      } else {
        console.error('Failed to fetch SPX price from CoinGecko:', priceData);
        priceError = true;
      }

      if (spxPrice && spxPrice > 0) {
        estimatedTokens = parseFloat(amount) / spxPrice;
      }
      
      console.log('Price calculation result:', {
        spxPrice,
        inputAmount: parseFloat(amount),
        estimatedTokens,
        priceError
      });

      // Try multiple OpenOcean API approaches
      let slippageInfo = { slippage: 0, priceImpact: 0 };
      
      try {
        const chainId = 8453; // Base chain
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const spx6900Address = '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C';
        const amountIn = (parseFloat(amount) * 1e6).toString(); // USDC has 6 decimals
        
        console.log('Trying OpenOcean APIs with params:', {
          chainId,
          usdcAddress,
          spx6900Address,
          amountIn,
          originalAmount: amount
        });

        // Try the standard quote API first
        const quoteUrl = `https://open-api.openocean.finance/v3/${chainId}/quote`;
        const quoteParams = new URLSearchParams({
          inTokenAddress: usdcAddress,
          outTokenAddress: spx6900Address,
          amount: amountIn,
          slippage: '1',
          gasPrice: '5'
        });

        console.log('Fetching from:', `${quoteUrl}?${quoteParams.toString()}`);
        const quoteResponse = await fetch(`${quoteUrl}?${quoteParams.toString()}`);
        const quoteData = await quoteResponse.json();
        console.log('OpenOcean quote response:', quoteData);

        if (quoteData.code === 200 && quoteData.data) {
          // Check if we got a reasonable price from OpenOcean
          const openOceanOut = parseFloat(quoteData.data.outAmount) / 1e8;
          const openOceanPrice = parseFloat(amount) / openOceanOut;
          
          console.log('OpenOcean price calculation:', {
            outAmount: quoteData.data.outAmount,
            openOceanOut,
            openOceanPrice,
            expectedPrice: spxPrice
          });

          // If OpenOcean price is within reasonable range of CoinGecko price, use it
          if (Math.abs(openOceanPrice - spxPrice) / spxPrice < 0.1) { // Within 10%
            console.log('OpenOcean price looks reasonable, using it');
            slippageInfo.slippage = parseFloat(quoteData.data.priceImpact || '0');
            slippageInfo.priceImpact = parseFloat(quoteData.data.priceImpact || '0');
          } else {
            console.log('OpenOcean price differs too much from CoinGecko, using CoinGecko');
          }
        }

        // Try the DCA API if available
        try {
          const dcaUrl = `https://open-api.openocean.finance/dca/v1/${chainId}/estimate`;
          const dcaParams = new URLSearchParams({
            fromToken: usdcAddress,
            toToken: spx6900Address,
            amount: amountIn,
            frequency: '86400', // daily in seconds
            times: '1'
          });

          console.log('Trying DCA API:', `${dcaUrl}?${dcaParams.toString()}`);
          const dcaResponse = await fetch(`${dcaUrl}?${dcaParams.toString()}`);
          const dcaData = await dcaResponse.json();
          console.log('OpenOcean DCA response:', dcaData);

          if (dcaData.code === 200 && dcaData.data) {
            console.log('DCA API worked, got data:', dcaData.data);
          }
        } catch (dcaError) {
          console.log('DCA API not available:', dcaError);
        }

      } catch (slippageError) {
        console.log('OpenOcean API fetch failed:', slippageError);
      }

      setSlippageData({
        slippage: slippageInfo.slippage,
        estimatedTokens: estimatedTokens,
        priceImpact: slippageInfo.priceImpact,
        spxPrice: spxPrice,
        priceError: priceError
      });

    } catch (error) {
      console.error('Error fetching price/slippage:', error);
      setSlippageData(null);
    } finally {
      setSlippageLoading(false);
    }
  };

  // Debounced slippage fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.amount) {
        fetchSlippage(formData.amount);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [formData.amount]);

  const { orderCount, totalAmount, orderSize } = calculateOrderDetails();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implement actual DCA order creation
      console.log('Creating DCA order with data:', formData);
      console.log('Order details:', { orderCount, totalAmount, orderSize });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close modal and refresh data
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating DCA order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-[#1B2236] rounded-2xl p-6 w-full max-w-md relative" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Create DCA Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Total Amount */}
          <div>
            <label className="block text-white font-medium mb-2">
              Total Amount (USDC)
            </label>
            <input
              type="number"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
              placeholder="1000"
              min="1"
              step="0.01"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-gray-400 text-sm mt-1">
              Total amount to invest over time
            </p>
          </div>

          {/* Amount per Order */}
          <div>
            <label className="block text-white font-medium mb-2">
              Amount per Order (USDC)
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="100"
              min="1"
              step="0.01"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-gray-400 text-sm mt-1">
              Amount to invest each interval
            </p>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-white font-medium mb-2">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
              style={{
                colorScheme: 'dark'
              }}
            >
              <option value="hourly" className="bg-[#1B2236] text-white">Every Hour</option>
              <option value="every4hours" className="bg-[#1B2236] text-white">Every 4 Hours</option>
              <option value="every12hours" className="bg-[#1B2236] text-white">Every 12 Hours</option>
              <option value="daily" className="bg-[#1B2236] text-white">Daily</option>
              <option value="weekly" className="bg-[#1B2236] text-white">Weekly</option>
              <option value="monthly" className="bg-[#1B2236] text-white">Monthly</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-white font-medium mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Summary */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="text-blue-400 font-medium mb-2">Order Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Total Investment:</span>
                <span className="font-medium">${formData.totalAmount || '0'} USDC</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Amount per Order:</span>
                <span>${formData.amount || '0'} USDC</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Number of Orders:</span>
                <span className="font-medium">{orderCount} orders</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Frequency:</span>
                <span>{formData.frequency.replace('every', 'Every ').replace('ly', 'ly').replace('hours', ' Hours').replace('hour', ' Hour')}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Target:</span>
                <span>SPX6900 tokens</span>
              </div>

              {/* Price Information */}
              <div className="pt-2 mt-2 border-t border-blue-500/20">
                <div className="flex justify-between text-gray-300">
                  <span>SPX6900 Price:</span>
                  <span>
                    {slippageLoading ? (
                      <span className="text-yellow-400">Loading...</span>
                    ) : slippageData ? (
                      slippageData.priceError || !slippageData.spxPrice ? (
                        <span className="text-red-400">Error</span>
                      ) : (
                        <span className="text-blue-400">${slippageData.spxPrice.toFixed(6)}</span>
                      )
                    ) : (
                      <span className="text-gray-500">--</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Est. Tokens per Order:</span>
                  <span>
                    {slippageLoading ? (
                      <span className="text-yellow-400">Loading...</span>
                    ) : slippageData ? (
                      slippageData.priceError || !slippageData.estimatedTokens ? (
                        <span className="text-red-400">Error</span>
                      ) : (
                        <span className="text-green-400">{slippageData.estimatedTokens.toFixed(4)} SPX</span>
                      )
                    ) : (
                      <span className="text-gray-500">Enter amount</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Slippage per Order:</span>
                  <span>
                    {slippageLoading ? (
                      <span className="text-yellow-400">Calculating...</span>
                    ) : slippageData ? (
                      <span className={slippageData.slippage > 5 ? 'text-red-400' : slippageData.slippage > 2 ? 'text-yellow-400' : 'text-green-400'}>
                        {slippageData.slippage.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-500">--</span>
                    )}
                  </span>
                </div>
                {slippageData && orderCount > 0 && (
                  <div className="flex justify-between text-gray-300">
                    <span>Total Est. Tokens:</span>
                    <span>
                      {slippageData.priceError || !slippageData.estimatedTokens ? (
                        <span className="text-red-400">Error</span>
                      ) : (
                        <span className="text-green-400 font-medium">
                          {(slippageData.estimatedTokens * orderCount).toFixed(4)} SPX
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {orderCount > 0 && (
                <div className="pt-2 mt-2 border-t border-blue-500/20">
                  <div className="flex justify-between text-blue-400 font-medium">
                    <span>Remaining Amount:</span>
                    <span>${((parseFloat(formData.totalAmount) || 0) - (orderCount * (parseFloat(formData.amount) || 0))).toFixed(2)} USDC</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">
              <strong>Note:</strong> DCA orders will automatically execute using your wallet balance. 
              Ensure you have sufficient USDC for scheduled purchases.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.amount || !formData.totalAmount || !formData.startDate || orderCount === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}