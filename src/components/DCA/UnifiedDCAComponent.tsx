'use client';

import React, { useState, useEffect } from 'react';
import { ProviderSelector, DCAProviderType } from './ProviderSelector';
import { OpenOceanDCAForm } from './OpenOceanDCAForm';
import { useUnifiedDCAProvider } from '@/hooks/useOpenOceanDCAProvider';
import { useUnifiedSmartWallet } from '@/hooks/useUnifiedSmartWallet';
import { ArrowLeft, ExternalLink, History } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UnifiedDCAComponentProps {
  className?: string;
  onOrderCreated?: (order: any, provider: DCAProviderType) => void;
  onShowDashboard?: () => void;
  showProviderSelector?: boolean;
  defaultProvider?: DCAProviderType;
}

export function UnifiedDCAComponent({
  className = '',
  onOrderCreated,
  onShowDashboard,
  showProviderSelector = true,
  defaultProvider
}: UnifiedDCAComponentProps) {
  const { recommendation, isSupported } = useUnifiedDCAProvider();
  const { walletType, isEmbedded } = useUnifiedSmartWallet();
  
  const [selectedProvider, setSelectedProvider] = useState<DCAProviderType>(
    defaultProvider || recommendation.recommended
  );
  const [showOrderHistory, setShowOrderHistory] = useState(false);

  // Update provider when recommendation changes
  useEffect(() => {
    if (!defaultProvider) {
      setSelectedProvider(recommendation.recommended);
    }
  }, [recommendation.recommended, defaultProvider]);

  const handleProviderChange = (provider: DCAProviderType) => {
    setSelectedProvider(provider);
    
    // Show informational toast about the provider change
    if (provider === 'smart_wallet') {
      toast.success('Switched to Smart Wallet DCA - Gas-free automated execution');
    } else {
      toast.success('Switched to OpenOcean DCA - Simple setup with manual execution');
    }
  };

  const handleOrderCreated = (order: any) => {
    onOrderCreated?.(order, selectedProvider);
    
    // Show success message with provider-specific information
    if (selectedProvider === 'openocean') {
      toast.success(`OpenOcean DCA order created! Order hash: ${order.orderHash?.slice(0, 8)}...`, {
        duration: 5000,
      });
    } else {
      toast.success('Smart Wallet DCA order created successfully!', {
        duration: 5000,
      });
    }
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  const getProviderSpecificInfo = () => {
    if (selectedProvider === 'openocean') {
      return {
        title: 'OpenOcean DCA',
        description: 'Create automated DCA orders using OpenOcean infrastructure',
        features: [
          'Simple setup process',
          'OpenOcean managed execution',
          'Direct wallet interaction',
          'No smart wallet required'
        ],
        limitations: [
          'User pays gas fees',
          'Minimum $5 order amount',
          'Minimum 60-second intervals'
        ]
      };
    } else {
      return {
        title: 'Smart Wallet DCA',
        description: 'Create gas-free automated DCA orders with smart wallet technology',
        features: [
          'Gas-free execution',
          'Automated execution',
          'Session key security',
          'Flexible intervals'
        ],
        limitations: [
          'Requires smart wallet deployment',
          'More complex setup',
          'Session key management'
        ]
      };
    }
  };

  const providerInfo = getProviderSpecificInfo();

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {providerInfo.title}
            </h1>
            <p className="text-gray-400">
              {providerInfo.description}
            </p>
          </div>
          
          {onShowDashboard && (
            <button
              onClick={onShowDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <History className="w-5 h-5" />
              View Dashboard
            </button>
          )}
        </div>

        {/* Provider Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="font-medium text-green-400 mb-2">Features</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              {providerInfo.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="font-medium text-orange-400 mb-2">Considerations</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              {providerInfo.limitations.map((limitation, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Provider Selector */}
      {showProviderSelector && (
        <ProviderSelector
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          disabled={!isSupported}
        />
      )}

      {/* Provider-Specific Forms */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
        {selectedProvider === 'openocean' ? (
          <OpenOceanDCAForm
            onOrderCreated={handleOrderCreated}
            onError={handleError}
          />
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              Smart Wallet DCA form will be integrated here
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This would use the existing SimpleDCAv2 component with smart wallet integration
            </p>
            <button
              onClick={() => toast.info('Smart wallet DCA integration in progress')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Smart Wallet DCA
            </button>
          </div>
        )}
      </div>

      {/* Help and Documentation */}
      <div className="mt-8 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
        <h3 className="font-medium text-white mb-2">Need Help?</h3>
        <div className="text-sm text-gray-400 space-y-1">
          <p>• DCA (Dollar-Cost Averaging) spreads your purchases over time to reduce price volatility impact</p>
          <p>• Choose the provider that best fits your needs and technical preferences</p>
          <p>• Both providers offer automated execution but with different trade-offs</p>
          <p>• You can switch providers at any time for new orders</p>
        </div>
        
        <div className="flex gap-4 mt-4">
          <a
            href="/docs/dca-guide"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            DCA Guide
          </a>
          <a
            href="/docs/providers"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Provider Comparison
          </a>
        </div>
      </div>

      {/* Wallet Status Warning */}
      {!isSupported && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Wallet Not Supported</span>
          </div>
          <p className="text-sm text-red-300 mt-1">
            Current wallet type ({walletType}) is not supported for DCA operations. 
            Please connect a supported wallet to continue.
          </p>
        </div>
      )}
    </div>
  );
}