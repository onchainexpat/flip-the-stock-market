'use client';
// Removed Privy - now using Coinbase Smart Wallet SDK
import {
  CheckCircle,
  Clock,
  DollarSign,
  Pause,
  Play,
  RefreshCw,
  Timer,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi';
// Removed useSmartWallet - using direct Coinbase Smart Wallet integration
import { formatTokenAmount } from '../../utils/0xApi';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';
// SmartWalletWarning removed - smart wallets deployed automatically with Coinbase SDK

// Extend window object for pending DCA swaps
declare global {
  interface Window {
    pendingDcaSwap?: {
      orderId: string;
      transaction: {
        to: `0x${string}`;
        data: `0x${string}`;
        value: bigint;
        gas?: bigint;
      };
      usdcAmount: string;
      needsSwapAfterApproval?: boolean;
    };
  }
}

interface DCAOrder {
  id: string;
  userAddress: string;
  totalAmount: string;
  frequency: string;
  status:
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled'
    | 'insufficient_balance';
  executionsRemaining: number;
  totalExecutions: number;
  executedAmount: string;
  nextExecutionAt: string;
  createdAt: string;
  amountPerOrder: string;
}

interface DCAExecution {
  id: string;
  orderId: string;
  transactionHash: string;
  amountIn: string;
  amountOut: string;
  executedAt: string;
  status: 'pending' | 'completed' | 'failed';
  swapProvider?: string;
  exchangeRate?: string;
  gasUsed?: string;
  gasPrice?: string;
  priceImpact?: string;
  tradeDetails?: any; // To hold extra details from API
}

interface UserStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalInvested: string;
  totalExecutions: number;
}

interface DCADashboardProps {
  refreshTrigger?: number;
}

interface CountdownTimerProps {
  targetDate: string;
}

