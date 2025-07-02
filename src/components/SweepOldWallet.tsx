'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { http, createPublicClient } from 'viem';
import { base } from 'viem/chains';
import { useAccount } from 'wagmi';

const OLD_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function SweepOldWallet() {
  const { address } = useAccount();
  const [isSweeping, setIsSweeping] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const checkBalance = async () => {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: [
          {
            constant: true,
            inputs: [{ name: '_owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: 'balance', type: 'uint256' }],
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [OLD_SMART_WALLET],
      });

      const balanceFormatted = (Number(balance) / 1000000).toFixed(2);
      setBalance(balanceFormatted);
      console.log(`💰 Old smart wallet USDC balance: ${balanceFormatted} USDC`);
    } catch (error) {
      console.error('Error checking balance:', error);
      toast.error('Failed to check balance');
    }
  };

  const sweepFunds = async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsSweeping(true);

    try {
      console.log('🧹 Starting sweep from old smart wallet...');
      console.log('📍 Old smart wallet:', OLD_SMART_WALLET);
      console.log('📍 Your external wallet:', address);

      // For now, we'll provide manual instructions since we need the original session
      toast.error('Manual sweep required - see console for instructions', {
        duration: 10000,
      });

      console.log('⚠️ MANUAL SWEEP INSTRUCTIONS:');
      console.log('1. Open MetaMask or your wallet');
      console.log('2. Go to a DeFi interface like DeBank (debank.com)');
      console.log('3. Connect your external wallet');
      console.log('4. Add/import the old smart wallet as a "contract wallet"');
      console.log(`   Smart wallet address: ${OLD_SMART_WALLET}`);
      console.log(
        '5. Transfer the USDC from smart wallet to your external wallet',
      );
      console.log(`   From: ${OLD_SMART_WALLET}`);
      console.log(`   To: ${address}`);
      console.log(`   Amount: ${balance} USDC`);
      console.log(
        '6. Or use the old smart wallet interface if you still have access',
      );
    } catch (error) {
      console.error('Sweep error:', error);
      toast.error('Sweep failed - see console for manual instructions');
    } finally {
      setIsSweeping(false);
    }
  };

  return (
    <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
      <h4 className="text-yellow-300 font-medium mb-2">
        💰 Old Smart Wallet Recovery
      </h4>
      <div className="text-yellow-200 text-sm space-y-2">
        <p>Your previous smart wallet has USDC that needs to be recovered:</p>
        <div className="bg-yellow-900/30 p-2 rounded font-mono text-xs">
          {OLD_SMART_WALLET}
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkBalance}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded"
          >
            Check Balance
          </button>
          {balance && (
            <button
              onClick={sweepFunds}
              disabled={isSweeping || balance === '0.00'}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-xs rounded"
            >
              {isSweeping ? 'Sweeping...' : `Sweep ${balance} USDC`}
            </button>
          )}
        </div>
        {balance && (
          <p className="text-yellow-300 font-medium">Balance: {balance} USDC</p>
        )}
      </div>
    </div>
  );
}
