'use client';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, Info, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface BuyUSDCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Offer {
  id: string;
  venmoHandle: string;
  rate: string;
  available: number;
  fees: number;
  reputation?: number;
  completedTrades?: number;
}

export default function BuyUSDCModal({ isOpen, onClose }: BuyUSDCModalProps) {
  const [amount, setAmount] = useState('100');
  const [selectedOffer, setSelectedOffer] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { authenticated } = usePrivy();
  const { address } = useAccount();

  console.log('BuyUSDCModal render, isOpen:', isOpen);

  // Fetch offers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOffers();
    }
  }, [isOpen, amount]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/zkp2p/offers?amount=${amount}`);
      const data = await response.json();
      if (data.success) {
        setOffers(data.offers);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedOfferData = offers[selectedOffer];
  const totalFees =
    (Number.parseFloat(amount) * (selectedOfferData?.fees || 0)) / 100;
  const totalReceived = Number.parseFloat(amount) - totalFees;
  const memo = `zkp2p-${Math.random().toString(36).substr(2, 6)}`;

  const createTransaction = async () => {
    if (!authenticated || !address || !selectedOfferData) {
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/zkp2p/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offerId: selectedOfferData.id,
          amount: Number.parseFloat(amount),
          userAddress: address,
          venmoHandle: selectedOfferData.venmoHandle,
          memo,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // TODO: Navigate to transaction status page or show success
        console.log('Transaction created:', data.transaction);
        onClose();
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="bg-[#1B2236] rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#1B2236', zIndex: 10000 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Buy USDC with Venmo</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="text-white text-sm mb-2 block">
              Amount to buy
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white pr-12"
              />
              <span className="absolute right-3 top-3 text-gray-400">USDC</span>
            </div>
          </div>

          {/* Available Offers */}
          <div>
            <label className="text-white text-sm mb-2 block">
              Available offers
            </label>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="ml-2 text-gray-400">Loading offers...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {offers.map((offer, index) => (
                  <button
                    key={offer.id}
                    onClick={() => setSelectedOffer(index)}
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      selectedOffer === index
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-left">
                        <div className="text-white font-medium">
                          {offer.venmoHandle}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Rate: {offer.rate} USDC per $1 • {offer.fees}% fee
                        </div>
                        {offer.reputation && (
                          <div className="text-green-400 text-xs">
                            ⭐ {offer.reputation} ({offer.completedTrades}{' '}
                            trades)
                          </div>
                        )}
                      </div>
                      <div className="text-green-400 text-sm">
                        Available: ${offer.available}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Transaction Details */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Transaction Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount to send via Venmo</span>
                <span className="text-white">${amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">
                  Platform fees ({selectedOfferData?.fees}%)
                </span>
                <span className="text-white">${totalFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-white font-medium">
                  USDC you'll receive
                </span>
                <span className="text-white font-medium">
                  {totalReceived.toFixed(2)} USDC
                </span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <h4 className="text-blue-400 font-medium">How it works:</h4>
            </div>
            <ol className="text-sm text-gray-300 space-y-1 ml-6">
              <li>
                1. Send ${amount} to {selectedOfferData?.venmoHandle} on Venmo
              </li>
              <li>2. Use memo: "{memo}"</li>
              <li>3. USDC will arrive in your wallet (2-5 minutes)</li>
              <li>4. Zero-knowledge proof ensures trustless transaction</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={createTransaction}
              disabled={creating || !authenticated || !selectedOfferData}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Transaction...</span>
                </>
              ) : (
                <>
                  <span>Open Venmo to Send Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400 text-center">
            No gas fees • Powered by zkp2p protocol • Trustless via
            zero-knowledge proofs
          </p>
        </div>
      </div>
    </div>
  );
}