function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setIsExpired(false);
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (isExpired) {
    return (
      <div className="flex items-center gap-1 text-orange-400">
        <Timer className="w-3 h-3" />
        <span className="text-xs">Overdue</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-blue-400">
      <Timer className="w-3 h-3" />
      <span className="text-xs font-mono">
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {timeLeft.hours.toString().padStart(2, '0')}:
        {timeLeft.minutes.toString().padStart(2, '0')}:
        {timeLeft.seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export default function DCADashboard({ refreshTrigger }: DCADashboardProps) {
  // Helper to serialize BigInt values for localStorage
  const serializeBigInt = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        result[key] = serializeBigInt(obj[key]);
      }
      return result;
    }
    return obj;
  };

  const { address, isConnected } = useAccount();
  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
  } = useSendTransaction();
  
  // Smart wallet for executing transactions
  const {
    sendTransaction: sendSmartWalletTransaction,
    isLoading: smartWalletLoading,
    address: smartWalletAddress,
    isReady: smartWalletReady,
  } = useUnifiedSmartWallet();
  const [orders, setOrders] = useState<DCAOrder[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [executions, setExecutions] = useState<Record<string, DCAExecution[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;
  const [selectedExecution, setSelectedExecution] = useState<DCAExecution | null>(null);

  // Wait for transaction receipt
  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({
      hash: pendingTxHash || undefined,
    });

  const loadExecutionDetails = useCallback(async (execution: DCAExecution) => {
    if (selectedExecution?.id === execution.id) {
      setSelectedExecution(null);
      return;
    }

    // Reset previous selection
    setSelectedExecution(null);
    toast.loading('Fetching trade details...', { id: `exec-${execution.id}` });

    try {
      const response = await fetch(
        `/api/dca-orders/${execution.orderId}/executions/${execution.id}?userAddress=${address}`
      );
      if (response.ok) {
        const details = await response.json();
        setSelectedExecution(details);
        toast.success('Details loaded', { id: `exec-${execution.id}` });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load execution details');
      }
    } catch (error) {
      console.error('Error loading execution details:', error);
      toast.error(`Could not load trade details: ${error instanceof Error ? error.message : ''}`, { id: `exec-${execution.id}` });
      // Still show basic info if details fail to load
      setSelectedExecution(execution);
    }
  }, [address, selectedExecution]);


  const loadExecutions = useCallback(
    async (orderId: string) => {
      try {
        const executionsResponse = await fetch(
          `/api/dca-orders/${orderId}/executions?userAddress=${address}`,
        );
        if (executionsResponse.ok) {
          const executionsResult = await executionsResponse.json();
          setExecutions((prev) => ({
            ...prev,
            [orderId]: executionsResult.executions || [],
          }));
        }
      } catch (error) {
        console.error(`Error loading executions for order ${orderId}:`, error);
      }
    },
    [address],
  );

  // Fetch executions when an order is selected
  useEffect(() => {
    if (selectedOrder) {
      loadExecutions(selectedOrder);
    }
  }, [selectedOrder, loadExecutions]);

  const loadUserData = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Load user orders and stats from API
      const response = await fetch(`/api/dca-orders?userAddress=${address}`);
      if (!response.ok) {
        throw new Error('Failed to load user data');
      }

      const { orders: userOrders, stats: userStats } = await response.json();

      setOrders(userOrders);
      setStats(userStats);

      // Load execution history for each order
      const executionsData: Record<string, DCAExecution[]> = {};
      for (const order of userOrders) {
        try {
          const executionsResponse = await fetch(
            `/api/dca-orders/${order.id}/executions?userAddress=${address}`,
          );
          if (executionsResponse.ok) {
            const executionsResult = await executionsResponse.json();
            executionsData[order.id] = executionsResult.executions || [];
            console.log(
              `Loaded ${executionsResult.executions?.length || 0} executions for order ${order.id}`,
            );
          } else {
            console.warn(`Failed to load executions for order ${order.id}`);
            executionsData[order.id] = [];
          }
        } catch (error) {
          console.error(
            `Error loading executions for order ${order.id}:`,
            error,
          );
          executionsData[order.id] = [];
        }
      }
      setExecutions(executionsData);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      loadUserData();
    }
  }, [isConnected, address, loadUserData]);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && isConnected && address) {
      loadUserData();
    }
  }, [refreshTrigger, isConnected, address, loadUserData]);

  // Handle transaction hash becoming available
  useEffect(() => {
    if (txHash) {
      console.log('Transaction hash received:', txHash);

      // Validate the hash format
      if (!txHash.startsWith('0x') || txHash.length !== 66) {
        console.error('Invalid transaction hash format:', txHash);
        toast.error('Invalid transaction hash received');
        return;
      }

      setPendingTxHash(txHash);
      toast.dismiss(); // Dismiss any pending toasts

      // Swap data is now stored directly during transaction submission

      // Create custom toast with BaseScan link
      const basescanUrl = `https://basescan.org/tx/${txHash}`;
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Transaction submitted, waiting for confirmation...
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    <a
                      href={basescanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500 underline"
                    >
                      View on BaseScan ↗
                    </a>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>
        ),
        {
          id: `confirm-${txHash}`,
          duration: 300000, // 5 minutes
        },
      );
    }
  }, [txHash]);

  // Handle transaction confirmation
  useEffect(() => {
    if (receipt && pendingTxHash) {
      console.log('Transaction confirmed:', { receipt, pendingTxHash });

      const handleTransactionConfirmation = async () => {
        try {
          const pendingSwapData = localStorage.getItem('pendingSwap');
          console.log('Pending swap data:', pendingSwapData);

          if (!pendingSwapData) {
            console.warn('No pending swap data found');
            return;
          }

          const swapInfo = JSON.parse(pendingSwapData);
          console.log('Swap info:', swapInfo);

          if (swapInfo.hash !== pendingTxHash) {
            console.warn('Hash mismatch:', {
              swapInfoHash: swapInfo.hash,
              pendingTxHash,
            });
            return;
          }

          // Dismiss all pending toast messages for this order
          toast.dismiss(`${swapInfo.orderId}-confirm`);
          toast.dismiss(`${swapInfo.orderId}-sign`);
          toast.dismiss(`${swapInfo.orderId}-submit`);

          if (receipt.status === 'success') {
            // Check if this was an approval transaction that needs a follow-up swap
            if (swapInfo.needsSwapAfterApproval && swapInfo.swapTransaction) {
              console.log(
                'Approval confirmed! Now submitting swap transaction...',
              );

              toast.success('Approval confirmed! Now submitting swap...', {
                id: swapInfo.orderId,
                duration: 3000,
              });

              // Clear the approval flag and submit the actual swap
              localStorage.removeItem('pendingSwap');
              setPendingTxHash(null);

              // Get fresh swap quote after approval, then submit swap
              setTimeout(async () => {
                try {
                  toast.loading('Getting fresh swap quote...', {
                    id: `${swapInfo.orderId}-quote-refresh`,
                  });

                  // Get fresh swap quote since the old one might be stale
                  // Use the same provider as the initial quote to maintain consistency
                  const swapProvider = 'openocean'; // Must match the initial quote provider
                  const swapEndpoint = swapProvider === 'openocean' ? '/api/openocean-swap' : 
                                      swapProvider === 'uniswap' ? '/api/uniswap-direct' :
                                      '/api/0x-swap';

                  console.log(`🔄 Getting fresh quote from ${swapProvider}...`);

                  const freshSwapResponse = await fetch(swapEndpoint, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      sellToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
                      buyToken: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', // SPX6900
                      sellAmount: Math.floor(parseFloat(swapInfo.usdcAmount) * 1e6).toString(), // Convert to USDC wei
                      takerAddress: smartWalletAddress || '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE', // Smart wallet address
                      slippagePercentage: 0.015, // 1.5% slippage
                    }),
                  });

                  if (!freshSwapResponse.ok) {
                    throw new Error('Failed to get fresh swap quote');
                  }

                  const freshSwapData = await freshSwapResponse.json();
                  console.log('Fresh swap data:', freshSwapData);

                  toast.dismiss(`${swapInfo.orderId}-quote-refresh`);

                  const swapTxHash = await sendSmartWalletTransaction({
                    to: freshSwapData.to as `0x${string}`,
                    data: freshSwapData.data,
                    value: BigInt(freshSwapData.value || '0'),
                  });

                  // Store swap data for confirmation
                  const swapData = {
                    hash: swapTxHash,
                    orderId: swapInfo.orderId,
                    usdcAmount: swapInfo.usdcAmount,
                    spxAmount: swapInfo.spxAmount,
                    amountIn: swapInfo.amountIn,
                    amountOut: swapInfo.amountOut,
                    swapProvider: swapInfo.swapProvider,
                    priceImpact: swapInfo.priceImpact,
                    needsSwapAfterApproval: false,
                  };
                  localStorage.setItem('pendingSwap', JSON.stringify(serializeBigInt(swapData)));
                  setPendingTxHash(swapTxHash as `0x${string}`);

                  toast.loading('Swap transaction submitted...', {
                    id: `${swapInfo.orderId}-swap`,
                  });
                } catch (error) {
                  console.error('Failed to submit swap transaction:', error);
                  toast.error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }, 2000); // Slightly longer delay to ensure approval is processed

              return; // Exit here, don't record execution yet
            }

            console.log('Recording execution...');

            // Update the order execution in the backend
            const recordResponse = await fetch(
              `/api/dca-orders/${swapInfo.orderId}/record-execution`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userAddress: address,
                  txHash: pendingTxHash,
                  amountIn: swapInfo.amountIn,
                  amountOut: swapInfo.amountOut,
                  swapProvider: swapInfo.swapProvider || 'openocean',
                  priceImpact: swapInfo.priceImpact || '0',
                }),
              },
            );

            if (!recordResponse.ok) {
              const errorText = await recordResponse.text();
              console.error('Failed to record execution:', errorText);
              throw new Error(`Failed to record execution: ${errorText}`);
            }

            const recordResult = await recordResponse.json();
            console.log('Execution recorded:', recordResult);

            toast.success(
              `DCA executed! Swapped ${swapInfo.usdcAmount} USDC for ${swapInfo.spxAmount} SPX6900`,
              {
                id: swapInfo.orderId,
                duration: 10000,
              },
            );

            // Clean up
            localStorage.removeItem('pendingSwap');
            setPendingTxHash(null);

            // Refresh data
            console.log('Refreshing data...');
            await loadUserData();
            if (selectedOrder === swapInfo.orderId) {
              await loadExecutions(swapInfo.orderId);
            }
          } else {
            console.error('Transaction failed with status:', receipt.status);
            // Dismiss all pending toasts before showing error
            toast.dismiss(`${swapInfo.orderId}-sign`);
            toast.dismiss(`${swapInfo.orderId}-submit`);
            toast.dismiss(`${swapInfo.orderId}-approve`);
            toast.error('Transaction failed', { id: swapInfo.orderId });
            localStorage.removeItem('pendingSwap');
            setPendingTxHash(null);
          }
        } catch (error) {
          console.error('Error handling transaction confirmation:', error);
          // Dismiss all pending toasts before showing error
          const pendingSwapData = localStorage.getItem('pendingSwap');
          if (pendingSwapData) {
            try {
              const swapInfo = JSON.parse(pendingSwapData);
              toast.dismiss(`${swapInfo.orderId}-sign`);
              toast.dismiss(`${swapInfo.orderId}-submit`);
              toast.dismiss(`${swapInfo.orderId}-approve`);
            } catch (e) {
              console.warn('Failed to parse swap data for toast cleanup');
            }
          }
          toast.error('Error processing transaction confirmation');
          // Clean up on error
          localStorage.removeItem('pendingSwap');
          setPendingTxHash(null);
        }
      };

      handleTransactionConfirmation();
    }
  }, [
    receipt,
    pendingTxHash,
    address,
    selectedOrder,
    loadUserData,
    loadExecutions,
  ]);

  const handlePauseOrder = async (orderId: string) => {
    try {
      console.log('Pausing order:', orderId);

      const response = await fetch(`/api/dca-orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pause',
          userAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause order');
      }

      const result = await response.json();
      toast.success('Order paused successfully');
      console.log('Order paused:', result);

      // Refresh the orders list
      await loadUserData();
    } catch (error) {
      console.error('Failed to pause order:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to pause order',
      );
    }
  };

  const handleResumeOrder = async (orderId: string) => {
    try {
      console.log('Resuming order:', orderId);

      const response = await fetch(`/api/dca-orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resume',
          userAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume order');
      }

      const result = await response.json();
      toast.success('Order resumed successfully');
      console.log('Order resumed:', result);

      // Refresh the orders list
      await loadUserData();
    } catch (error) {
      console.error('Failed to resume order:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to resume order',
      );
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (
      !confirm(
        'Are you sure you want to cancel this order? This action cannot be undone.',
      )
    )
      return;

    try {
      console.log('Cancelling order:', orderId);

      const response = await fetch(`/api/dca-orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          userAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel order');
      }

      const result = await response.json();
      toast.success('Order cancelled successfully');
      console.log('Order cancelled:', result);

      // Refresh the orders list
      await loadUserData();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel order',
      );
    }
  };

  const handleManualExecute = async (orderId: string) => {
    try {
      toast.loading('Executing order...', { id: orderId });

      const response = await fetch('/api/dca-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          userAddress: address,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to execute order');
      }

      if (result.success && result.requiresExecution) {
        // Get swap transaction data and execute
        toast.dismiss(orderId);

        try {
          // Get the swap transaction from 0x API
          toast.loading('Getting swap quote...', { id: `${orderId}-quote` });

          // Use OpenOcean for better liquidity aggregation across Base DEXs
          const swapProvider = 'openocean'; // Can be 'openocean', 'uniswap', or '0x'
          const swapEndpoint = swapProvider === 'openocean' ? '/api/openocean-swap' : 
                              swapProvider === 'uniswap' ? '/api/uniswap-direct' :
                              '/api/0x-swap';

          console.log(`🔄 Using ${swapProvider} for swap quote...`);

          const swapResponse = await fetch(swapEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sellToken: result.swapParams.sellToken,
              buyToken: result.swapParams.buyToken,
              sellAmount: result.swapParams.sellAmount,
              takerAddress: result.swapParams.smartWalletAddress || result.swapParams.userAddress,
              slippagePercentage: 0.015, // 1.5% slippage
            }),
          });

          if (!swapResponse.ok) {
            const errorText = await swapResponse.text();
            console.error('0x swap API error:', errorText);
            throw new Error(
              `Failed to get swap quote: ${swapResponse.status} ${errorText}`,
            );
          }

          const swapData = await swapResponse.json();
          console.log('0x swap response:', swapData);

          // SECURITY VALIDATION - Show results to user before signing
          console.log('🛡️ CLIENT-SIDE SECURITY VALIDATION:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          const legitimateRouters = [
            '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', // ExchangeProxy (0x)
            '0xcaf2da315f5a5499299a312b8a86faafe4bad959', // BaseSettler (0x)
            '0x6352a56caadc4f1e25cd6c75970fa768a3304e64', // OpenOcean Exchange V2
          ];
          
          const isLegitimateRouter = legitimateRouters.some(router => 
            router.toLowerCase() === swapData.to?.toLowerCase()
          );
          
          if (isLegitimateRouter) {
            const routerType = swapData.to?.toLowerCase() === '0xdef1c0ded9bec7f1a1670819833240f027b25eff' ? 'ExchangeProxy (0x)' : 
                             swapData.to?.toLowerCase() === '0xcaf2da315f5a5499299a312b8a86faafe4bad959' ? 'BaseSettler (0x)' : 
                             swapData.to?.toLowerCase() === '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' ? 'OpenOcean Exchange V2' :
                             'Other Authorized Contract';
            
            console.log('✅ ROUTER VALIDATION: PASSED');
            console.log('✅ Router Address:', swapData.to);
            console.log('✅ Router Type:', routerType);
            console.log('✅ Security Status: SAFE TO SIGN');
          } else {
            console.warn('⚠️ ROUTER VALIDATION: UNKNOWN ROUTER');
            console.warn('⚠️ Router Address:', swapData.to);
            console.warn('⚠️ Expected one of:', legitimateRouters);
          }
          
          console.log('💰 Transaction Details:');
          console.log('   • Sell Token:', result.swapParams.sellToken);
          console.log('   • Buy Token:', result.swapParams.buyToken);
          console.log('   • Sell Amount:', result.swapParams.sellAmount);
          console.log('   • Gas Estimate:', swapData.gas);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Validate the swap response
          if (!swapData.to || !swapData.data) {
            console.error('Invalid swap response:', swapData);
            throw new Error('Invalid swap response: missing transaction data');
          }

          toast.dismiss(`${orderId}-quote`);

          // Check if we have a wallet
          if (!address) {
            throw new Error('No wallet connected');
          }

          // Display swap details using token info from OpenOcean if available
          const usdcAmount = (Number(swapData.sellAmount) / 1e6).toFixed(2);
          
          // Use token decimals from OpenOcean API response if available
          const spxDecimals = swapData.tokenInfo?.output?.decimals || 8; // Default to 8 if not available
          const spxAmount = (Number(swapData.buyAmount) / (10 ** spxDecimals)).toFixed(2);

          toast.loading(
            `Swapping ${usdcAmount} USDC for ~${spxAmount} SPX6900...`,
            { id: `${orderId}-sign` },
          );

          // Validate swap data before sending transaction
          console.log('Swap data for transaction:', {
            to: swapData.to,
            data: swapData.data,
            value: swapData.value,
            gas: swapData.gas,
            sellAmount: swapData.sellAmount,
            buyAmount: swapData.buyAmount,
          });

          if (!swapData.to || !swapData.data) {
            throw new Error('Invalid swap data: missing transaction details');
          }

          // Check if USDC approval is needed
          // CRITICAL FIX: BaseSettler uses Permit2 for token approvals
          const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
          const isBaseSettler = swapData.to.toLowerCase() === '0xcaf2da315f5a5499299a312b8a86faafe4bad959';
          
          // If using BaseSettler and no allowanceTarget specified, use Permit2
          const allowanceTarget = swapData.allowanceTarget || 
            (isBaseSettler ? PERMIT2_ADDRESS : swapData.to);
          
          console.log('🎯 APPROVAL TARGET LOGIC:');
          console.log('   Router:', swapData.to);
          console.log('   Is BaseSettler:', isBaseSettler);
          console.log('   Original allowanceTarget:', swapData.allowanceTarget);
          console.log('   Final allowanceTarget:', allowanceTarget);
          const sellAmount = swapData.sellAmount;
          const smartWalletAddr = result.swapParams.smartWalletAddress || result.swapParams.userAddress;

          console.log('Checking USDC allowance...', {
            user: smartWalletAddr,
            spender: allowanceTarget,
            amount: sellAmount,
          });

          // DEBUG: Check smart wallet USDC balance
          console.log('🔍 CHECKING SMART WALLET SETUP...');
          console.log('📊 Smart Wallet Address:', smartWalletAddr);
          console.log('📊 USDC Contract:', result.swapParams.sellToken);
          console.log('📊 Required Amount (USDC):', sellAmount);
          console.log('📊 Allowance Target:', allowanceTarget);
          console.log('💡 Check balance at: https://basescan.org/address/' + smartWalletAddr);
          console.log('💡 Amount in human readable:', Number(sellAmount) / 1e6, 'USDC');
          console.log('🎯 Swap Target Contract:', swapData.to);
          console.log('🔐 Transaction will:', 
            swapData.to.toLowerCase() === '0xcaf2da315f5a5499299a312b8a86faafe4bad959' 
              ? '✅ Go to BaseSettler (legitimate 0x contract)' 
              : swapData.to.toLowerCase() === '0x6352a56caadc4f1e25cd6c75970fa768a3304e64'
              ? '✅ Go to OpenOcean Exchange V2 (legitimate aggregator)'
              : '⚠️ Go to unknown contract: ' + swapData.to
          );

          // Check current USDC allowance from smart wallet
          const allowanceResponse = await fetch('/api/check-allowance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAddress: smartWalletAddr, // Use smart wallet address for allowance check
              spenderAddress: allowanceTarget,
              tokenAddress: result.swapParams.sellToken, // USDC address
              amount: sellAmount,
            }),
          });

          if (allowanceResponse.ok) {
            const allowanceResult = await allowanceResponse.json();

            if (!allowanceResult.hasAllowance) {
              toast.loading('Approving USDC spending...', {
                id: `${orderId}-approve`,
              });

              // Need to approve first
              // For testing, let's approve a larger amount to avoid issues
              const approvalAmount = BigInt(sellAmount) * BigInt(10); // 10x the amount for testing
              const approveData = {
                to: result.swapParams.sellToken as `0x${string}`, // USDC contract
                data: `0x095ea7b3${allowanceTarget.slice(2).padStart(64, '0')}${approvalAmount.toString(16).padStart(64, '0')}` as `0x${string}`,
                value: BigInt(0),
              };

              console.log('🔐 APPROVAL DETAILS:');
              console.log('   📍 From (Smart Wallet):', smartWalletAddr);
              console.log('   📍 Token (USDC):', result.swapParams.sellToken);
              console.log('   📍 Spender (AllowanceTarget):', allowanceTarget);
              console.log('   📍 Amount:', sellAmount, '(', Number(sellAmount) / 1e6, 'USDC)');
              console.log('   📍 Swap Router:', swapData.to);
              console.log('   ⚠️ Note: AllowanceTarget vs Router:', 
                allowanceTarget.toLowerCase() === swapData.to.toLowerCase() 
                  ? '✅ SAME ADDRESS' 
                  : `❌ DIFFERENT - Approving ${allowanceTarget} but swapping through ${swapData.to}`
              );
              console.log('Submitting approval transaction...', approveData);

              // Send approval through smart wallet
              const approvalTxHash = await sendSmartWalletTransaction({
                to: approveData.to,
                data: approveData.data,
                value: approveData.value,
              });
              
              // Store approval data for transaction confirmation handling
              const approvalInfo = {
                hash: approvalTxHash,
                orderId,
                usdcAmount,
                spxAmount,
                amountIn: swapData.sellAmount,
                amountOut: swapData.buyAmount,
                swapProvider: swapData.provider || 'openocean',
                priceImpact: swapData.estimatedPriceImpact || '0',
                needsSwapAfterApproval: true,
                swapTransaction: {
                  to: swapData.to as `0x${string}`,
                  data: swapData.data as `0x${string}`,
                  value: BigInt(swapData.value || '0'),
                },
              };
              localStorage.setItem('pendingSwap', JSON.stringify(serializeBigInt(approvalInfo)));
              
              setPendingTxHash(approvalTxHash as `0x${string}`);

              toast.success(
                'Approval submitted! The swap will automatically execute after approval.',
                {
                  id: `${orderId}-approve`,
                  duration: 5000,
                },
              );

              return; // Exit here, swap will happen after approval confirmation
            }
          } else {
            console.warn('Failed to check allowance, proceeding with swap...');
          }

          // Proceed with swap (either allowance exists or check failed)
          try {
            console.log('About to submit transaction with params:', {
              to: swapData.to,
              data: swapData.data?.slice(0, 20) + '...', // Truncate for logging
              value: swapData.value,
              gas: swapData.gas,
            });

            // Send transaction through smart wallet
            const txHash = await sendSmartWalletTransaction({
              to: swapData.to as `0x${string}`,
              data: swapData.data,
              value: BigInt(swapData.value || '0'),
            });
            
            // Store swap data for transaction confirmation handling
            const swapInfo = {
              hash: txHash,
              orderId,
              usdcAmount,
              spxAmount,
              amountIn: swapData.sellAmount,
              amountOut: swapData.buyAmount,
              swapProvider: swapData.provider || 'openocean',
              priceImpact: swapData.estimatedPriceImpact || '0',
              needsSwapAfterApproval: false,
            };
            localStorage.setItem('pendingSwap', JSON.stringify(serializeBigInt(swapInfo)));
            
            // Set the transaction hash for monitoring
            setPendingTxHash(txHash as `0x${string}`);

            console.log('Transaction submission initiated successfully');

            // Show loading toast while waiting for hash
            toast.loading('Submitting transaction...', {
              id: `${orderId}-submit`,
            });
          } catch (txError) {
            console.error('Transaction submission failed:', txError);
            // Dismiss the "Swapping..." toast before showing error
            toast.dismiss(`${orderId}-sign`);
            toast.dismiss(`${orderId}-submit`);
            toast.error(
              `Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`,
              { id: orderId }
            );
            throw new Error(
              `Transaction submission failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`,
            );
          }
          // Transaction data is now stored directly in localStorage during submission
        } catch (error) {
          toast.dismiss(`${orderId}-quote`);
          toast.dismiss(`${orderId}-sign`);
          toast.dismiss(`${orderId}-confirm`);
          throw error;
        }
      } else if (result.success) {
        toast.success('Order executed successfully!', { id: orderId });
        await loadUserData();
      } else {
        throw new Error(result.error || 'Execution failed');
      }
    } catch (error) {
      console.error('Failed to execute order:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to execute order',
        { id: orderId },
      );
    }
  };

  const getStatusIcon = (status: DCAOrder['status']) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4 text-green-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'insufficient_balance':
        return <DollarSign className="w-4 h-4 text-orange-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: DCAOrder['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10';
      case 'paused':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'completed':
        return 'text-blue-400 bg-blue-400/10';
      case 'cancelled':
        return 'text-red-400 bg-red-400/10';
      case 'insufficient_balance':
        return 'text-orange-400 bg-orange-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 border border-gray-700 text-center">
        <h2 className="text-xl font-semibold text-white mb-4">DCA Dashboard</h2>
        <p className="text-gray-400">
          Please connect your wallet to view your DCA orders
        </p>
      </div>
    );
  }

  // With Coinbase Smart Wallet SDK, all connected wallets are smart wallets
  const shouldBlockDCAFeatures = false;

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smart wallet deployment handled automatically by Coinbase SDK */}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Total Orders</span>
            </div>
            <div className="text-xl font-bold text-white">
              {stats.totalOrders}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Active</span>
            </div>
            <div className="text-xl font-bold text-white">
              {stats.activeOrders}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Completed</span>
            </div>
            <div className="text-xl font-bold text-white">
              {stats.completedOrders}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Invested</span>
            </div>
            <div className="text-lg font-bold text-white">
              ${formatTokenAmount(stats.totalInvested, 6)}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Executions</span>
            </div>
            <div className="text-xl font-bold text-white">
              {stats.totalExecutions}
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Your DCA Orders
            </h2>
            <button
              onClick={loadUserData}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">No DCA orders found</p>
            <p className="text-sm text-gray-500 mt-2">
              Create your first DCA order to start dollar-cost averaging into
              SPX6900
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {(() => {
              // Filter and sort orders
              const sortedOrders = orders.sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );

              // Calculate pagination
              const totalPages = Math.ceil(sortedOrders.length / ordersPerPage);
              const startIndex = (currentPage - 1) * ordersPerPage;
              const endIndex = startIndex + ordersPerPage;
              const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

              return (
                <>
                  {/* Orders */}
                  {paginatedOrders.map((order) => (
                    <div key={order.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                ${formatTokenAmount(order.totalAmount, 6)} →
                                SPX6900
                              </span>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                              >
                                {order.status === 'insufficient_balance'
                                  ? 'Insufficient Balance'
                                  : order.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">
                              {order.frequency} • {order.executionsRemaining}/
                              {order.totalExecutions} remaining
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {order.status === 'active' && (
                            <button
                              onClick={() => handlePauseOrder(order.id)}
                              className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                              title="Pause order"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {(order.status === 'paused' ||
                            order.status === 'insufficient_balance') && (
                            <button
                              onClick={() => handleResumeOrder(order.id)}
                              className="p-2 text-green-400 hover:text-green-300 transition-colors"
                              title={
                                order.status === 'insufficient_balance'
                                  ? 'Check balance and resume order'
                                  : 'Resume order'
                              }
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {order.status === 'active' && (
                            <button
                              onClick={() => {
                                if (shouldBlockDCAFeatures) {
                                  toast.error(
                                    'Smart wallet required for DCA execution. Please connect a smart contract wallet.',
                                  );
                                  return;
                                }
                                handleManualExecute(order.id);
                              }}
                              disabled={shouldBlockDCAFeatures}
                              className={`p-2 transition-colors ${
                                shouldBlockDCAFeatures
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-yellow-400 hover:text-yellow-300'
                              }`}
                              title={
                                shouldBlockDCAFeatures
                                  ? 'Smart wallet required for manual execution'
                                  : 'Execute now'
                              }
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          )}

                          {(order.status === 'active' ||
                            order.status === 'paused' ||
                            order.status === 'insufficient_balance') && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors"
                              title="Cancel order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() =>
                              setSelectedOrder(
                                selectedOrder === order.id ? null : order.id,
                              )
                            }
                            className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {selectedOrder === order.id
                              ? 'Hide Details'
                              : 'View Details'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">
                            Amount per order:
                          </span>
                          <div className="text-white font-medium">
                            ${formatTokenAmount(order.amountPerOrder, 6)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Executed:</span>
                          <div className="text-white font-medium">
                            ${formatTokenAmount(order.executedAmount, 6)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Next execution:</span>
                          {order.status !== 'completed' && order.status !== 'cancelled' ? (
                            <>
                              <div className="text-white font-medium">
                                {new Date(order.nextExecutionAt).toLocaleDateString()}{' '}
                                {new Date(order.nextExecutionAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              {new Date(order.nextExecutionAt) < new Date() && order.status === 'active' ? (
                                <div className="text-orange-400 text-xs font-medium animate-pulse">
                                  Overdue - Ready to execute
                                </div>
                              ) : (
                                <CountdownTimer targetDate={order.nextExecutionAt} />
                              )}
                            </>
                          ) : (
                            <div className="text-gray-500">-</div>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-400">Progress:</span>
                          <div className="text-white font-medium">
                            {Math.round(
                              ((order.totalExecutions -
                                order.executionsRemaining) /
                                order.totalExecutions) *
                                100,
                            )}
                            %
                          </div>
                        </div>
                      </div>

                      {/* Insufficient Balance Warning */}
                      {order.status === 'insufficient_balance' && (
                        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <div className="flex items-center gap-2 text-orange-400 text-sm">
                            <DollarSign size={14} />
                            <span className="font-medium">
                              Insufficient USDC Balance
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Your wallet doesn't have enough USDC to continue
                            this DCA order. Add more USDC to your wallet to
                            automatically resume the order.
                          </div>
                        </div>
                      )}

                      {/* Execution History */}
                      {selectedOrder === order.id && (
                        <div className="mt-6 pt-6 border-t border-gray-700">
                          <h3 className="text-lg font-medium text-white mb-4">
                            Execution History
                          </h3>
                          {executions[order.id]?.length === 0 ? (
                            <p className="text-gray-400 text-sm">
                              No executions yet
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {executions[order.id]?.map((execution) => (
                                <div key={execution.id}>
                                  <div
                                    onClick={() => loadExecutionDetails(execution)}
                                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-800"
                                  >
                                    <div className="flex items-center gap-3">
                                      {execution.status === 'completed' ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                      ) : execution.status === 'failed' ? (
                                        <XCircle className="w-4 h-4 text-red-400" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-yellow-400" />
                                      )}
                                      <div>
                                        <div className="text-white text-sm font-medium">
                                          ${formatTokenAmount(execution.amountIn, 6)} USDC
                                        </div>
                                        <div className="text-gray-400 text-xs flex items-center gap-2">
                                          {new Date(execution.executedAt).toLocaleString()}
                                          {execution.swapProvider && (
                                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                                              {execution.swapProvider.toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-white text-sm">
                                        {execution.amountOut !== '0'
                                          ? `${formatTokenAmount(execution.amountOut, 8)} SPX`
                                          : 'Pending...'}
                                      </div>
                                      {execution.transactionHash !== '0x' && (
                                        <a
                                          href={`https://basescan.org/tx/${execution.transactionHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 text-xs hover:underline"
                                        >
                                          View TX
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {selectedExecution?.id === execution.id && (
                                    <div className="p-4 mt-2 bg-gray-900 rounded-lg">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-white">Execution Details</h4>
                                        <div className="flex gap-2">
                                          <a
                                            href={`https://basescan.org/tx/${execution.transactionHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                            BaseScan
                                          </a>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        {/* Basic Execution Info */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Input:</span>
                                            <span className="text-green-400 font-medium">
                                              ${formatTokenAmount(execution.amountIn, 6)} USDC
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Output:</span>
                                            <span className="text-blue-400 font-medium">
                                              {execution.amountOut !== '0'
                                                ? `${formatTokenAmount(execution.amountOut, 8)} SPX`
                                                : 'Pending...'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Exchange Rate:</span>
                                            <span className="text-white">
                                              {execution.exchangeRate 
                                                ? `1 USDC = ${Number(execution.exchangeRate).toFixed(4)} SPX`
                                                : execution.amountOut !== '0' 
                                                ? `1 USDC = ${(Number(execution.amountOut) / 1e8 / (Number(execution.amountIn) / 1e6)).toFixed(4)} SPX`
                                                : 'Calculating...'}
                                            </span>
                                          </div>
                                          {execution.swapProvider && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">DEX:</span>
                                              <span className="text-blue-300 font-medium capitalize">
                                                {execution.swapProvider}
                                              </span>
                                            </div>
                                          )}
                                          {execution.priceImpact && execution.priceImpact !== '0' && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Price Impact:</span>
                                              <span className={`font-medium ${
                                                Number(execution.priceImpact) > 1 ? 'text-red-400' :
                                                Number(execution.priceImpact) > 0.5 ? 'text-yellow-400' : 'text-green-400'
                                              }`}>
                                                {execution.priceImpact}%
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Status:</span>
                                            <span className={`font-medium ${
                                              execution.status === 'completed' ? 'text-green-400' :
                                              execution.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                                            }`}>
                                              {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Transaction Details */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Execution Time:</span>
                                            <span className="text-white">
                                              {new Date(execution.executedAt).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Transaction:</span>
                                            <span className="text-gray-300 font-mono text-xs">
                                              {execution.transactionHash.slice(0, 10)}...{execution.transactionHash.slice(-8)}
                                            </span>
                                          </div>
                                          {selectedExecution.gasUsed && selectedExecution.gasUsed !== '0' && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Gas Used:</span>
                                              <span className="text-white">
                                                {Number(selectedExecution.gasUsed).toLocaleString()}
                                              </span>
                                            </div>
                                          )}
                                          {selectedExecution.gasPrice && selectedExecution.gasPrice !== '0' && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Gas Price:</span>
                                              <span className="text-white">
                                                {(Number(selectedExecution.gasPrice) / 1e9).toFixed(2)} Gwei
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Advanced Details from API */}
                                      {selectedExecution.tradeDetails && (
                                        <div className="mt-4 pt-4 border-t border-gray-700">
                                          <h5 className="text-sm font-medium text-white mb-2">Trade Analysis</h5>
                                          <div className="text-xs text-gray-300 space-y-1">
                                            {selectedExecution.tradeDetails.side && (
                                              <div className="flex justify-between">
                                                <span>Side:</span>
                                                <span>{selectedExecution.tradeDetails.side}</span>
                                              </div>
                                            )}
                                            {selectedExecution.tradeDetails.usdValue && (
                                              <div className="flex justify-between">
                                                <span>USD Value:</span>
                                                <span>${parseFloat(selectedExecution.tradeDetails.usdValue).toFixed(2)}</span>
                                              </div>
                                            )}
                                            {selectedExecution.tradeDetails.fee && (
                                              <div className="flex justify-between">
                                                <span>Protocol Fee:</span>
                                                <span>{selectedExecution.tradeDetails.fee}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        Page {currentPage} of {totalPages} (
                        {sortedOrders.length} total orders)
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1),
                            )
                          }
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 text-sm bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
