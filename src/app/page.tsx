'use client';
import Footer from 'src/components/Footer';
import { useAccount, useBalance, useBlockNumber, useReadContracts } from 'wagmi';
import { 
  type LifecycleStatus,
  Swap, 
  SwapAmountInput, 
  SwapButton, 
  SwapMessage, 
  SwapToggleButton,
  SwapError,
  SwapToast ,
} from '@coinbase/onchainkit/swap'
import type { Token } from '@coinbase/onchainkit/token';
import { FundButton, getOnrampBuyUrl } from '@coinbase/onchainkit/fund';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TransactionReceipt } from 'viem';
import Confetti from 'react-confetti';
import { NEXT_PUBLIC_CDP_PROJECT_ID } from 'src/config';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ProfileGrid from './components/ProfileGrid';
//import LoginButton from '../components/LoginButton';
import html2canvas from 'html2canvas';
import { toast } from 'react-hot-toast';
import React from 'react';
import WalletWrapper from '../components/WalletWrapper';
import { useConnectModal } from '@rainbow-me/rainbowkit';
//import profiles from '../profiles.json';
//import NextImage from 'next/image';

const FALLBACK_DEFAULT_MAX_SLIPPAGE = 3;
const defaultMaxSlippage = 3;

type DuneDataPoint = {
  date: string;
  holders: number;
  percentChange: number;
};

// Define props for the comparison components
interface PriceComparisonProps {
  spxPrice: number | null;
  spxChange: number | null;
  spxMarketCap: number | null;
  snpPrice: number | null;
  snpChange: number | null;
  snpMarketCap: number | null;
  showExtraSection?: boolean;
}

