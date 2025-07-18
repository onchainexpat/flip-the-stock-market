'use client';
import { useUnifiedDCAProvider } from '@/hooks/useOpenOceanDCAProvider';
import { Info, TrendingUp, Zap } from 'lucide-react';

export type DCAProviderType = 'smart_wallet' | 'openocean';

interface ProviderSelectorProps {
  selectedProvider: DCAProviderType;
  onProviderChange: (provider: DCAProviderType) => void;
  disabled?: boolean;
}

export function ProviderSelector({
  selectedProvider,
  onProviderChange,
  disabled = false,
}: ProviderSelectorProps) {
  const { recommendation, isSupported, walletStatus } = useUnifiedDCAProvider();

  const providers = [
    {
      id: 'smart_wallet' as const,
      name: 'Smart Wallet DCA',
      description: 'Automated, gas-free execution',
      icon: <Zap className="w-6 h-6" />,
      color: 'blue',
      features: [
        'Gas-free transactions',
        'Automated execution',
        'Session key security',
        'No minimum interval',
      ],
      limitations: ['Smart wallet required', 'More complex setup'],
    },
    {
      id: 'openocean' as const,
      name: 'OpenOcean DCA',
      description: 'Simplified setup, manual execution',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'purple',
      features: [
        'Simple setup',
        'Direct wallet interaction',
        'OpenOcean execution',
        'No smart wallet needed',
      ],
      limitations: [
        'User pays gas',
        'Manual execution',
        '$5 minimum order',
        '60s minimum interval',
      ],
    },
  ];

  const getProviderStyles = (
    providerId: DCAProviderType,
    isSelected: boolean,
  ) => {
    const baseStyles =
      'p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer';

    if (disabled) {
      return `${baseStyles} border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50`;
    }

    if (isSelected) {
      return providerId === 'smart_wallet'
        ? `${baseStyles} border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20`
        : `${baseStyles} border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20`;
    }

    return `${baseStyles} border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50`;
  };

  const getRecommendationBadge = (providerId: DCAProviderType) => {
    if (recommendation.recommended === providerId) {
      return (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
          Recommended
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-white">
          Choose DCA Provider
        </h3>
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            <p className="font-medium mb-1">
              Recommendation: {recommendation.recommended}
            </p>
            <p className="text-gray-300">{recommendation.reason}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`relative ${getProviderStyles(provider.id, selectedProvider === provider.id)}`}
            onClick={() => !disabled && onProviderChange(provider.id)}
          >
            {getRecommendationBadge(provider.id)}

            <div className="flex items-start gap-3 mb-3">
              <div
                className={`${provider.color === 'blue' ? 'text-blue-400' : 'text-purple-400'}`}
              >
                {provider.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">{provider.name}</div>
                <div className="text-sm text-gray-400">
                  {provider.description}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium text-green-400 mb-1">
                  Features:
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  {provider.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-sm font-medium text-orange-400 mb-1">
                  Limitations:
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  {provider.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {selectedProvider === provider.id && (
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg -z-10"></div>
            )}
          </div>
        ))}
      </div>

      {/* Wallet Status and Compatibility */}
      <div className="text-sm text-gray-400 border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between">
          <span>Wallet Status: {walletStatus}</span>
          <span
            className={`${isSupported ? 'text-green-400' : 'text-red-400'}`}
          >
            {isSupported ? 'Compatible' : 'Not Compatible'}
          </span>
        </div>
      </div>

      {/* Provider Comparison Table */}
      <div className="mt-4 text-xs">
        <div className="grid grid-cols-4 gap-2 text-gray-400 font-medium mb-2">
          <div>Feature</div>
          <div>Smart Wallet</div>
          <div>OpenOcean</div>
          <div>Notes</div>
        </div>
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-2">
            <div>Gas Fees</div>
            <div className="text-green-400">Free</div>
            <div className="text-orange-400">User pays</div>
            <div className="text-gray-500">Smart wallet uses paymaster</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>Execution</div>
            <div className="text-green-400">Automated</div>
            <div className="text-blue-400">OpenOcean managed</div>
            <div className="text-gray-500">Both are automated</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>Setup</div>
            <div className="text-orange-400">Complex</div>
            <div className="text-green-400">Simple</div>
            <div className="text-gray-500">
              Smart wallet deployment required
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>Min Amount</div>
            <div className="text-green-400">Any</div>
            <div className="text-orange-400">$5</div>
            <div className="text-gray-500">Base chain requirement</div>
          </div>
        </div>
      </div>
    </div>
  );
}
