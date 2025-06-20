'use client';
import { usePrivy } from '@privy-io/react-auth';
import { Info, Play, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { base } from 'viem/chains';
import { useAccount, useBalance } from 'wagmi';

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function DCAQuickSetup() {
  const [amount, setAmount] = useState('50');
  const [frequency, setFrequency] = useState('day');
  const [duration, setDuration] = useState('ongoing');
  const [isCreating, setIsCreating] = useState(false);

  const { authenticated, login } = usePrivy();
  const { address } = useAccount();

  // Get USDC balance
  const { data: usdcBalance } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    chainId: base.id,
  });

  const formatBalance = (balance: bigint | undefined, decimals = 6) => {
    if (!balance) return '0.00';
    const divisor = BigInt(10 ** decimals);
    const quotient = balance / divisor;
    const remainder = balance % divisor;
    const decimal = remainder.toString().padStart(decimals, '0').slice(0, 2);
    return `${quotient}.${decimal}`;
  };

  const handleCreateDCA = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/dca/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number.parseFloat(amount),
          frequency,
          duration,
          userAddress: address,
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('DCA order created:', data);
        // TODO: Show success message or redirect to dashboard
      }
    } catch (error) {
      console.error('Error creating DCA order:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Calculate fees
  const openOceanFee = Number.parseFloat(amount) * 0.001; // 0.1%
  const serviceFee = Number.parseFloat(amount) * 0.0005; // 0.05%
  const totalFees = openOceanFee + serviceFee;

  return (
    <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-6 rounded-xl border border-blue-500/20">
      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Auto-Buy SPX6900
      </h3>
      <p className="text-gray-300 text-sm mb-4">
        Set up dollar cost averaging to buy SPX6900 automatically
      </p>

      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="text-white text-sm mb-2 block">
            Amount per purchase
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white pr-12"
            />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">
              USDC
            </span>
          </div>
          {authenticated && (
            <div className="mt-1 text-xs text-gray-400">
              Balance: {formatBalance(usdcBalance?.value)} USDC
            </div>
          )}
        </div>

        {/* Frequency Selection */}
        <div>
          <label className="text-white text-sm mb-2 block">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white appearance-none"
          >
            <option value="hour">Every Hour</option>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
          </select>
        </div>

        {/* Duration/Limit */}
        <div>
          <label className="text-white text-sm mb-2 block">Duration</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDuration('ongoing')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                duration === 'ongoing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Ongoing
            </button>
            <button
              onClick={() => setDuration('limited')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                duration === 'limited'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Set Limit
            </button>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Platform Fee (OpenOcean)</span>
            <span className="text-white">
              0.1% (~${openOceanFee.toFixed(3)})
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Service Fee</span>
            <span className="text-white">
              0.05% (~${serviceFee.toFixed(3)})
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-white/10 pt-2">
            <span className="text-white font-medium">Total Fees</span>
            <span className="text-white font-medium">
              0.15% (~${totalFees.toFixed(3)})
            </span>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleCreateDCA}
          disabled={isCreating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating Order...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {authenticated ? 'Start Auto-Buying' : 'Login to Start'}
            </>
          )}
        </button>

        {/* Additional Info */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400">
            Gas fees sponsored • Cancel anytime
          </p>
          <button className="text-blue-400 text-xs hover:underline flex items-center justify-center gap-1">
            <Info className="w-3 h-3" />
            Learn about DCA strategy
          </button>
        </div>
      </div>
    </div>
  );
}