// Helper function to format market cap
const formatMarketCap = (value: number | null): string => {
  if (value === null) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(3)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format price
const formatPrice = (value: number | null, minDecimals = 2, maxDecimals = 2): string => {
  if (value === null) return 'N/A';
   // Adjust decimals for very small prices if needed
  const effectiveMaxDecimals = value > 0 && value < 0.01 ? Math.max(maxDecimals, 4) : maxDecimals;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: effectiveMaxDecimals })}`;
};

// Helper function to format percentage change
const formatChange = (value: number | null): { text: string; color: string } => {
  if (value === null) return { text: '(N/A)', color: 'text-gray-400' };
  const sign = value >= 0 ? '+' : '';
  const color = value >= 0 ? 'text-green-500' : 'text-red-500';
  return { text: `(${sign}${value.toFixed(2)}%)`, color };
};

// Updated PriceComparison component for image generation
const PriceComparison = React.forwardRef<HTMLDivElement, PriceComparisonProps>(({
  spxPrice,
  spxChange,
  spxMarketCap,
  snpPrice,
  snpChange,
  snpMarketCap,
  showExtraSection = false,
}, ref) => {
  const spxChangeFormatted = formatChange(spxChange);
  const snpChangeFormatted = formatChange(snpChange);

  const multiplier = (snpMarketCap && spxMarketCap && spxMarketCap > 0)
    ? snpMarketCap / spxMarketCap
    : null;

  const priceAtSnPMC = (snpMarketCap && spxMarketCap && spxPrice && spxMarketCap > 0)
    ? (snpMarketCap / spxMarketCap) * spxPrice
    : null;

  // Check if this is being rendered for Twitter image (using the ref)
  const isForTwitter = ref !== null;

  return (
    <div
      ref={ref}
      data-price-comparison
      className={`${showExtraSection ? 'h-auto md:h-[350px]' : 'h-auto md:h-[300px]'} w-full max-w-full px-2 md:px-4`}
    >
      <div className={`flex ${isForTwitter ? 'flex-row' : 'flex-col md:flex-row'} justify-between items-center md:items-start mb-4 w-full gap-6 md:gap-0`}>
        {/* SPX6900 Side */}
        <div className={`flex-1 text-white flex flex-col ${isForTwitter ? 'items-center text-center' : 'items-center md:items-start'} w-full md:w-auto`}>
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/spx6900.png"
              alt="SPX6900"
              className="w-6 h-6 md:w-7 md:h-7 mt-10"
            />
            <span className="text-lg md:text-xl font-bold">S&P 6900</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl md:text-3xl font-bold">{formatPrice(spxPrice, 4, 4)}</span>
            <span className={`text-base md:text-lg ${spxChangeFormatted.color}`}>{spxChangeFormatted.text}</span>
          </div>
          <div className="text-sm md:text-base text-gray-300">
            Market Cap: <span className="text-green-400 font-medium">{formatMarketCap(spxMarketCap)}</span>
          </div>
        </div>

        {/* Separator - horizontal for mobile, vertical for desktop */}
        <div className={`${isForTwitter ? 'w-px h-24' : 'w-full h-px md:w-px md:h-24'} bg-gray-800 md:mx-12 self-center`}></div>

        {/* S&P 500 Side */}
        <div className={`flex-1 text-white flex flex-col ${isForTwitter ? 'items-center text-center' : 'items-center md:items-start'} w-full md:w-auto`}>
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/spx500-logo-circle.png"
              alt="S&P 500"
              className="w-6 h-6 md:w-7 md:h-7 mt-10"
            />
            <span className="text-lg md:text-xl font-bold">S&P 500</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span 
              data-snp-price 
              className="text-2xl md:text-3xl font-bold"
            >
              {formatPrice(snpPrice)}
            </span>
            <span 
              data-snp-change
              className={`text-base md:text-lg ${snpChangeFormatted.color}`}
            >
              {snpChangeFormatted.text}
            </span>
          </div>
          <div className="text-sm md:text-base text-gray-300">
            Market Cap: <span className="text-green-400">{formatMarketCap(snpMarketCap)}</span>
          </div>
        </div>
      </div>

      {/* Extra section for Twitter image */}
      {showExtraSection && (
        <div className="mt-3 pt-3 text-center text-white" data-market-cap-section>
          <h3 className="text-base md:text-lg font-semibold mb-3">
            <span className="gold-text">SPX6900</span> WITH THE MARKET CAP OF <span className="gold-text">S&P500</span>
          </h3>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-xl md:text-2xl font-bold">{formatPrice(priceAtSnPMC)}</span>
            {multiplier !== null && (
              <span className="text-sm md:text-base text-green-400 multiplier-text">
                ({multiplier.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// Add a display name for better debugging
PriceComparison.displayName = 'PriceComparison';

// Update the main PriceComparison component to properly handle the ref
const PriceComparisonForImage = () => (
  <div 
    className="flex flex-col md:flex-row w-full justify-center items-center"
    style={{
      width: '100%',
      maxWidth: '600px',
      height: 'auto',
      margin: '0 auto',
      padding: '20px',
      boxSizing: 'border-box',
      background: '#131827'
    }}
  >
    {/* SPX6900 Side */}
    <div className="flex-1 text-white flex flex-col items-center md:items-start w-full md:w-auto mb-4 md:mb-0">
      <div className="flex items-center gap-2 mb-3">
        <img 
          src="/spx6900.png" 
          alt="SPX6900" 
          className="w-6 h-6 md:w-7 md:h-7"
        />
        <span className="text-lg md:text-xl font-bold text-white">S&P 6900</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl md:text-3xl font-bold">$0.4649</span>
        <span className="text-lg text-red-500">(-4.92%)</span>
      </div>
      <div className="text-base text-gray-300">
        Market Cap: <span className="text-green-400">$429.55M</span>
      </div>
    </div>

    <div className="w-px h-24 bg-gray-800 mx-12"></div>

    {/* S&P 500 Side */}
    <div className="flex-1 text-white flex flex-col items-start">
      <div className="flex items-center gap-2 mb-3">
        <img 
          src="/spx500-logo-circle.png" 
          alt="S&P 500" 
          className="w-7 h-7"
        />
        <span className="text-xl font-bold">S&P 500</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold">$5,396.52</span>
        <span className="text-lg text-red-500">(-4.84%)</span>
      </div>
      <div className="text-base text-gray-300">
        Market Cap: <span className="text-green-400">$45.388T</span>
      </div>
    </div>
  </div>
);

// Add the visible, responsive version
const VisiblePriceComparison = () => (
  <div className="flex flex-col sm:flex-row w-full justify-center items-center gap-6 sm:gap-0 p-4 sm:p-6 bg-[#131827] rounded-lg max-w-[600px] mx-auto">
    {/* SPX6900 Side */}
    <div className="flex-1 text-white flex flex-col items-center sm:items-start w-full sm:w-auto">
      <div className="flex items-center gap-2 mb-3">
        <img 
          src="/spx6900.png" 
          alt="SPX6900" 
          className="w-6 h-6 sm:w-7 sm:h-7"
        />
        <span className="text-lg sm:text-xl font-bold">S&P 6900</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl sm:text-3xl font-bold">$0.4678</span>
        <span className="text-sm sm:text-lg text-red-500">(-4.92%)</span>
      </div>
      <div className="text-sm sm:text-base text-gray-300">
        Market Cap: <span className="text-green-400">$432.25M</span>
      </div>
    </div>
    
    {/* Separator - horizontal for mobile, vertical for desktop */}
    <div className="w-full h-px sm:w-px sm:h-20 bg-gray-800 sm:mx-8 self-center my-4 sm:my-0"></div>
    
    {/* S&P 500 Side */}
    <div className="flex-1 text-white flex flex-col items-center sm:items-start w-full sm:w-auto">
      <div className="flex items-center gap-2 mb-3">
        <img 
          src="/spx500-logo-circle.png" 
          alt="S&P 500" 
          className="w-6 h-6 sm:w-7 sm:h-7"
        />
        <span className="text-lg sm:text-xl font-bold">S&P 500</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl sm:text-3xl font-bold">$5,396.52</span>
        <span className="text-sm sm:text-lg text-red-500">(-0.84%)</span>
      </div>
      <div className="text-sm sm:text-base text-gray-300">
        Market Cap: <span className="text-green-400">$45.388T</span>
      </div>
    </div>
  </div>
);

interface Profile {
  platform: string;
  profile_url: string;
  image_url: string;
  username: string;
  description: string;
}

export default function Page() {
  const priceComparisonRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState<'sponsoredBuys' | 'howToBuyVideo' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const confettiImage = useRef<HTMLImageElement | null>(null);

  // Remove backgroundImages state and related code
  const [copyClicked, setCopyClicked] = useState(false);

  const [holdersData, setHoldersData] = useState<DuneDataPoint[]>([]);
  const [spxPrice, setSpxPrice] = useState<number | null>(null);
  const [spx24hChange, setSpx24hChange] = useState<number | null>(null);
  const [spxMarketCap, setSpxMarketCap] = useState<number | null>(null);

  const projectId = 'cc2411f3-9ed7-4da8-a005-711f71b8e8dc';
  const { address } = useAccount();

  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    const fetchSpxPrice = async () => {
      try {
        console.log('Fetching SPX price...');
        const response = await fetch('/api/coingecko');
        const data = await response.json();

        if (!response.ok || data.error) {
          const errorDetails = {
            status: response.status,
            error: data.error,
            details: data.details,
            debug: data.debug,
            stack: data.stack
          };
          console.error('CoinGecko API error:', errorDetails);
          
          if (data.debug) {
            console.log('Environment debug info:', data.debug);
          }
          
          throw new Error(
            data.details?.message || 
            data.details?.body || 
            (typeof data.details === 'string' ? data.details : null) ||
            data.error || 
            'Failed to fetch price'
          );
        }

        if (!data.spx6900?.usd) {
          console.error('Invalid price data format:', data);
          throw new Error('Invalid price data format');
        }

        setSpxPrice(data.spx6900.usd);
        setSpx24hChange(data.spx6900.usd_24h_change);
        setSpxMarketCap(data.spx6900.usd_market_cap);
        console.log('Price data updated successfully:', {
          price: data.spx6900.usd,
          change: data.spx6900.usd_24h_change,
          marketCap: data.spx6900.usd_market_cap
        });
      } catch (error) {
        console.error('Error fetching SPX price:', error);
      }
    };

    fetchSpxPrice();
    const interval = setInterval(fetchSpxPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const onrampBuyUrl = address
    ? getOnrampBuyUrl({
        projectId,
        addresses: { [address]: ['base'] },
        assets: ['USDC'],
        presetFiatAmount: 20,
        fiatCurrency: 'USD'
      })
    : undefined;

  useEffect(() => {
    const updateWindowDimensions = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);

    // Load the confetti image - fixed to use the global Image constructor
    const img = new window.Image();
    img.src = 'spx6900.png';
    img.onload = () => {
      confettiImage.current = img;
    };

    return () => window.removeEventListener('resize', updateWindowDimensions);
  }, []);

  useEffect(() => {
    const fetchHoldersData = async () => {
      try {
        const response = await fetch('/api/holders');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        
        // The data is already formatted correctly by the API
        // We can use it directly without additional transformation
        setHoldersData(data);
      } catch (error) {
        console.error('Error fetching holders data:', error);
      }
    };

    fetchHoldersData();
  }, []);

  const toggleDropdown = (dropdown: 'sponsoredBuys' | 'howToBuyVideo') => {
    if (openDropdown === dropdown) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(dropdown);
    }
  };
 
  // Define token constants with original image URIs
  // NOTE: OnchainKit's Token type might expect 'logoURI' instead of 'image'.
  // If you encounter type errors, you might need to adjust the type definition
  // or use 'logoURI' as the key, keeping the original URL values.

  const ETHToken: Token = {
    address: '', // Or appropriate WETH address for Base
    chainId: 8453,
    decimals: 18,
    name: "ETH", // Or just "ETH" if using native ETH representation
    symbol: "ETH", // Or "ETH"
    image: "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png", // Original
  };

  const WETHToken: Token = {
    address: '', // Or appropriate WETH address for Base
    chainId: 8453,
    decimals: 18,
    name: "WETH", // Or just "ETH" if using native ETH representation
    symbol: "WETH", // Or "ETH"
    image: "https://basescan.org/token/images/weth_28.png", // Original
  };

  const SPXToken: Token = {
    address: "0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C",
    chainId: 8453,
    decimals: 8, // Check if this is correct for SPX6900, was 8 previously?
    name: "SPX6900",
    symbol: "SPX",
    image: "https://assets.coingecko.com/coins/images/31401/standard/sticker_%281%29.jpg?1702371083" // Original
  };

  const USDCToken: Token = {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: 8453,
    decimals: 6,
    name: "USDC",
    symbol: "USDC",
    image: "https://dynamic-assets.coinbase.com/3c15df5e2ac7d4abbe9499ed9335041f00c620f28e8de2f93474a9f432058742cdf4674bd43f309e69778a26969372310135be97eb183d91c492154176d455b8/asset_icons/9d67b728b6c8f457717154b3a35f9ddc702eae7e76c4684ee39302c4d7fd0bb8.png", // Original
  };

  // Update the swappable tokens array to include ETH
  const swappableTokens: Token[] = [ETHToken, WETHToken, SPXToken, USDCToken];

  // Add state for selected tokens
  const [fromToken, setFromToken] = useState<Token>(USDCToken);
  const [toToken, setToToken] = useState<Token>(SPXToken);

  const handleOnStatus = useCallback((lifecycleStatus: LifecycleStatus) => {
    console.log('Status:', lifecycleStatus);
  }, []);

  const handleOnSuccess = useCallback(
    (transactionReceipt: TransactionReceipt) => {
      console.log('Success:', transactionReceipt);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000); // Stop confetti after 5 seconds
    }, []);

  const handleOnError = useCallback((swapError: SwapError) => {
    console.log('Error:', swapError);
  }, []);

  const [parseHubData, setParseHubData] = useState<any>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const fetchParseHubProjects = async () => {
      try {
        const projectTokens = [
          { token: 't7Fp0h8ZfxVd', title: 'investing.com' },
          { token: 'tNUpHFbjsmkA', title: 'lunarcrush.com' },
          { token: 'tPVGTLBpW623', title: 'slickchart' }
        ];

        const results = await Promise.all(
          projectTokens.map(async (project) => {
            try {
              const response = await fetch(`/api/parsehub?projectToken=${project.token}`);
              if (!response.ok) throw new Error(`Failed to fetch ${project.title} data`);
              const data = await response.json();
              console.log(`Data from ${project.title}:`, data);
              return { [project.title]: data };
            } catch (error) {
              console.error(`Error fetching data for ${project.title}:`, error);
              return { [project.title]: null };
            }
          })
        );

        // Combine all results into a single object
        const combinedData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        console.log('Combined ParseHub data:', combinedData);
        setParseHubData(combinedData);
        setIsDataLoaded(true); // Mark data as loaded
      } catch (error) {
        console.error('Error fetching ParseHub data:', error);
      }
    };

    fetchParseHubProjects();
    const interval = setInterval(fetchParseHubProjects, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCoinbaseWalletClick = useCallback((event: React.MouseEvent) => {
    // Prevent default
    event.preventDefault();
    event.stopPropagation();
    
    // Use the openConnectModal directly
    if (openConnectModal) {
      openConnectModal();
    }
  }, [openConnectModal]);

  const generatePriceImage = async () => {
    console.log('Starting image generation...');
    console.log('ParseHub Data:', parseHubData); // Log the full data structure
    
    if (!priceComparisonRef.current) {
      console.error('No ref found');
      return null;
    }

    // First ensure we have parseHubData
    if (!parseHubData) {
      console.error('ParseHub data not available');
      toast.error('Please wait for market data to load');
      return null;
    }

    try {
      // Get the S&P 500 data from the same source that the main page uses
      const snpPrice = parseSnpPrice(parseHubData);
      const snpChange = parseSnpChange(parseHubData);
      const snpMarketCap = parseSnpMarketCap(parseHubData);

      // Log the parsed values
      console.log('Parsed values:', { snpPrice, snpChange, snpMarketCap });

      // Check if we have valid data
      if (snpPrice === null || snpChange === null || snpMarketCap === null) {
        console.error('Invalid or missing S&P 500 data');
        toast.error('Please wait for market data to load completely');
        return null;
      }

      const element = priceComparisonRef.current;
      
      // Save original styles
      const originalStyles = {
        visibility: element.style.visibility,
        position: element.style.position,
        left: element.style.left,
        top: element.style.top,
        zIndex: element.style.zIndex,
        width: element.style.width,
        height: element.style.height
      };

      // Move it off-screen but make it visible and force specific dimensions
      element.style.visibility = 'visible';
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.zIndex = '-9999';
      element.style.width = '600px';
      element.style.height = '350px';
      
      // Force horizontal layout
      const mainFlexContainer = element.querySelector('[data-price-comparison] > div');
      if (mainFlexContainer instanceof HTMLElement) {
        mainFlexContainer.style.display = 'flex';
        mainFlexContainer.style.flexDirection = 'row';
        mainFlexContainer.style.justifyContent = 'space-between';
        mainFlexContainer.style.alignItems = 'center';
        mainFlexContainer.style.gap = '40px';
        mainFlexContainer.style.marginBottom = '15px';
        mainFlexContainer.style.paddingBottom = '15px';
        mainFlexContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
      }
      
      // Ensure the separator is vertical
      const separator = element.querySelector('[data-price-comparison] > div > div:nth-child(2)');
      if (separator instanceof HTMLElement) {
        separator.style.width = '1px';
        separator.style.height = '100px';
        separator.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        separator.style.margin = '0';
        separator.style.alignSelf = 'center';
      }
      
      // Style the SPX side
      const spxSide = element.querySelector('[data-price-comparison] > div > div:nth-child(1)');
      if (spxSide instanceof HTMLElement) {
        spxSide.style.flex = '1';
        spxSide.style.display = 'flex';
        spxSide.style.flexDirection = 'column';
        spxSide.style.alignItems = 'center';
        spxSide.style.textAlign = 'center';
        
        // Style the SPX heading
        const spxHeading = spxSide.querySelector('.flex');
        if (spxHeading instanceof HTMLElement) {
          spxHeading.style.justifyContent = 'center';
          spxHeading.style.marginBottom = '10px';
        }
        
        // Format the price and market cap
        const spxPrice = spxSide.querySelector('.text-3xl, .font-bold');
        if (spxPrice instanceof HTMLElement) {
          spxPrice.style.fontSize = '32px';
          spxPrice.style.fontWeight = 'bold';
        }
        
        // Format the percentage change
        const spxPercentage = spxSide.querySelector('.text-red-500');
        if (spxPercentage instanceof HTMLElement) {
          spxPercentage.style.fontSize = '24px';
          spxPercentage.style.fontWeight = 'normal';
        }
      }
      
      // Style the SNP side
      const snpSide = element.querySelector('[data-price-comparison] > div > div:nth-child(3)');
      if (snpSide instanceof HTMLElement) {
        snpSide.style.flex = '1';
        snpSide.style.display = 'flex';
        snpSide.style.flexDirection = 'column';
        snpSide.style.alignItems = 'center';
        snpSide.style.textAlign = 'center';
        
        // Style the SNP heading
        const snpHeading = snpSide.querySelector('.flex');
        if (snpHeading instanceof HTMLElement) {
          snpHeading.style.justifyContent = 'center';
          snpHeading.style.marginBottom = '10px';
        }
        
        // Format the price
        const snpPrice = snpSide.querySelector('.text-3xl, .font-bold');
        if (snpPrice instanceof HTMLElement) {
          snpPrice.style.fontSize = '32px';
          snpPrice.style.fontWeight = 'bold';
        }
        
        // Format the percentage change
        const snpPercentage = snpSide.querySelector('.text-red-500');
        if (snpPercentage instanceof HTMLElement) {
          snpPercentage.style.fontSize = '24px';
          snpPercentage.style.fontWeight = 'normal';
        }
      }
      
      // Style the bottom section
      const extraSection = element.querySelector('[data-price-comparison] > div + div');
      if (extraSection instanceof HTMLElement) {
        extraSection.style.display = 'flex';
        extraSection.style.flexDirection = 'column';
        extraSection.style.alignItems = 'center';
        extraSection.style.justifyContent = 'center';
        extraSection.style.textAlign = 'center';
        
        // Style the heading
        const heading = extraSection.querySelector('h3');
        if (heading instanceof HTMLElement) {
          heading.style.fontSize = '20px';
          heading.style.fontWeight = 'bold';
          heading.style.marginBottom = '12px';
          
          // Make SPX6900 and S&P500 gold
          const goldTexts = heading.querySelectorAll('.gold-text');
          goldTexts.forEach(el => {
            if (el instanceof HTMLElement) {
              el.style.color = 'gold';
              el.style.fontWeight = 'bold';
            }
          });
        }
        
        // Style the price and multiplier
        const priceContainer = extraSection.querySelector('.flex');
        if (priceContainer instanceof HTMLElement) {
          priceContainer.style.display = 'flex';
          priceContainer.style.flexDirection = 'row';
          priceContainer.style.alignItems = 'baseline';
          priceContainer.style.justifyContent = 'center';
          priceContainer.style.gap = '6px';
          
          const price = priceContainer.querySelector('.text-2xl, .font-bold');
          if (price instanceof HTMLElement) {
            price.style.fontSize = '32px';
            price.style.fontWeight = 'bold';
          }
          
          const multiplier = priceContainer.querySelector('.text-green-400, .multiplier-text');
          if (multiplier instanceof HTMLElement) {
            multiplier.style.color = '#48bb78';
            multiplier.style.fontSize = '24px';
            multiplier.style.fontWeight = 'normal';
          }
        }
        
        // Remove any vertical separators in the bottom section
        const unwantedSeparators = extraSection.querySelectorAll('[data-price-comparison] > div + div > div > div');
        unwantedSeparators.forEach(separator => {
          if (separator instanceof HTMLElement && 
              separator.style.width === '1px' && 
              separator.style.height) {
            separator.style.display = 'none';
          }
        });
      }

      // Wait for images to load
      const images = element.getElementsByTagName('img');
      await Promise.all(
        Array.from(images).map(
          img => 
            new Promise((resolve) => {
              if (img.complete) {
                resolve(null);
              } else {
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null);
              }
            })
        )
      );

      // Add a small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Starting html2canvas with data:', {
        snpPrice,
        snpChange,
        snpMarketCap
      });

      const canvas = await html2canvas(element, {
        backgroundColor: '#131827',
        scale: 2,
        logging: true,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 2000,
        width: 600,
        height: 350,
        onclone: (clonedDoc) => {
          console.log('html2canvas clone callback triggered');
          const clonedElement = clonedDoc.querySelector('[data-price-comparison]');
          if (clonedElement) {
            // Make sure we render in horizontal format in the clone too
            const flexContainer = clonedElement.querySelector('[data-price-comparison] > div');
            if (flexContainer instanceof HTMLElement) {
              flexContainer.style.display = 'flex';
              flexContainer.style.flexDirection = 'row';
              flexContainer.style.justifyContent = 'space-between';
              flexContainer.style.alignItems = 'center';
              flexContainer.style.gap = '40px';
              flexContainer.style.marginBottom = '15px';
              flexContainer.style.paddingBottom = '15px';
              flexContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
            }
            
            // Ensure separator is vertical
            const sep = clonedElement.querySelector('[data-price-comparison] > div > div:nth-child(2)');
            if (sep && sep instanceof HTMLElement) {
              sep.style.width = '1px';
              sep.style.height = '100px';
              sep.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              sep.style.margin = '0';
              sep.style.alignSelf = 'center';
            }
            
            // Style the SPX side in the clone
            const spxSideClone = clonedElement.querySelector('[data-price-comparison] > div > div:nth-child(1)');
            if (spxSideClone instanceof HTMLElement) {
              spxSideClone.style.flex = '1';
              spxSideClone.style.display = 'flex';
              spxSideClone.style.flexDirection = 'column';
              spxSideClone.style.alignItems = 'center';
              spxSideClone.style.textAlign = 'center';
              
              // Style the SPX heading
              const spxHeading = spxSideClone.querySelector('.flex');
              if (spxHeading instanceof HTMLElement) {
                spxHeading.style.justifyContent = 'center';
                spxHeading.style.marginBottom = '10px';
              }
              
              // Format the price
              const spxPrice = spxSideClone.querySelector('.text-3xl, .font-bold');
              if (spxPrice instanceof HTMLElement) {
                spxPrice.style.fontSize = '32px';
                spxPrice.style.fontWeight = 'bold';
              }
              
              // Format the percentage change
              const spxPercentage = spxSideClone.querySelector('.text-red-500');
              if (spxPercentage instanceof HTMLElement) {
                spxPercentage.style.fontSize = '24px';
                spxPercentage.style.fontWeight = 'normal';
              }
            }
            
            // Style the SNP side in the clone
            const snpSideClone = clonedElement.querySelector('[data-price-comparison] > div > div:nth-child(3)');
            if (snpSideClone instanceof HTMLElement) {
              snpSideClone.style.flex = '1';
              snpSideClone.style.display = 'flex';
              snpSideClone.style.flexDirection = 'column';
              snpSideClone.style.alignItems = 'center';
              snpSideClone.style.textAlign = 'center';
              
              // Style the SNP heading
              const snpHeading = snpSideClone.querySelector('.flex');
              if (snpHeading instanceof HTMLElement) {
                snpHeading.style.justifyContent = 'center';
                snpHeading.style.marginBottom = '10px';
              }
              
              // Format the price
              const snpPrice = snpSideClone.querySelector('.text-3xl, .font-bold');
              if (snpPrice instanceof HTMLElement) {
                snpPrice.style.fontSize = '32px';
                snpPrice.style.fontWeight = 'bold';
              }
              
              // Format the percentage change
              const snpPercentage = snpSideClone.querySelector('.text-red-500');
              if (snpPercentage instanceof HTMLElement) {
                snpPercentage.style.fontSize = '24px';
                snpPercentage.style.fontWeight = 'normal';
              }
            }
            
            // Style the bottom section in the clone
            const extraSectionClone = clonedElement.querySelector('[data-price-comparison] > div + div');
            if (extraSectionClone instanceof HTMLElement) {
              extraSectionClone.style.display = 'flex';
              extraSectionClone.style.flexDirection = 'column';
              extraSectionClone.style.alignItems = 'center';
              extraSectionClone.style.justifyContent = 'center';
              extraSectionClone.style.textAlign = 'center';
              
              // Style the heading
              const heading = extraSectionClone.querySelector('h3');
              if (heading instanceof HTMLElement) {
                heading.style.fontSize = '20px';
                heading.style.fontWeight = 'bold';
                heading.style.marginBottom = '12px';
                
                // Make SPX6900 and S&P500 gold
                const goldTexts = heading.querySelectorAll('.gold-text');
                goldTexts.forEach(el => {
                  if (el instanceof HTMLElement) {
                    el.style.color = 'gold';
                    el.style.fontWeight = 'bold';
                  }
                });
              }
              
              // Style the price and multiplier
              const priceContainer = extraSectionClone.querySelector('.flex');
              if (priceContainer instanceof HTMLElement) {
                priceContainer.style.display = 'flex';
                priceContainer.style.flexDirection = 'row';
                priceContainer.style.alignItems = 'baseline';
                priceContainer.style.justifyContent = 'center';
                priceContainer.style.gap = '6px';
                
                const price = priceContainer.querySelector('.text-2xl, .font-bold');
                if (price instanceof HTMLElement) {
                  price.style.fontSize = '32px';
                  price.style.fontWeight = 'bold';
                }
                
                const multiplier = priceContainer.querySelector('.text-green-400, .multiplier-text');
                if (multiplier instanceof HTMLElement) {
                  multiplier.style.color = '#48bb78';
                  multiplier.style.fontSize = '24px';
                  multiplier.style.fontWeight = 'normal';
                }
              }
              
              // Remove any vertical separators in the bottom section
              const unwantedSeparators = extraSectionClone.querySelectorAll('[data-price-comparison] > div + div > div > div');
              unwantedSeparators.forEach(separator => {
                if (separator instanceof HTMLElement && 
                    separator.style.width === '1px' && 
                    separator.style.height) {
                  separator.style.display = 'none';
                }
              });
            }
            
            // Update the values in the cloned DOM
            const priceElement = clonedElement.querySelector('[data-snp-price]');
            const changeElement = clonedElement.querySelector('[data-snp-change]');
            
            if (priceElement && snpPrice !== null) {
              priceElement.textContent = formatPrice(snpPrice);
            }
            
            if (changeElement && snpChange !== null) {
              const formattedChange = formatChange(snpChange);
              changeElement.textContent = formattedChange.text;
              changeElement.className = `text-lg ${formattedChange.color}`;
            }

            // Set styles for visibility
            (clonedElement as HTMLElement).style.position = 'static';
            (clonedElement as HTMLElement).style.left = '0';
            (clonedElement as HTMLElement).style.top = '0';
            (clonedElement as HTMLElement).style.visibility = 'visible';
          }
        }
      });

      // Restore original styles
      element.style.visibility = originalStyles.visibility;
      element.style.position = originalStyles.position;
      element.style.left = originalStyles.left;
      element.style.top = originalStyles.top;
      element.style.zIndex = originalStyles.zIndex;
      element.style.width = originalStyles.width;
      element.style.height = originalStyles.height;
      
      console.log('Canvas generated successfully');

      return new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob((blob) => {
            if (blob) {
              console.log('Blob created successfully');
              resolve(blob);
            } else {
              console.error('Blob creation failed');
              reject(new Error('Failed to create blob'));
            }
          }, 'image/png', 1.0);
        } catch (error) {
          console.error('Error in blob creation:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Detailed error in generatePriceImage:', error);
      return null;
    }
  };

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleShareToX = useCallback(async () => {
    setIsGeneratingImage(true);

    try {
      // Wait for parseHubData to be available (maximum 5 seconds)
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds (100ms * 50)
      
      while (!parseHubData && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!parseHubData) {
        throw new Error('Market data not available. Please try again in a few seconds.');
      }

      const imageBlob = await generatePriceImage();
      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      const formData = new FormData();
      formData.append('image', imageBlob, 'price-comparison.png');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(response.status === 429
          ? 'Rate limit exceeded. Please try again later.'
          : 'Failed to upload image'
        );
      }

      const data = await response.json();
      const blobUrl = data.imageUrl;

      // Extract the filename from the blob URL
      const filename = blobUrl.substring(blobUrl.lastIndexOf('/') + 1);

      // Construct the URL for your share page
      const siteUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
      const sharePageUrl = `${siteUrl}/share/${filename}`;

      // Create tweet text
      const tweetText = `#SPX #SPX6900\n`;

      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(sharePageUrl)}`,
        '_blank'
      );

      toast.success('Ready to post!');
    } catch (error) {
      console.error('Error sharing to X:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [parseHubData]);

  // Add helper functions to parse S&P data safely
  const parseSnpPrice = (data: any): number | null => {
    const priceStr = data?.['investing.com']?.lastprice;
    if (typeof priceStr === 'string') {
      const num = parseFloat(priceStr.replace(/[^0-9.-]+/g,""));
      return isNaN(num) ? null : num;
    }
    return null;
  };

  const parseSnpChange = (data: any): number | null => {
    const changeStr = data?.['investing.com']?.changepercent;
    if (typeof changeStr === 'string') {
      const num = parseFloat(changeStr.replace(/[^0-9.-]+/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  };

  const parseSnpMarketCap = (data: any): number | null => {
    const mcStr = data?.slickchart?.marketcap;
    if (typeof mcStr === 'string') {
      const value = parseFloat(mcStr.replace(/[^0-9.]/g, ''));
      if (isNaN(value)) return null;
      if (mcStr.toLowerCase().includes('t')) return value * 1e12;
      if (mcStr.toLowerCase().includes('b')) return value * 1e9;
      if (mcStr.toLowerCase().includes('m')) return value * 1e6;
      return value;
    }
    return null;
  };

  // Add effect to replace "Balance" with "Bal" in the swap component
  useEffect(() => {
    const replaceBalanceText = () => {
      // Find all elements containing "Balance" text
      const balanceElements = document.querySelectorAll('.swap-token-balance span:first-child');
      balanceElements.forEach(element => {
        if (element.textContent?.includes('Balance')) {
          element.textContent = element.textContent.replace('Balance', 'Bal');
        }
      });
    };

    // Run initially after render
    replaceBalanceText();
    
    // Set up a mutation observer to watch for changes in the swap component
    const observer = new MutationObserver(replaceBalanceText);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  // Add custom CSS for Twitter image to ensure it's always horizontal
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .force-horizontal [data-price-comparison] {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        height: 100% !important;
      }
      
      .force-horizontal [data-price-comparison] > div:first-child {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        gap: 40px !important;
        margin-bottom: 15px !important;
        padding-bottom: 15px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      
      .force-horizontal [data-price-comparison] > div > div:nth-child(2) {
        width: 1px !important;
        height: 100px !important;
        background-color: rgba(255, 255, 255, 0.2) !important;
        margin: 0 !important;
        align-self: center !important;
      }
      
      .force-horizontal [data-price-comparison] > div > div:nth-child(1),
      .force-horizontal [data-price-comparison] > div > div:nth-child(3) {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
      }
      
      .force-horizontal [data-price-comparison] .flex {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }
      
      /* Extra section styling */
      .force-horizontal [data-price-comparison] > div:last-child {
        text-align: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .force-horizontal [data-price-comparison] > div:last-child h3 {
        font-size: 20px !important;
        margin-bottom: 12px !important;
        font-weight: bold !important;
      }
      
      .force-horizontal [data-price-comparison] > div:last-child .flex {
        display: flex !important;
        flex-direction: row !important;
        align-items: baseline !important;
        justify-content: center !important;
        gap: 6px !important;
      }
      
      /* Hide any vertical separators in the bottom section */
      .force-horizontal [data-price-comparison] > div:last-child [style*="width: 1px"],
      .force-horizontal [data-price-comparison] > div:last-child div[style*="width:1px"] {
        display: none !important;
      }
      
      /* Font sizes and colors */
      .force-horizontal [data-price-comparison] .gold-text {
        color: gold !important;
        font-weight: bold !important;
      }
      
      .force-horizontal [data-price-comparison] span.text-2xl,
      .force-horizontal [data-price-comparison] span.text-3xl {
        font-size: 32px !important;
        font-weight: bold !important;
        line-height: 1.2 !important;
      }
      
      .force-horizontal [data-price-comparison] .text-green-400 {
        color: #48bb78 !important;
      }
      
      .force-horizontal [data-price-comparison] .text-red-500 {
        color: #f56565 !important;
      }
      
      /* Image sizes */
      .force-horizontal [data-price-comparison] img {
        width: 32px !important;
        height: 32px !important;
        margin-bottom: 8px !important;
      }
      
      @media (max-width: 768px) {
        [data-twitter-image="true"] [data-price-comparison] > div:first-child {
          flex-direction: row !important;
        }
      }
      
      /* Style the market cap section specifically */
      .force-horizontal [data-market-cap-section] {
        position: relative !important;
        padding-top: 10px !important;
        border-top: none !important;
        margin-top: 0 !important;
      }
      
      .force-horizontal [data-market-cap-section]:before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 80% !important;
        height: 1px !important;
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      
      .force-horizontal [data-market-cap-section] .flex {
        display: flex !important;
        flex-direction: row !important;
        align-items: baseline !important;
        justify-content: center !important;
        gap: 8px !important;
        border: none !important;
        background: none !important;
      }
      
      /* Make percentage changes match price font size */
      .force-horizontal [data-price-comparison] .text-red-500,
      .force-horizontal [data-price-comparison] [class*="text-red"] {
        font-size: 24px !important;
        font-weight: normal !important;
      }
      
      /* Make the multiplier text match percentage changes */
      .force-horizontal [data-price-comparison] .multiplier-text {
        font-size: 24px !important;
        font-weight: normal !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden relative">
      <main className="flex-1 w-full px-4 sm:px-6 py-8 mx-auto max-w-7xl pb-4">
        {/* Replace the GIF background div with the new color */}
        <div className="fixed inset-0 z-0 bg-[#131827]"></div>

        {/* Hamburger Menu */}
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-[#131827]/50 backdrop-blur-sm">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              ) : (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              )}
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <WalletWrapper />
          </div>
          
          {isMenuOpen && (
            <div className="absolute top-full left-4 mt-2 bg-black/90 backdrop-blur-md rounded-lg shadow-lg border border-white/10">
              <nav className="py-2">
                <a 
                  href="/" 
                  className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </a>
                <a 
                  href="https://spx6900merch.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-white hover:bg-white/10 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Merch
                </a>
              </nav>
            </div>
          )}
        </div>

        {/* Main content wrapper */}
        <div className="relative z-10 pt-20 sm:pt-24">
          {showConfetti && createPortal(
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 10000 }}>
              <Confetti
                width={windowDimensions.width}
                height={windowDimensions.height}
                recycle={false}
                numberOfPieces={200}
                gravity={0.5}
                initialVelocityY={5}
                confettiSource={{
                  x: 0,
                  y: 0,
                  w: windowDimensions.width,
                  h: 0
                }}
                drawShape={ctx => {
                  if (confettiImage.current) {
                    ctx.drawImage(confettiImage.current, 0, 0, 40, 40);
                  }
                }}
              />
            </div>,
            document.body
          )}
          <section className="templateSection flex w-full flex-col items-center justify-center gap-4 rounded-xl bg-transparent px-2 py-4">
            <div className="relative w-full max-w-3xl mx-auto mb-4">
              {/* Background image/glow with reduced spread */}
              <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[100%] bg-gradient-to-r from-[#ff69b4]/10 via-[#ff8c00]/10 to-[#4caf50]/10 rounded-[40px] blur-[20px]"></div>
              </div>
              
              {/* Text with gradient */}
              <h1 className="relative z-10 text-7xl sm:text-8xl md:text-9xl font-bold text-center p-4">
                <span className="bg-gradient-to-r from-[#ff69b4] via-[#ff8c00] to-[#4caf50] text-transparent bg-clip-text">
                  flip the stock market
                </span>
              </h1>
            </div>
            
            {/* Price Comparison Section - RESTORE THIS TO ITS ORIGINAL POSITION */}
            <div className="flex flex-row w-full gap-4 justify-center">
              <div className="flex-1 p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl">
                <VisiblePriceComparison />
              </div>
            </div>

            {/* Post to X Button */}
            <button
              onClick={handleShareToX}
              disabled={!isDataLoaded || isGeneratingImage}
              className={`w-full max-w-[450px] mx-auto bg-[#1B2236] hover:bg-[#1B2236]/80 text-white rounded-md p-3 flex items-center justify-center gap-3 transition-all duration-200 backdrop-blur-sm mt-3 border border-white/10 ${
                !isDataLoaded || isGeneratingImage ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-base font-medium">
                {!isDataLoaded ? (
                  'Loading data...'
                ) : isGeneratingImage ? (
                  <>
                    Preparing image... 
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </>
                ) : (
                  <>
                    Post to <img src="/x-logo.svg" alt="X Logo" className="w-5 h-5" />
                  </>
                )}
              </span>
            </button>

            {/* Market Cap Calculator Section */}
            <div className="w-full p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl mt-4">
              <h2 className="text-2xl font-bold text-white text-center mb-4">
                <span className="gold-text">SPX6900</span> WITH THE MARKET CAP OF <span className="gold-text">S&P500</span>
              </h2>

              {parseHubData?.slickchart?.marketcap && spxPrice && spxMarketCap && (
                <div className="text-xl font-bold text-white text-center mb-4">
                  <img 
                    src="/spx6900.png" 
                    alt="SPX6900" 
                    className="w-8 h-8 inline-block mr-2 align-middle"
                  />
                  <span id="calculatedValue">
                    ${(parseFloat(parseHubData.slickchart.marketcap.replace(/[^0-9.]/g, '')) * 1e12 * (spxPrice / spxMarketCap)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <span className="text-green-400 ml-2">
                    ({(parseFloat(parseHubData.slickchart.marketcap.replace(/[^0-9.]/g, '')) * 1e12 / spxMarketCap).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}x)
                  </span>
                </div>
              )}

              {/* Calculator Input */}
              {parseHubData?.slickchart?.marketcap && spxPrice && spxMarketCap && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex w-full max-w-[400px]">
                    <input
                      type="number"
                      placeholder="Amount"
                      className="w-full px-4 py-3 rounded-l-lg bg-[#131827] text-white placeholder-white/50 border border-white/10 focus:outline-none focus:border-white/30 text-lg"
                      onChange={(e) => {
                        const value = e.target.value;
                        const element = document.getElementById('calculatedValue');
                        if (element) {
                          const amount = parseFloat(value);
                          if (!value || !amount || amount <= 0) {
                            element.textContent = `$${(parseFloat(parseHubData.slickchart.marketcap.replace(/[^0-9.]/g, '')) * 1e12 * (spxPrice / spxMarketCap)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}`;
                          } else {
                            const multiplier = parseFloat(parseHubData.slickchart.marketcap.replace(/[^0-9.]/g, '')) * 1e12 / spxMarketCap;
                            element.textContent = `$${(amount * spxPrice * multiplier).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}`;
                          }
                        }
                      }}
                    />
                    <div className="px-6 py-3 bg-[#1B2236] text-white rounded-r-lg border-y border-r border-white/10 text-lg">
                      SPX
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Swap Section - reduce bottom margin */}
            <div className="w-full items-center justify-center rounded-xl bg-transparent mt-4 mb-4">
              {address ? (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                  <div className="w-full max-w-[450px] relative">
                    <Swap
                      className="w-full bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md text-white [&_*]:text-white [&_p]:text-white [&_span]:text-white [&_div]:text-white [&_input]:bg-[#1B2236] [&_button]:bg-[#1B2236] [&_.swap-input]:!bg-[#1B2236] [&_.swap-input-container]:!bg-[#1B2236] [&_.swap-button]:!bg-[#1B2236] [&_.swap-message]:!bg-[#1B2236] [&_*]:!bg-[#1B2236] [&_*]:!bg-opacity-70 [&_.token-selector]:!bg-[#1B2236] [&_.token-selector-button]:!bg-[#1B2236] [&_.token-list]:!bg-[#1B2236] [&_.input-container]:!bg-[#1B2236] [&_button]:!flex [&_button]:!justify-center [&_button]:!items-center [&_svg]:!text-white [&_svg]:!fill-white [&_.token-selector]:!static [&_.token-list]:!absolute [&_.token-list]:!left-0 [&_.token-list]:!right-0 [&_.token-list]:!w-full [&_.token-list]:!mt-2 !px-6 !pb-2 !pt-24 [&_h1]:!hidden [&_[data-testid='ockSwap_title']]:!hidden [&_[data-testid='ockSwap_header']]:!hidden [&_.swap-header]:!hidden [&_h2]:!hidden [&_h3]:!hidden [&_.swap-title]:!hidden [&_div:contains('Swap')]:!hidden sm:[&_input]:!text-3xl [&_input]:!text-lg [&_label]:!text-sm sm:[&_label]:!text-lg [&_.token-selector-button]:!text-sm sm:[&_.token-selector-button]:!text-lg [&_.swap-input-container]:!gap-1 sm:[&_.swap-input-container]:!gap-2 [&_span:contains('Balance')]:hidden [&_span:empty~span]:before:content-['Bal:']"
                      onStatus={handleOnStatus}
                      onSuccess={handleOnSuccess}
                      onError={handleOnError}
                      config={{
                        maxSlippage: defaultMaxSlippage || FALLBACK_DEFAULT_MAX_SLIPPAGE,
                      }}
                      experimental={{
                        useAggregator: true  // Enable 0x Aggregator
                      }}
                      isSponsored={true}
                    >
                      <SwapAmountInput
                        label="Sell"
                        swappableTokens={swappableTokens}
                        token={fromToken}
                        type="from"
                      />
                      <SwapToggleButton
                        className="!border-0 !bg-transparent !text-white [&_svg]:!text-white [&_svg]:!fill-white [&_path]:!stroke-white scale-100 !p-1 hover:!bg-[#1B2236] transition-all duration-200 !z-0 !w-8 !h-8 rounded-lg"
                      />
                      <SwapAmountInput
                        label="Buy"
                        swappableTokens={swappableTokens}
                        token={toToken}
                        type="to"
                      />
                      <SwapButton />
                      <SwapMessage />
                      <SwapToast position="bottom-center" durationMs={10000}/>
                    </Swap>
                    {address && onrampBuyUrl && (
                      <div className="absolute right-4 top-3 z-[1]">
                        <FundButton
                          fundingUrl={onrampBuyUrl}
                          text="BUY USDC"
                          className="!bg-white/5 hover:!bg-white/10 !text-white !font-semibold !py-1 !px-3 !rounded-lg !leading-none !text-lg transition-all duration-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <h1 className="text-5xl font-bold text-center text-white mb-6">
                    Buy SPX6900
                  </h1>
                  <div className="w-full bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md px-8 py-8 mb-4">
                    {/* Recommended heading */}
                    <h3 className="text-xl font-bold text-white mb-4">Recommended</h3>
                    
                    {/* Replace the existing Coinbase Wallet button section with this */}
                    <button 
                      onClick={handleCoinbaseWalletClick}
                      className="w-full bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-4 mb-6 flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer"
                    >
                      <img src="/Coinbase_Coin_Primary.png" alt="Coinbase" className="h-8" />
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-lg font-medium">Coinbase Wallet</span>
                        <p className="text-sm opacity-75 text-center">(0% fees)</p>
                      </div>
                    </button>

                    {/* Centralized Exchanges */}
                    <h3 className="text-xl font-bold text-white mb-4">Centralized Exchanges</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-6">
                      {[
                        { name: 'Bybit', url: 'https://www.bybit.com/trade/spot/SPX/USDT/', icon: '/bybit.svg' },
                        { name: 'Kraken', url: 'https://pro.kraken.com/app/trade/SPX-USD', icon: '/kraken.svg' },
                        { name: 'KuCoin', url: 'https://www.kucoin.com/trade/SPX-USDT/', icon: '/kukoin.svg' }
                      ].map((exchange) => (
                        <a
                          key={exchange.name}
                          href={exchange.url}
                          className="bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-3 flex items-center justify-center transition-all duration-200"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className="h-16 w-full flex items-center justify-center overflow-visible p-0">
                            {exchange.name === 'Bybit' && (
                              <img src={exchange.icon} alt={exchange.name} style={{ height: '56px', width: 'auto', maxWidth: 'none' }} />
                            )}
                            {exchange.name === 'Kraken' && (
                              <img src={exchange.icon} alt={exchange.name} style={{ height: '56px', width: 'auto', maxWidth: 'none' }} />
                            )}
                            {exchange.name === 'KuCoin' && (
                              <img src={exchange.icon} alt={exchange.name} style={{ height: '24px', width: 'auto', maxWidth: 'none' }} />
                            )}
                          </div>
                        </a>
                      ))}
                    </div>

                    {/* Onchain Exchanges */}
                    <h3 className="text-xl font-bold text-white mb-4">Onchain Exchanges</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-6">
                      {[
                        { name: 'Uniswap', url: 'https://app.uniswap.org/explore/tokens/ethereum/0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c', icon: '/Uniswap_horizontallogo_pink.svg', showText: false },
                        { name: 'Aerodrome', url: 'https://aerodrome.finance/swap?from=0x50da645f148798f68ef2d7db7c1cb22a6819bb2c&to=0x4200000000000000000000000000000000000006', icon: '/velodrome-logo-light.svg', showText: false },
                        { name: 'Raydium', url: 'https://raydium.io/swap/?outputCurrency=J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr&referrer=6tvwZLkMWj9qZNu8YoquKNde8RJXk1fofgaAyJkWMC5f', icon: '/raydium.jpeg', showText: true }
                      ].map((exchange) => (
                        <a
                          key={exchange.name}
                          href={exchange.url}
                          className="bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-3 flex items-center justify-center transition-all duration-200"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className="h-12 w-full flex items-center justify-center">
                            <div className="flex items-center justify-center">
                              <img 
                                src={exchange.icon} 
                                alt={exchange.name} 
                                className={`object-contain ${exchange.name === 'Uniswap' ? 'h-7 w-auto max-w-[110px]' : 'h-9 w-auto max-w-[100px]'}`}
                              />
                              {exchange.showText && (
                                <span className="text-white font-medium text-sm ml-1">{exchange.name}</span>
                              )}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>

                    {/* Onchain Wallets */}
                    <h3 className="text-xl font-bold text-white mb-4">Onchain Wallets</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                      {[
                        { name: 'INFINEX', url: 'https://app.infinex.xyz/', icon: '/Infinex_Logo_Cantaloupe.svg' },
                        { name: 'Rabby', url: 'https://rabby.io/', icon: '/rabby-logo-white.svg' },
                        { name: 'Phantom', url: 'https://phantom.com/', icon: '/Phantom-Logo-Purple.svg' }
                      ].map((wallet) => (
                        <a
                          key={wallet.name}
                          href={wallet.url}
                          className="bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-3 flex items-center justify-center transition-all duration-200"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className="h-16 w-full flex items-center justify-center overflow-visible p-0">
                            {wallet.name === 'INFINEX' && (
                              <img src={wallet.icon} alt={wallet.name} style={{ height: '48px', width: 'auto', maxWidth: 'none' }} />
                            )}
                            {wallet.name === 'Phantom' && (
                              <img src={wallet.icon} alt={wallet.name} style={{ height: '21px', width: 'auto', maxWidth: 'none' }} />
                            )}
                            {wallet.name === 'Rabby' && (
                              <img src={wallet.icon} alt={wallet.name} className="h-9 w-auto object-contain" />
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Remove spacer completely */}
            
            {/* New message - directly after swap section without spacer */}
            <div className="w-full flex flex-col gap-4">
              {/* join the fam text */}
              <h1 className="text-5xl font-bold text-center text-white mb-4">
                join the fam
              </h1>

              {/* FAM COUNT Box */}
              <div className="text-white bg-[#1B2236] bg-opacity-70 rounded-xl p-4 backdrop-blur-md">
                <h3 className="text-sm uppercase tracking-wider mb-2">FAM COUNT</h3>
                <div className="text-4xl font-bold">5,000+ members</div>
              </div>

              {/* WEAR SPX6900 SIGNAL Box */}
              <div className="text-white bg-[#1B2236] bg-opacity-70 rounded-xl p-4 backdrop-blur-md">
                <h3 className="text-sm uppercase tracking-wider mb-2">ADD SPX6900 ON X</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <span className="ml-1">💹🧲</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('💹🧲');
                      setCopyClicked(true);
                      setTimeout(() => setCopyClicked(false), 2000);
                    }}
                    className={`px-4 py-2 rounded-lg transition-all duration-200 border-2 border-[#4299e1] bg-[#1B2236] bg-opacity-70 text-white hover:bg-opacity-80 backdrop-blur-sm`}
                  >
                    {copyClicked ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Twitter Profiles Grid */}
              <div className="text-white bg-[#1B2236] bg-opacity-70 rounded-xl p-4 backdrop-blur-md">
                <h3 className="text-sm uppercase tracking-wider mb-4">SPX6900 FAM ON X</h3>
                <ProfileGrid />
              </div>
            </div>
          </section>
          {/* Reduce top margin for chart section */}
          <div className="w-full max-w-[1200px] mx-auto mb-0 p-2 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SPX6900 Holders Over Time */}
              <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-4 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4 text-center text-white">SPX6900 Holders Over Time</h2>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={holdersData}>
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff"
                        tick={{ fontSize: 12, fill: "#ffffff" }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                          });
                        }}
                      />
                      <YAxis 
                        stroke="#ffffff"
                        tick={{ fontSize: 12, fill: "#ffffff" }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string, props: any) => {
                          if (name === 'holders') {
                            const tooltipDataPoint = holdersData.find(d => d.holders === value);
                            const percentChange = tooltipDataPoint?.percentChange ?? 0;
                            const color = percentChange < 0 ? '#ef4444' : '#22c55e';
                            return [
                              <span key="tooltip" style={{ color }}>
                                {value.toLocaleString()} ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%)
                              </span>,
                              'Holders'
                            ];
                          }
                          return [value, name];
                        }}
                        contentStyle={{
                          backgroundColor: '#1B2236',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="holders" 
                        stroke="#ff844a" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sentiment and Engagement Section */}
              <div className="space-y-4">
                {/* Sentiment by Network */}
                <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-4 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4 text-center text-white">Sentiment by Network</h2>
                  <div className="space-y-4">
                    {parseHubData?.['lunarcrush.com']?.sentiment?.map((platform: any, index: number) => {
                      const sentimentMatch = platform.name.match(/width: ([\d.]+)%.*?background-color: rgb\(246, 80, 108\).*?width: ([\d.]+)%.*?background-color: rgb\(255, 132, 74\).*?width: ([\d.]+)%.*?background-color: rgb\(0, 184, 146\)/);
                      
                      const negative = sentimentMatch ? parseFloat(sentimentMatch[1]) : 0;
                      const neutral = sentimentMatch ? parseFloat(sentimentMatch[2]) : 0;
                      const positive = sentimentMatch ? parseFloat(sentimentMatch[3]) : 0;
                      
                      let svgContent = platform.name.split('</svg>')[0] + '</svg>';
                      if (platform.name.includes('twitterColor')) {
                        svgContent = svgContent.replace(/fill="(?:#fff|#ffffff|white|#F5FAFA)"|fill=#fff/g, 'fill="white"');
                        svgContent = svgContent.replace(/(width="24" height="24".*?fill=["'])(#fff|#ffffff|white|#F5FAFA)(["'])/, '$1white$3');
                      }

                      return (
                        <div key={index} className="relative flex items-center gap-2">
                          <div 
                            className="w-6 h-6 flex-shrink-0"
                            dangerouslySetInnerHTML={{ 
                              __html: svgContent
                            }} 
                          />
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-grow">
                            <div className="h-full flex">
                              <div className="h-full bg-[#f6506c] hover:brightness-125 hover:shadow-[0_0_15px_rgba(246,80,108,0.5)] transition-all duration-300" style={{ width: `${negative}%` }} />
                              <div className="h-full bg-[#ff844a] hover:brightness-125 hover:shadow-[0_0_15px_rgba(255,132,74,0.5)] transition-all duration-300" style={{ width: `${neutral}%` }} />
                              <div className="h-full bg-[#00b892] hover:brightness-125 hover:shadow-[0_0_15px_rgba(0,184,146,0.5)] transition-all duration-300" style={{ width: `${positive}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Engagements by Network */}
                <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-4 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4 text-center text-white">Engagements by Network</h2>
                  <div className="space-y-4">
                    {parseHubData?.['lunarcrush.com']?.engagement?.map((platform: any, index: number) => {
                      const widthMatch = platform.name.match(/width: ([\d.]+)%/);
                      const width = widthMatch ? parseFloat(widthMatch[1]) : 0;
                      
                      let svgContent = platform.name.split('</svg>')[0] + '</svg>';
                      if (platform.name.includes('twitterColor')) {
                        svgContent = svgContent.replace(/fill="(?:#fff|#ffffff|white|#F5FAFA)"|fill=#fff/g, 'fill="white"');
                        svgContent = svgContent.replace(/(width="24" height="24".*?fill=["'])(#fff|#ffffff|white|#F5FAFA)(["'])/, '$1white$3');
                      }

                      return (
                        <div key={index} className="relative flex items-center gap-2">
                          <div 
                            className="w-6 h-6 flex-shrink-0"
                            dangerouslySetInnerHTML={{ 
                              __html: svgContent
                            }} 
                          />
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-grow">
                            <div 
                              className="h-full bg-[#ff844a] hover:brightness-125 hover:shadow-[0_0_15px_rgba(255,132,74,0.5)] transition-all duration-300"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Links and Dropdowns Section */}
        <div className="w-full max-w-[1200px] mx-auto mb-0 p-2">
          <div className="w-full grid grid-cols-1 gap-2">
            <a 
              href="https://spx6900.com/"
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-3 bg-[#1B2236] bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
            >
              <img 
                src="/spx6900.png" 
                alt="SPX6900" 
                className="w-5 h-5 mr-2"
              />
              <span>Official Website</span>
            </a>
            <a 
              href="https://t.me/SPX6900" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-3 bg-[#1B2236] bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
            >
              <img 
                src="/telegram_logo.png" 
                alt="Telegram" 
                className="w-5 h-5 mr-2"
              />
              <span>Community Chat</span>
            </a>
            <button 
              onClick={() => toggleDropdown('howToBuyVideo')}
              className="px-4 py-3 bg-[#1B2236] bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
            >
              <span className="mr-2">🎥 How to Buy (Video Guide)</span>
              <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'howToBuyVideo' ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <button 
              onClick={() => toggleDropdown('sponsoredBuys')}
              className="px-4 py-3 bg-[#1B2236] bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
            >
              <span className="mr-2">🎁 How are there no fees?</span>
              <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'sponsoredBuys' ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>

          {/* Sponsored Buys content */}
          <div 
            className={`w-full md:w-[450px] mx-auto overflow-hidden transition-all duration-300 ease-in-out mt-4 ${
              openDropdown === 'sponsoredBuys' ? 'max-h-[600px]' : 'max-h-0'
            }`}
          >
            <div className="bg-white bg-opacity-50 backdrop-blur-md p-4 rounded-md shadow-md text-center">
              <p className="font-bold text-xl mb-4">Zero Fees! We're sponsoring!</p>
              <div className="w-full overflow-auto">
                <img src="/nogas.png" alt="Sponsored Buys" className="w-full h-auto max-w-none" />
              </div>
            </div>
          </div>
          
          {/* How to Buy Video content */}
          <div 
            className={`w-full md:w-[450px] mx-auto overflow-hidden transition-all duration-300 ease-in-out mt-4 ${
              openDropdown === 'howToBuyVideo' ? 'max-h-[315px]' : 'max-h-0'
            }`}
          >
            <div className="bg-white bg-opacity-50 backdrop-blur-md p-4 rounded-md shadow-md">
              <iframe
                width="100%"
                height="315"
                src="https://www.youtube.com/embed/HxAkFlOIoCA"
                title="How to Buy SPX6900"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      </main>

      {/* Footer positioned outside of main */}
      <Footer />

      {/* Hidden element for Twitter image generation */}
      <div 
        ref={priceComparisonRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '600px',
          height: '350px',
          visibility: 'hidden',
          backgroundColor: '#131827',
          padding: '30px 40px',
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        className="force-horizontal"
        data-twitter-image="true"
      >
        <PriceComparison
          spxPrice={spxPrice}
          spxChange={spx24hChange}
          spxMarketCap={spxMarketCap}
          snpPrice={parseSnpPrice(parseHubData)}
          snpChange={parseSnpChange(parseHubData)}
          snpMarketCap={parseSnpMarketCap(parseHubData)}
          showExtraSection={true}
        />
      </div>
    </div>
  );
}
