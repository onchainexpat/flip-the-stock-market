'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { encodeFunctionData } from 'viem';
import { erc20Abi } from 'viem';
import { useAccount } from 'wagmi';
import { useUnifiedSmartWallet } from '../../hooks/useUnifiedSmartWallet';

export default function TestSmartWallet() {
  const { address } = useAccount();
  const { login, logout, authenticated, user, connectWallet } = usePrivy();
  const {
    address: smartWalletAddress,
    walletType,
    hasGasSponsorship,
    isLoading,
    error,
    sendTransaction: sendSmartWalletTransaction,
    isReady,
  } = useUnifiedSmartWallet();

  const [txHash, setTxHash] = useState<string>('');
  const [testError, setTestError] = useState<string>('');

  // Debug the hook state
  console.log('🔍 HOOK DEBUG:', {
    externalWalletAddress: address,
    authenticated,
    smartWalletAddress,
    isReady,
    hasGasSponsorship,
    walletType,
    error,
    userWallets: user?.linkedAccounts?.length,
    isLoading,
  });

  // Force smart wallet address for testing (based on console logs)
  const testSmartWalletAddress =
    smartWalletAddress || '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
  const canTest = authenticated && address;

  const testSimpleTransfer = async () => {
    try {
      setTestError('');
      setTxHash('');

      console.log('Starting simple ETH transfer test...');

      // Test 1: Simple ETH transfer (0 ETH to self)
      const hash = await sendSmartWalletTransaction({
        to: testSmartWalletAddress as `0x${string}`,
        value: 0n,
        data: '0x',
      });

      setTxHash(hash);
      console.log('✅ Simple transfer successful:', hash);
    } catch (error: any) {
      console.error('❌ Simple transfer failed:', error);
      setTestError(error.message);
    }
  };

  const testUSDCTransfer = async () => {
    try {
      setTestError('');
      setTxHash('');

      console.log('Starting USDC transfer test...');

      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const transferAmount = BigInt(1000); // 0.001 USDC

      // Encode transfer of 0.001 USDC to self
      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [smartWalletAddress as `0x${string}`, transferAmount],
      });

      const hash = await sendSmartWalletTransaction({
        to: USDC_ADDRESS,
        value: 0n,
        data: transferData,
      });

      setTxHash(hash);
      console.log('✅ USDC transfer successful:', hash);
    } catch (error: any) {
      console.error('❌ USDC transfer failed:', error);
      setTestError(error.message);
    }
  };

  const testApproval = async () => {
    try {
      setTestError('');
      setTxHash('');

      console.log('Starting USDC approval test...');

      const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
      const approvalAmount = BigInt(1000000); // 1 USDC

      // Encode approval
      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, approvalAmount],
      });

      const hash = await sendSmartWalletTransaction({
        to: USDC_ADDRESS,
        value: 0n,
        data: approvalData,
      });

      setTxHash(hash);
      console.log('✅ USDC approval successful:', hash);
    } catch (error: any) {
      console.error('❌ USDC approval failed:', error);
      setTestError(error.message);
    }
  };

  if (!authenticated) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Smart Wallet Test</h1>
        <div className="text-center">
          <p className="mb-4">
            Please log in to test smart wallet functionality
          </p>
          <button
            onClick={login}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Log In with Privy
          </button>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Smart Wallet Test</h1>
        <div className="text-center">
          <p className="mb-4">Please connect an external wallet</p>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded mr-4"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Smart Wallet Test</h1>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <span>
            <strong>Authentication:</strong>{' '}
            {authenticated ? 'Logged in' : 'Not logged in'}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Logout
          </button>
        </div>
        <div>
          <strong>External Wallet:</strong> {address}
        </div>
        <div>
          <strong>Smart Wallet:</strong> {smartWalletAddress || 'Not available'}
        </div>
        <div>
          <strong>Is Ready:</strong> {isReady ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Wallet Type:</strong> {walletType || 'Unknown'}
        </div>
        <div>
          <strong>Gas Sponsorship:</strong>{' '}
          {hasGasSponsorship ? 'Available' : 'Not available'}
        </div>
        <div>
          <strong>Connected Wallets:</strong>{' '}
          {user?.linkedAccounts?.length || 0}
        </div>
        {error && (
          <div className="text-red-600">
            <strong>Wallet Error:</strong> {error}
          </div>
        )}

        {!smartWalletAddress && address && (
          <div className="mt-4 p-4 bg-yellow-100 rounded">
            <p className="mb-2">
              Smart wallet not detected. This might be because:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>You're not connected via Privy's wallet interface</li>
              <li>Smart wallet initialization is still in progress</li>
              <li>ZeroDev configuration issue</li>
            </ul>
            <button
              onClick={connectWallet}
              className="mt-2 px-4 py-2 bg-orange-600 text-white rounded"
            >
              Try Connect Different Wallet
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <button
          onClick={testSimpleTransfer}
          disabled={isLoading || !canTest}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 disabled:hover:bg-blue-600"
        >
          Test 1: Simple Transfer (0 ETH to self)
          {!canTest && <span className="ml-2 text-xs">(Login required)</span>}
        </button>

        <button
          onClick={testUSDCTransfer}
          disabled={isLoading || !canTest}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50 hover:bg-green-700 disabled:hover:bg-green-600"
        >
          Test 2: USDC Transfer (0.001 USDC to self)
          {!canTest && <span className="ml-2 text-xs">(Login required)</span>}
        </button>

        <button
          onClick={testApproval}
          disabled={isLoading || !canTest}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg disabled:opacity-50 hover:bg-purple-700 disabled:hover:bg-purple-600"
        >
          Test 3: USDC Approval (1 USDC to Permit2)
          {!canTest && <span className="ml-2 text-xs">(Login required)</span>}
        </button>
      </div>

      {isLoading && (
        <div className="mt-4 p-4 bg-yellow-100 rounded">Loading...</div>
      )}

      {txHash && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <strong>Success!</strong>
          <br />
          Transaction Hash: {txHash}
          <br />
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            View on BaseScan
          </a>
        </div>
      )}

      {(testError || error) && (
        <div className="mt-4 p-4 bg-red-100 rounded">
          <strong>Error:</strong>
          <br />
          {testError || error}
        </div>
      )}
    </div>
  );
}
