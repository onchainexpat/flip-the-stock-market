'use client';

import { useEthersProvider, useEthersSigner } from '@/lib/ethers';
import { OpenOceanDCAService } from '@/services/openOceanDCAService';
import { usePrivy } from '@privy-io/react-auth';
import type { ethers } from 'ethers';
import { useState } from 'react';

export default function OpenOceanDCATestPage() {
  const [usdcAmount, setUsdcAmount] = useState(10);
  const [intervalHours, setIntervalHours] = useState(1);
  const [numberOfBuys, setNumberOfBuys] = useState(5);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const provider = useEthersProvider();
  const signer = useEthersSigner();
  const { login, authenticated } = usePrivy();

  const handleCreateOrder = async () => {
    if (!provider || !signer) {
      setError('Please connect your wallet');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const dcaService = new OpenOceanDCAService();
      const orderResult = await dcaService.createSPXDCAOrder({
        provider: provider as ethers.BrowserProvider,
        usdcAmount,
        intervalHours,
        numberOfBuys,
      });
      setResult(orderResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">OpenOcean DCA Test</h1>
      {authenticated ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Total USDC Amount
            </label>
            <input
              type="number"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Interval (hours)
            </label>
            <input
              type="number"
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number of Buys
            </label>
            <input
              type="number"
              value={numberOfBuys}
              onChange={(e) => setNumberOfBuys(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleCreateOrder}
            disabled={isLoading || !provider || !signer}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Creating Order...' : 'Create DCA Order'}
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Login
        </button>
      )}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
      {result && (
        <div className="mt-4 rounded-md bg-green-50 p-4">
          <h3 className="text-lg font-medium text-green-800">
            Order Created Successfully
          </h3>
          <pre className="mt-2 text-sm text-green-700">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
