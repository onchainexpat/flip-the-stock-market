'use client';
import { usePrivy } from '@privy-io/react-auth';
import { DollarSign, Settings, TrendingUp, User } from 'lucide-react';
import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';
import { TOKENS } from '../utils/dexApi';
import AddMoneyButton from './AddMoneyButton';

export default function AccountHeader() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { address } = useAccount();

  // Fetch USD balance
  const { data: balanceData } = useReadContracts({
    contracts: [
      {
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 8453,
      },
    ],
    query: {
      enabled: !!address && authenticated,
      refetchInterval: 30000,
    },
  });

  const usdBalance = balanceData?.[0]?.result
    ? Number(balanceData[0].result) / 1e6
    : 0;

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <User size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Welcome back
              {user?.email?.address
                ? `, ${user.email.address.split('@')[0]}`
                : ''}
            </h2>
            <p className="text-sm text-gray-400">SPX6900 Investment Account</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Account Settings"
        >
          <Settings size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Account Balance */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-green-400" />
            <span className="text-sm text-gray-400">Account Balance</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${usdBalance.toFixed(2)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Available for investing</p>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-sm text-gray-400">Quick Actions</span>
          </div>
          <AddMoneyButton className="w-full text-sm py-2" />
        </div>

        {/* Account Status */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-400">Account Status</span>
          </div>
          <div className="text-sm font-medium text-green-400">Active</div>
          <p className="text-xs text-gray-500 mt-1">Ready for auto-investing</p>
        </div>
      </div>
    </div>
  );
}
