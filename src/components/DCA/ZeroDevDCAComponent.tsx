'use client';

import {
  ArrowRight,
  Calendar,
  CheckCircle,
  DollarSign,
  Loader2,
  Repeat,
  Shield,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { zerodevSmartWalletService } from '../../services/zerodevSmartWalletService';
import DCAOrderHistory from './DCAOrderHistory';

interface ZeroDevDCAComponentProps {
  className?: string;
  onOrderCreated?: () => void;
}

interface DCAStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  txHash?: string;
}

export default function ZeroDevDCAComponent({
  className = '',
  onOrderCreated,
}: ZeroDevDCAComponentProps) {
  const { address: userWalletAddress, isConnected } = useAccount();

  // Form state
  const [formData, setFormData] = useState({
    amount: '10', // Start with 10 USDC for testing
    password: '',
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly',
    duration: 7, // 7 executions
  });

  // Wallet state
  const [walletId, setWalletId] = useState<string | null>(null);
  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(
    null,
  );
  const [usdcBalance, setUSDCBalance] = useState<bigint>(0n);
  const [spxBalance, setSPXBalance] = useState<bigint>(0n);

  // Process state
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [orderHistoryKey, setOrderHistoryKey] = useState(0);
  const [steps, setSteps] = useState<DCAStep[]>([
    {
      id: 'setup',
      title: 'Setup Smart Wallet',
      description: 'Create and configure smart wallet with agent key',
      status: 'pending',
    },
    {
      id: 'session',
      title: 'Create Session Key',
      description: 'Generate and store session key for automated execution',
      status: 'pending',
    },
    {
      id: 'order',
      title: 'Create DCA Order',
      description: 'Register recurring DCA order with automation system',
      status: 'pending',
    },
    {
      id: 'first_execution',
      title: 'First Execution',
      description: 'Execute first DCA swap immediately',
      status: 'pending',
    },
  ]);

  const updateStepStatus = (
    stepId: string,
    status: DCAStep['status'],
    txHash?: string,
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, txHash } : step,
      ),
    );
  };

  // Load existing wallet if available
  useEffect(() => {
    const loadExistingWallet = () => {
      const wallets = zerodevSmartWalletService.listWallets();
      if (wallets.length > 0) {
        const wallet = wallets[0]; // Use first wallet for now
        setWalletId(wallet.walletId);
        setSmartWalletAddress(wallet.smartWalletAddress);
      }
    };

    loadExistingWallet();
  }, []);

  // Load balances
  useEffect(() => {
    const loadBalances = async () => {
      if (!walletId) return;

      try {
        const balances =
          await zerodevSmartWalletService.getWalletBalances(walletId);
        setUSDCBalance(balances.smartWalletUSDC);
        setSPXBalance(balances.userWalletSPX);
      } catch (error) {
        console.error('Failed to load balances:', error);
      }
    };

    loadBalances();
    const interval = setInterval(loadBalances, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [walletId]);

  const createSmartWallet = async () => {
    if (!userWalletAddress || !formData.password) {
      toast.error('Please connect wallet and enter password');
      return;
    }

    try {
      setCurrentStep('setup');
      updateStepStatus('setup', 'in_progress');

      const result = await zerodevSmartWalletService.createSmartWallet(
        userWalletAddress,
        formData.password,
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create smart wallet');
      }

      setWalletId(result.walletConfig!.walletId);
      setSmartWalletAddress(result.walletConfig!.smartWalletAddress);

      updateStepStatus('setup', 'completed');
      toast.success('Smart wallet created successfully!');

      return result.walletConfig!.walletId;
    } catch (error) {
      updateStepStatus('setup', 'error');
      throw error;
    }
  };

  const createDCAOrder = async () => {
    if (!isConnected || !userWalletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!formData.password) {
      toast.error('Please enter your password');
      return;
    }

    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsExecuting(true);

    try {
      // Step 1: Create smart wallet if needed
      let currentWalletId = walletId;
      if (currentWalletId) {
        updateStepStatus('setup', 'completed');
      } else {
        setCurrentStep('setup');
        updateStepStatus('setup', 'in_progress');
        const newWalletId = await createSmartWallet();
        currentWalletId = newWalletId || null;
      }

      if (!currentWalletId) {
        throw new Error('Failed to setup smart wallet');
      }

      // Step 2: Create session key
      setCurrentStep('session');
      updateStepStatus('session', 'in_progress');

      // Get wallet config
      const walletConfig = zerodevSmartWalletService.getWalletConfig(currentWalletId);
      if (!walletConfig) {
        throw new Error('Failed to get wallet configuration');
      }

      // Step 3: Create DCA order
      setCurrentStep('order');
      updateStepStatus('order', 'in_progress');

      const createOrderResponse = await fetch('/api/dca-orders-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: userWalletAddress,
          smartWalletAddress: walletConfig.smartWalletAddress,
          totalAmount: formData.amount,
          frequency: formData.frequency,
          duration: formData.duration,
          // Use an existing session key if available, or create new one
          useExistingSessionKey: true,
          password: formData.password,
        }),
      });

      const orderResult = await createOrderResponse.json();

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create DCA order');
      }

      updateStepStatus('session', 'completed');
      updateStepStatus('order', 'completed');

      const orderId = orderResult.order.id;

      // Step 4: Execute first order immediately
      setCurrentStep('first_execution');
      updateStepStatus('first_execution', 'in_progress');

      const executeResponse = await fetch(`/api/test-force-dca-execution?orderId=${orderId}`);
      const executeResult = await executeResponse.json();

      if (executeResult.success && executeResult.result.success) {
        updateStepStatus('first_execution', 'completed', executeResult.result.txHash);
        
        toast.success(
          `🎉 DCA order created! First execution completed: ${(Number(formData.amount) / formData.duration / 1e6).toFixed(6)} USDC → SPX`,
          { duration: 8000 },
        );

        // Show order details
        toast.success(
          `📅 Order will execute ${formData.frequency} for ${formData.duration} times`,
          { duration: 6000 },
        );
      } else {
        updateStepStatus('first_execution', 'error');
        toast('DCA order created but first execution failed. It will retry automatically.', { icon: '⚠️' });
      }

      setCurrentStep(null);

      // Reset form but keep password
      setFormData({ 
        amount: '10', 
        password: formData.password,
        frequency: 'daily',
        duration: 7,
      });

      // Refresh order history
      setOrderHistoryKey(prev => prev + 1);
      
      if (onOrderCreated) {
        onOrderCreated();
      }

    } catch (error: any) {
      console.error('DCA order creation failed:', error);

      // Mark current step as error
      if (currentStep) {
        updateStepStatus(currentStep, 'error');
      }

      toast.error(
        error instanceof Error ? error.message : 'DCA order creation failed',
      );
    } finally {
      setIsExecuting(false);
      setCurrentStep(null);
    }
  };

  // Calculate balances in human-readable format
  const usdcBalanceFormatted = Number(usdcBalance) / 1e6;
  const spxBalanceFormatted = Number(spxBalance) / 1e8;
  const hasInsufficientBalance =
    Number.parseFloat(formData.amount) > usdcBalanceFormatted;

  if (!isConnected) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <Shield className="mx-auto w-12 h-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Connect Wallet Required
          </h3>
          <p className="text-gray-400">
            Please connect your wallet to use ZeroDev DCA
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">ZeroDev DCA</h3>
          <p className="text-sm text-gray-400">
            Agent-created smart wallet with gas-free transactions
          </p>
        </div>
      </div>

      {/* Wallet Status */}
      {smartWalletAddress && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            Smart Wallet
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Address:</span>
              <span className="text-white font-mono text-xs">
                {smartWalletAddress.slice(0, 6)}...
                {smartWalletAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">USDC Balance:</span>
              <span className="text-white">
                {usdcBalanceFormatted.toFixed(6)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">SPX Balance:</span>
              <span className="text-white">
                {spxBalanceFormatted.toFixed(8)} SPX
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 mb-6">
        {/* Amount Input */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            <DollarSign size={16} className="inline mr-1" />
            Amount (USDC)
          </label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="0.01"
            min="0.01"
            step="0.01"
            className={`w-full p-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
              hasInsufficientBalance
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-600 focus:ring-purple-500'
            }`}
            disabled={isExecuting}
          />
          {hasInsufficientBalance && (
            <p className="text-red-400 text-sm mt-1">
              Insufficient balance. You need {formData.amount} USDC but only
              have {usdcBalanceFormatted.toFixed(6)} USDC.
            </p>
          )}
        </div>

        {/* Frequency and Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              <Repeat size={16} className="inline mr-1" />
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) =>
                setFormData((prev) => ({ 
                  ...prev, 
                  frequency: e.target.value as 'hourly' | 'daily' | 'weekly'
                }))
              }
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isExecuting}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              <Calendar size={16} className="inline mr-1" />
              Executions
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value) || 1 }))
              }
              placeholder="7"
              min="1"
              max="100"
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isExecuting}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            <Shield size={16} className="inline mr-1" />
            Agent Key Password
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            placeholder="Enter secure password for agent key"
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isExecuting}
          />
          <p className="text-gray-400 text-xs mt-1">
            This password encrypts your agent's private key locally
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      {(isExecuting || steps.some((s) => s.status !== 'pending')) && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Progress</h4>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className="relative">
                  {step.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  {step.status === 'in_progress' && (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  )}
                  {step.status === 'error' && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 bg-gray-600 rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      step.status === 'completed'
                        ? 'text-green-400'
                        : step.status === 'in_progress'
                          ? 'text-blue-400'
                          : step.status === 'error'
                            ? 'text-red-400'
                            : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {step.description}
                  </div>
                  {step.txHash && (
                    <a
                      href={`https://basescan.org/tx/${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View Transaction
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="mb-6 p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
        <h4 className="text-purple-300 font-medium mb-3">
          🚀 Automated DCA Features
        </h4>
        <div className="space-y-2 text-sm text-purple-200">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <span>Gas-free transactions with ZeroDev paymaster</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-green-400" />
            <span>Secure session keys for automated execution</span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat size={14} className="text-blue-400" />
            <span>Recurring orders: hourly, daily, or weekly</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-purple-400" />
            <span>Instant first execution + automated future swaps</span>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg mb-6">
        <h4 className="text-purple-300 font-medium mb-2">Order Summary</h4>
        <div className="space-y-1 text-sm text-purple-200">
          <div>Total Amount: {formData.amount} USDC</div>
          <div>Per Execution: {(Number(formData.amount) / formData.duration).toFixed(6)} USDC</div>
          <div>Frequency: {formData.frequency}</div>
          <div>Total Executions: {formData.duration}</div>
        </div>
      </div>

      {/* Execute Button */}
      <button
        onClick={createDCAOrder}
        disabled={
          isExecuting ||
          !formData.amount ||
          !formData.password ||
          hasInsufficientBalance ||
          Number.parseFloat(formData.amount) <= 0 ||
          formData.duration < 1
        }
        className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all duration-200 ${
          isExecuting ||
          !formData.amount ||
          !formData.password ||
          hasInsufficientBalance ||
          formData.duration < 1
            ? 'bg-gray-700 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-[1.02]'
        } flex items-center justify-center gap-2`}
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating DCA Order...
          </>
        ) : (
          <>
            <Repeat size={20} />
            Create DCA Order
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {/* Order History */}
      <DCAOrderHistory 
        key={orderHistoryKey}
        className="mt-6" 
        onOrderUpdate={() => setOrderHistoryKey(prev => prev + 1)}
      />
    </div>
  );
}
