'use client';
import { TrendingUp, BarChart3, Clock, Shield } from 'lucide-react';
import { useState } from 'react';
import SimpleDCA from '../../components/DCA/SimpleDCA';
import DCADashboard from '../../components/DCA/DCADashboard';

export default function InvestPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            SPX6900 Auto-Invest
          </h1>
          <p className="text-gray-400">
            Automated investing made simple. No fees, no complexity.
          </p>
        </div>

        {/* Main Investment Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Investment Setup */}
          <div>
            <SimpleDCA 
              onOrderCreated={() => setRefreshTrigger(prev => prev + 1)}
            />
          </div>

          {/* Investment Dashboard */}
          <div>
            <DCADashboard refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-gray-800/50 rounded-lg">
            <Clock size={32} className="text-blue-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">Automated</h3>
            <p className="text-gray-400 text-sm">Set it and forget it. Your investments run automatically.</p>
          </div>
          <div className="text-center p-6 bg-gray-800/50 rounded-lg">
            <Shield size={32} className="text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">Gas-Free</h3>
            <p className="text-gray-400 text-sm">Zero gas fees. All transactions are sponsored.</p>
          </div>
          <div className="text-center p-6 bg-gray-800/50 rounded-lg">
            <BarChart3 size={32} className="text-purple-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">Smart Wallets</h3>
            <p className="text-gray-400 text-sm">Advanced wallet technology for seamless investing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}