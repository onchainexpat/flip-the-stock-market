'use client';
import { Copy, Info, X } from 'lucide-react';
import * as QRCode from 'qrcode-generator';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  displayName?: string;
}

export default function ReceiveModal({
  isOpen,
  onClose,
  address,
  displayName,
}: ReceiveModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAddressCopied, setIsAddressCopied] = useState(false);

  // Generate QR code when modal opens
  useEffect(() => {
    if (isOpen && canvasRef.current && address) {
      const qr = QRCode(0, 'M');
      qr.addData(address);
      qr.make();

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellSize = 4;
      const margin = 20;
      const moduleCount = qr.getModuleCount();
      const canvasSize = moduleCount * cellSize + 2 * margin;

      canvas.width = canvasSize;
      canvas.height = canvasSize;

      // Background
      ctx.fillStyle = '#1f2937'; // Dark background
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // QR Code
      ctx.fillStyle = '#ffffff'; // White foreground
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              col * cellSize + margin,
              row * cellSize + margin,
              cellSize,
              cellSize,
            );
          }
        }
      }
    }
  }, [isOpen, address]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setIsAddressCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setIsAddressCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  const truncateAddress = (addr: string, start = 6, end = 4) => {
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Receive</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code */}
        <div className="p-6 flex flex-col items-center">
          <div className="bg-gray-800 p-4 rounded-2xl mb-6">
            <canvas
              ref={canvasRef}
              className="rounded-lg"
              style={{ width: '200px', height: '200px' }}
            />
          </div>

          {/* Address Section */}
          <div className="w-full">
            <h3 className="text-lg font-medium text-white mb-2">
              Your Base Address
            </h3>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-mono text-sm break-all mr-2">
                  {address}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isAddressCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                  }`}
                  title="Copy address"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
              <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium text-sm mb-1">
                  This address can ONLY receive Native USDC from Base.
                </p>
                <p className="text-blue-300/80 text-sm">
                  Sending invalid USDC or tokens from other networks will result
                  in lost funds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
