'use client';
import { AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TransactionStatusProps {
  transactionId: string;
  amount: string;
  venmoHandle: string;
  memo: string;
}

type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export default function TransactionStatus({
  transactionId,
  amount,
  venmoHandle,
  memo,
}: TransactionStatusProps) {
  const [status, setStatus] = useState<TransactionStatus>('pending');
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Mock status progression
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    // Simulate status changes
    const statusTimer = setTimeout(() => {
      setStatus('processing');
      setTimeout(() => {
        setStatus('completed');
      }, 30000); // Complete after 30 seconds for demo
    }, 10000); // Start processing after 10 seconds

    return () => {
      clearInterval(timer);
      clearTimeout(statusTimer);
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'processing':
        return 'text-blue-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'processing':
        return <Clock className="w-5 h-5 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'completed':
        return 'USDC received successfully!';
      case 'processing':
        return 'Generating zero-knowledge proof...';
      case 'failed':
        return 'Transaction failed. Please try again.';
      default:
        return 'Waiting for Venmo payment confirmation';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#1B2236] rounded-xl p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div
          className={`flex items-center justify-center gap-2 mb-2 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <h3 className="text-lg font-semibold">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </h3>
        </div>
        <p className="text-gray-300 text-sm">{getStatusMessage()}</p>
      </div>

      {/* Transaction Details */}
      <div className="space-y-4 mb-6">
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Amount</span>
            <span className="text-white">${amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Venmo Handle</span>
            <span className="text-blue-400">{venmoHandle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Memo</span>
            <span className="text-white font-mono text-xs">{memo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Time Elapsed</span>
            <span className="text-white">{formatTime(timeElapsed)}</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status !== 'pending' ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            <span
              className={`text-sm ${
                status !== 'pending' ? 'text-white' : 'text-gray-400'
              }`}
            >
              Venmo payment sent
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status === 'processing' || status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-gray-500'
              }`}
            />
            <span
              className={`text-sm ${
                status === 'processing' || status === 'completed'
                  ? 'text-white'
                  : 'text-gray-400'
              }`}
            >
              Generating zero-knowledge proof
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            <span
              className={`text-sm ${
                status === 'completed' ? 'text-white' : 'text-gray-400'
              }`}
            >
              USDC transferred to smart account
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {status === 'completed' && (
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            View in Smart Account
          </button>
        )}

        <button className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          View on Explorer
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
        <p className="text-xs text-blue-200">
          <strong>Having issues?</strong> Make sure you sent the exact amount ($
          {amount}) to {venmoHandle} with memo "{memo}". Contact support if
          payment was sent correctly.
        </p>
      </div>
    </div>
  );
}
