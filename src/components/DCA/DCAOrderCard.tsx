'use client';
import { Clock, MoreVertical, Pause, Play, Trash2 } from 'lucide-react';

interface DCAOrder {
  id: string;
  amount: number;
  frequency: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  executedCount: number;
  totalInvested: number;
  spx6900Bought: number;
  avgPrice: number;
  nextExecution?: string;
}

interface DCAOrderCardProps {
  order: DCAOrder;
  onAction: (orderId: string, action: 'pause' | 'resume' | 'cancel') => void;
}

export default function DCAOrderCard({ order, onAction }: DCAOrderCardProps) {
  return (
    <div className="border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-medium">
              ${order.amount} {order.frequency}
            </div>
            <div className="text-gray-400 text-sm">
              Created {new Date(order.createdAt).toLocaleDateString()} •{' '}
              {order.executedCount} executions
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-sm rounded-full ${
              order.status === 'active'
                ? 'bg-green-500/20 text-green-400'
                : order.status === 'paused'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <div className="relative group">
            <button className="text-gray-400 hover:text-white p-2">
              <MoreVertical className="w-4 h-4" />
            </button>
            {/* Dropdown menu */}
            <div className="absolute top-full right-0 mt-1 bg-[#1B2236] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <div className="py-1 min-w-[120px]">
                {order.status === 'active' ? (
                  <button
                    onClick={() => onAction(order.id, 'pause')}
                    className="w-full px-3 py-2 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => onAction(order.id, 'resume')}
                    className="w-full px-3 py-2 text-left text-white hover:bg-white/5 flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                )}
                <button
                  onClick={() => onAction(order.id, 'cancel')}
                  className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-400 mb-1">Total Invested</div>
          <div className="text-white font-medium">
            ${order.totalInvested.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">SPX6900 Bought</div>
          <div className="text-white font-medium">
            {order.spx6900Bought.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Avg Price</div>
          <div className="text-white font-medium">
            ${order.avgPrice.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Next Purchase</div>
          <div className="text-blue-400 font-medium">
            {order.nextExecution
              ? new Date(order.nextExecution).toLocaleDateString()
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Mini Performance Chart Placeholder */}
      <div className="mt-4 h-20 bg-white/5 rounded-lg flex items-center justify-center">
        <div className="text-gray-400 text-sm">
          Performance chart coming soon
        </div>
      </div>
    </div>
  );
}
