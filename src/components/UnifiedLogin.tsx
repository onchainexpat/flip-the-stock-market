'use client';

import { usePrivy } from '@privy-io/react-auth';
import { TrendingUp } from 'lucide-react';

interface UnifiedLoginProps {
  onSuccess?: () => void;
  className?: string;
}

export default function UnifiedLogin({
  onSuccess,
  className = '',
}: UnifiedLoginProps) {
  const { ready, authenticated, login } = usePrivy();

  // If already authenticated, don't show login
  if (authenticated) {
    return null;
  }

  if (!ready) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gray-900 rounded-lg p-6 text-center">
        <div className="mb-4">
          <TrendingUp size={48} className="mx-auto text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          DCA into SPX6900
        </h3>
        <p className="text-gray-400 mb-6">
          Automatically invest in SPX6900 with scheduled purchases
        </p>

        {/* Unified Privy Login Button */}
        <button
          onClick={login}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02]"
        >
          Get Started
        </button>

        <p className="text-gray-400 text-xs mt-3">
          Sign in with email or connect your external wallet
        </p>
      </div>
    </div>
  );
}
