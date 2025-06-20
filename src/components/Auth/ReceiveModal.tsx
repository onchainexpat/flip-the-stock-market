'use client';
import { Copy, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

export default function ReceiveModal({ isOpen, onClose, address }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  if (!mounted || !isOpen || !address) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
      onClick={onClose}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="bg-[#1B2236] rounded-2xl p-8 w-full max-w-md relative" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">Receive</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeCanvas
              value={address}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-white font-medium text-center">Your Base Address</h3>
          
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
            <span className="text-gray-300 font-mono text-sm break-all flex-1">
              {address}
            </span>
            <button
              onClick={copyAddress}
              className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
              title="Copy address"
            >
              {copied ? (
                <span className="text-green-400 text-xs">Copied!</span>
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Warning Message */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">$</span>
              </div>
              <div className="space-y-1">
                <p className="text-gray-200 text-sm">
                  This address can ONLY receive <span className="text-blue-400 font-medium">Native USDC</span> from Base. 
                  Sending invalid USDC or tokens from other networks will result in lost funds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}