'use client';
import Footer from 'src/components/Footer';
import { useState, useRef, useEffect } from 'react';
import Confetti from 'react-confetti';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ProfileGrid from './components/ProfileGrid';
import html2canvas from 'html2canvas';
import React from 'react';


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

  // Calculate doublings needed for the flippening
  const doublingsNeeded = (multiplier !== null && multiplier > 0)
    ? Math.ceil(Math.log2(multiplier))
    : null;

  // Check if this is being rendered for Twitter image (using the ref)
  const isForTwitter = ref !== null;

  return (
    <div
      ref={ref}
      data-price-comparison={true}
      // Adjust height slightly if needed for the extra line
      className={`${showExtraSection ? 'h-auto md:h-[370px]' : 'h-auto md:h-[300px]'} w-full max-w-full px-2 md:px-4`}
    >
      <div className={`flex ${isForTwitter ? 'flex-row' : 'flex-col md:flex-row'} justify-between items-center md:items-start mb-4 w-full gap-6 md:gap-0`}>
        {/* SPX6900 Side */}
        <div className={`flex-1 text-white flex flex-col ${isForTwitter ? 'items-center text-center' : 'items-center md:items-start'} w-full md:w-auto`}>
          <div className="flex items-center gap-2 mb-3">
            <img
              src="/spx6900.png"
              alt="SPX6900"
              className="w-6 h-6 md:w-7 md:h-7 mt-7"
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
              className="w-6 h-6 md:w-7 md:h-7 mt-7"
            />
            <span className="text-lg md:text-xl font-bold">S&P 500</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span 
              data-snp-price={true} 
              className="text-2xl md:text-3xl font-bold"
            >
              {formatPrice(snpPrice)}
            </span>
            <span 
              data-snp-change={true}
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
        <div className="mt-3 pt-3 text-center text-white" data-market-cap-section={true}>
          <h3 className="text-base md:text-lg font-semibold mb-3">
            <span className="gold-text">SPX6900</span> WITH THE MARKET CAP OF <span className="gold-text">S&P500</span>
          </h3>
          <div className="flex items-baseline justify-center gap-2 mb-2"> {/* Added mb-2 */}
            <span className="text-xl md:text-2xl font-bold">{formatPrice(priceAtSnPMC)}</span>
            {multiplier !== null && (
              <span className="text-sm md:text-base text-green-400 multiplier-text">
                ({multiplier.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x)
              </span>
            )}
          </div>
          {/* New line for doublings needed */}
          {doublingsNeeded !== null && (
            <p className="text-sm md:text-base text-gray-300">
              SPX6900 ONLY NEEDS TO DOUBLE <span className="font-semibold text-white">{doublingsNeeded}</span> TIMES TO FLIP THE S&P500
            </p>
          )}
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
const VisiblePriceComparison = ({ 
  spxPrice, 
  spxChange, 
  spxMarketCap, 
  snpPrice, 
  snpChange, 
  snpMarketCap 
}: PriceComparisonProps) => {
  const spxChangeFormatted = formatChange(spxChange);
  const snpChangeFormatted = formatChange(snpChange);

  return (
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
          <span className="text-2xl sm:text-3xl font-bold">{formatPrice(spxPrice, 4, 4)}</span>
          <span className={`text-sm sm:text-lg ${spxChangeFormatted.color}`}>{spxChangeFormatted.text}</span>
        </div>
        <div className="text-sm sm:text-base text-gray-300">
          Market Cap: <span className="text-green-400 font-medium">{formatMarketCap(spxMarketCap)}</span>
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
          <span className="text-2xl sm:text-3xl font-bold">{formatPrice(snpPrice)}</span>
          <span className={`text-sm sm:text-lg ${snpChangeFormatted.color}`}>{snpChangeFormatted.text}</span>
        </div>
        <div className="text-sm sm:text-base text-gray-300">
          Market Cap: <span className="text-green-400">{formatMarketCap(snpMarketCap)}</span>
        </div>
      </div>
    </div>
  );
};

interface Profile {
  platform: string;
  profile_url: string;
  image_url: string;
  username: string;
  description: string;
}

// Define type for S&P 500 data (from our new API route)
interface SnpData { // Renamed from AlphaVantageData
  price: number;
  changePercent: number;
  timestamp: number;
}

export default function Page() {
  const priceComparisonRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const confettiImage = useRef<HTMLImageElement | null>(null);
  const [purchasedTokenLogoUrl, setPurchasedTokenLogoUrl] = useState<string | null>(null); // State for the dynamic logo URL
  const [isConfettiImageReady, setIsConfettiImageReady] = useState(false); // State for image loading status

  // Remove backgroundImages state and related code
  const [copyClicked, setCopyClicked] = useState(false);

  const [holdersData, setHoldersData] = useState<DuneDataPoint[]>([]);
  // SPX data state (from CoinGecko)
  const [spxPrice, setSpxPrice] = useState<number | null>(null);
  const [spx24hChange, setSpx24hChange] = useState<number | null>(null);
  const [spxMarketCap, setSpxMarketCap] = useState<number | null>(null);
  // --- Rename state variable ---
  const [snpData, setSnpData] = useState<SnpData | null>(null); // Renamed from snpAlphaVantageData



  // Fetch CoinGecko data (no changes needed here)
  useEffect(() => {
    const fetchSpxPrice = async () => {
      try {
        const response = await fetch('/api/coingecko');
        const data = await response.json();

        if (!response.ok) {
          console.error('Failed to fetch SPX price:', data);
        }

        if (!data.spx6900?.usd) {
          console.error('Invalid price data format:', data);
          throw new Error('Invalid price data format');
        }

        setSpxPrice(data.spx6900.usd);
        setSpx24hChange(data.spx6900.usd_24h_change);
        setSpxMarketCap(data.spx6900.usd_market_cap);
        console.log('CoinGecko data updated successfully:', {
          price: data.spx6900.usd,
          change: data.spx6900.usd_24h_change,
          marketCap: data.spx6900.usd_market_cap
        });
      } catch (error) {
        console.error('Error fetching SPX price:', error);
      }
    };

    fetchSpxPrice();
    // Add interval if needed for CoinGecko data
    // const interval = setInterval(fetchSpxPrice, 60000); // Example: Fetch every minute
    // return () => clearInterval(interval);
  }, []);

  // Fetch S&P 500 data from the new endpoint
  useEffect(() => {
    const fetchSnpData = async () => {
      try {
        // --- Change fetch URL ---
        console.log('Attempting to fetch S&P 500 data from /api/sp500');
        const response = await fetch('/api/sp500'); // Changed URL
        // --- Use renamed type ---
        const data: SnpData | { error: string } = await response.json(); // Use SnpData type

        if (!response.ok || 'error' in data) {
          console.error('Failed to fetch S&P 500 data:', data);
          throw new Error('Failed to fetch S&P 500 data' + ('error' in data ? `: ${data.error}` : ''));
        }

        console.log('S&P 500 data fetched successfully:', data);
        // --- Set renamed state ---
        setSnpData(data); // Set snpData state

      } catch (error) {
        console.error('Error fetching S&P 500 data:', error);
      }
    };

    fetchSnpData(); // Fetch immediately on component mount
    const interval = setInterval(fetchSnpData, 60 * 60 * 1000); // Check every hour
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);


  useEffect(() => {
    const updateWindowDimensions = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);

    // REMOVE initial static image loading from here
    // const img = new window.Image();
    // img.src = 'spx6900.png';
    // img.onload = () => {
    //   confettiImage.current = img;
    // };

    return () => window.removeEventListener('resize', updateWindowDimensions);
  }, []);

  // NEW useEffect: Load confetti image dynamically when purchasedTokenLogoUrl changes
  useEffect(() => {
    if (purchasedTokenLogoUrl) {
      console.log(`Loading confetti image: ${purchasedTokenLogoUrl}`);
      setIsConfettiImageReady(false); // Reset readiness state
      const img = new window.Image();
      img.crossOrigin = "anonymous"; // Attempt to handle potential CORS issues with external images
      img.src = purchasedTokenLogoUrl;
      img.onload = () => {
        console.log(`Confetti image loaded successfully: ${purchasedTokenLogoUrl}`);
        confettiImage.current = img;
        setIsConfettiImageReady(true); // Mark as ready
      };
      img.onerror = (error) => {
        console.error(`Failed to load confetti image: ${purchasedTokenLogoUrl}`, error);
        // Optional: Fallback to a default image or handle the error
        confettiImage.current = null; // Clear ref on error
        setIsConfettiImageReady(false); // Ensure it's not marked as ready
      };
    }
  }, [purchasedTokenLogoUrl]);

  // NEW useEffect: Trigger confetti when the dynamic image is ready
  useEffect(() => {
    if (isConfettiImageReady) {
      console.log('Confetti image is ready, triggering confetti!');
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
        console.log('Confetti timeout reached, hiding confetti.');
        // Optional: Reset purchasedTokenLogoUrl or isConfettiImageReady if needed
        // setPurchasedTokenLogoUrl(null);
         setIsConfettiImageReady(false);
      }, 5000); // Stop confetti after 5 seconds

      return () => clearTimeout(timer); // Cleanup timer on unmount or if readiness changes
    }
  }, [isConfettiImageReady]);

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

 
  // Define token constants with original image URIs


  const [parseHubData, setParseHubData] = useState<any>(null);
  // Renamed state variable for clarity
  const [isParseHubDataLoaded, setIsParseHubDataLoaded] = useState(false);

  // Helper function to parse platforms from HTML string
  const parsePlatformsFromHtml = (htmlString: string) => {
    // Split by svg tags to get individual platform sections
    const platformSections = htmlString.split('<svg').slice(1).map(section => '<svg' + section);
    
    return platformSections.map((section, index) => {
      // Extract SVG (including the opening tag)
      const svgMatch = section.match(/<svg[^>]*>.*?<\/svg>/);
      const svgContent = svgMatch ? svgMatch[0] : '';
      
      // Extract sentiment percentages for this platform
      const sentimentMatch = section.match(/width: ([\d.]+)%.*?background-color: rgb\(246, 80, 108\).*?width: ([\d.]+)%.*?background-color: rgb\(255, 132, 74\).*?width: ([\d.]+)%.*?background-color: rgb\(0, 184, 146\)/);
      
      return {
        name: section, // Keep full section for compatibility
        svgContent: svgContent,
        negative: sentimentMatch ? Number.parseFloat(sentimentMatch[1]) : 0,
        neutral: sentimentMatch ? Number.parseFloat(sentimentMatch[2]) : 0,
        positive: sentimentMatch ? Number.parseFloat(sentimentMatch[3]) : 0
      };
    }).filter(platform => platform.svgContent); // Only include platforms with valid SVG
  };

  // Helper function to parse engagement platforms from HTML string
  const parseEngagementFromHtml = (htmlString: string) => {
    // Split by svg tags to get individual platform sections
    const platformSections = htmlString.split('<svg').slice(1).map(section => '<svg' + section);
    
    return platformSections.map((section, index) => {
      // Extract SVG (including the opening tag)
      const svgMatch = section.match(/<svg[^>]*>.*?<\/svg>/);
      const svgContent = svgMatch ? svgMatch[0] : '';
      
      // Extract engagement percentage for this platform
      const widthMatch = section.match(/width: ([\d.]+)%/);
      
      return {
        name: section, // Keep full section for compatibility
        svgContent: svgContent,
        width: widthMatch ? Number.parseFloat(widthMatch[1]) : 0
      };
    }).filter(platform => platform.svgContent); // Only include platforms with valid SVG
  };

  useEffect(() => {
    const fetchParseHubProjects = async () => {
       setIsParseHubDataLoaded(false); // Reset loading state
      try {
        // REMOVED 'investing.com' project token
        const projectTokens = [
          { token: 'tNUpHFbjsmkA', title: 'lunarcrush.com' },
          { token: 'tPVGTLBpW623', title: 'slickchart' } // Keep for S&P Market Cap
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
        const combinedData = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        console.log('Combined ParseHub data (excluding investing.com):', combinedData);
        setParseHubData(combinedData);
        setIsParseHubDataLoaded(true); // Mark data as loaded *after* setting state
      } catch (error) {
        console.error('Error fetching ParseHub data:', error);
         setIsParseHubDataLoaded(true); // Update loading state even on error
      }
    };

    fetchParseHubProjects();
  }, []);


  const generatePriceImage = async () => {
    console.log('Starting image generation...');
    
    if (!priceComparisonRef.current) {
      console.error('Price comparison ref not found');
      return null;
    }

    // --- Update data availability check ---
    if (!spxPrice || !spxMarketCap || !snpData || !parseHubData) { // Check snpData
       console.error('Data not yet available for image generation:', {
         spxPrice, spxMarketCap, snpData, parseHubData // Use snpData
       });
      return null;
    }

    try {
      // --- Get S&P 500 data from renamed state ---
      const snpPrice = snpData.price; // Use snpData
      const snpChange = snpData.changePercent; // Use snpData
      const snpMarketCap = parseSnpMarketCap(parseHubData);

      console.log('Data for image generation:', { spxPrice, spx24hChange, spxMarketCap, snpPrice, snpChange, snpMarketCap });

      if (snpMarketCap === null) {
          console.error('Could not parse S&P 500 Market Cap from ParseHub data.');
        return null;
      }

      // Render the PriceComparison component with current data *temporarily*
      // We will update the clone with the exact values later in onclone
      const element = priceComparisonRef.current;
      
      // ... (rest of the styling logic for element and its children - NO CHANGES NEEDED HERE) ...
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
      
      // Force horizontal layout (apply styles as before)
      // ... apply force-horizontal styles directly or via class toggle ...
      // Example: apply styles directly as in the original code...
      const mainFlexContainer = element.querySelector('[data-price-comparison] > div');
      // ... apply styles to mainFlexContainer, separator, spxSide, snpSide, extraSection ...

      // Wait for images to load
      // ... (image loading logic remains the same) ...
      const images = element.getElementsByTagName('img');
      await Promise.all(
        Array.from(images).map(
          img => 
            new Promise((resolve) => {
              if (img.complete) {
                resolve(null);
              } else {
                img.onload = () => resolve(null);
                 img.onerror = () => resolve(null); // Resolve even on error
              }
            })
        )
      );

      // Add a small delay
      await new Promise(resolve => setTimeout(resolve, 150)); // Slightly increased delay

      console.log('Starting html2canvas capture...');
      const canvas = await html2canvas(element, {
        backgroundColor: '#131827',
        scale: 2,
        logging: true,
        useCORS: true, // Important for external images if useCORS doesn't cover everything
        imageTimeout: 3000, // Increased timeout
        width: 600,
        height: 350,
        onclone: (clonedDoc) => {
          console.log('html2canvas onclone callback triggered');

          // Find the container corresponding to the element passed to html2canvas
          // This element has the data-twitter-image="true" attribute
          const capturedContainer = clonedDoc.body.querySelector('[data-twitter-image="true"]');

          if (capturedContainer instanceof HTMLElement) {
            console.log('Found captured container [data-twitter-image="true"] within cloned body.');

            // Now find the target element '[data-price-comparison]' WITHIN the captured container
            const clonedElement = capturedContainer.querySelector('[data-price-comparison]');

            if (clonedElement instanceof HTMLElement) {
              console.log('Found target element [data-price-comparison] within captured container.');
              // --- Re-apply styles within the clone ---
              const mainFlex = clonedElement.querySelector(':scope > div:first-child');
              if (mainFlex instanceof HTMLElement) {
                  mainFlex.style.display = 'flex';
                  mainFlex.style.flexDirection = 'row';
                  mainFlex.style.alignItems = 'flex-start';
                  mainFlex.style.justifyContent = 'space-between';
              }

              // Style SPX side
              const spxSideClone = clonedElement.querySelector(':scope > div:first-child > div:nth-child(1)');
              if (spxSideClone instanceof HTMLElement) {
                 spxSideClone.style.setProperty('flex', '1', 'important');
                 spxSideClone.style.setProperty('min-width', '0', 'important');
                 spxSideClone.style.setProperty('text-align', 'center', 'important');

                 // --- Style SPX Logo and Title Container ---
                 const spxTitleContainer = spxSideClone.querySelector(':scope > div');
                 if (spxTitleContainer instanceof HTMLElement) {
                     spxTitleContainer.style.setProperty('display', 'inline-flex', 'important');
                     spxTitleContainer.style.setProperty('align-items', 'center', 'important');
                     spxTitleContainer.style.setProperty('gap', '8px', 'important');
                     spxTitleContainer.style.setProperty('margin-bottom', '10px', 'important');
                 }

                 // --- Style SPX Logo and Title ---
                 const spxLogo = spxSideClone.querySelector('img');
                 const spxTitle = spxSideClone.querySelector('span');

                 if (spxLogo instanceof HTMLImageElement) {
                     spxLogo.style.setProperty('width', '50px', 'important');
                     spxLogo.style.setProperty('height', '50px', 'important');
                 }
                 if (spxTitle instanceof HTMLElement) {
                     spxTitle.style.setProperty('font-size', '36px', 'important');
                     spxTitle.style.setProperty('font-weight', 'bold', 'important');
                     spxTitle.style.setProperty('white-space', 'nowrap', 'important');
                     spxTitle.style.removeProperty('margin-left');
                     spxTitle.style.setProperty('position', 'relative', 'important');
                     spxTitle.style.setProperty('top', '-5px', 'important');
                 }
              }

              // Style SNP side
              const snpSideClone = clonedElement.querySelector(':scope > div:first-child > div:nth-child(3)');
              if (snpSideClone instanceof HTMLElement) {
                  snpSideClone.style.setProperty('flex', '1', 'important');
                  snpSideClone.style.setProperty('min-width', '0', 'important');
                  snpSideClone.style.setProperty('text-align', 'center', 'important');

                  // --- Style SNP Logo and Title Container ---
                  const snpTitleContainer = snpSideClone.querySelector(':scope > div');
                  if (snpTitleContainer instanceof HTMLElement) {
                      snpTitleContainer.style.setProperty('display', 'inline-flex', 'important');
                      snpTitleContainer.style.setProperty('align-items', 'center', 'important');
                      snpTitleContainer.style.setProperty('gap', '8px', 'important');
                      snpTitleContainer.style.setProperty('margin-bottom', '10px', 'important');
                  }

                  // --- Style SNP Logo and Title ---
                  const snpLogo = snpSideClone.querySelector('img');
                  const snpTitle = snpSideClone.querySelector('span');

                  if (snpLogo instanceof HTMLImageElement) {
                      snpLogo.style.setProperty('width', '50px', 'important');
                      snpLogo.style.setProperty('height', '50px', 'important');
                  }
                  if (snpTitle instanceof HTMLElement) {
                      snpTitle.style.setProperty('font-size', '36px', 'important');
                      snpTitle.style.setProperty('font-weight', 'bold', 'important');
                      snpTitle.style.setProperty('white-space', 'nowrap', 'important');
                      snpTitle.style.removeProperty('margin-left');
                     snpTitle.style.setProperty('position', 'relative', 'important');
                     snpTitle.style.setProperty('top', '-5px', 'important');
                  }
              }

              // --- End Style SNP Logo and Title --- // This comment seems misplaced now, just leaving it as is.

              // Style bottom section
              // ... (rest of style logic remains the same) ...

              // --- End Re-apply styles ---


              // --- Update dynamic content in the clone ---
              // ... (rest of data update logic remains the same) ...

              // --- End Update dynamic content ---

              // Ensure visibility for capture
              clonedElement.style.position = 'static';
              clonedElement.style.left = '0';
              clonedElement.style.top = '0';
              clonedElement.style.visibility = 'visible';
              clonedElement.style.opacity = '1';

            } else {
              // Error if [data-price-comparison] is not found *inside* the container
              console.error("Target element '[data-price-comparison]' NOT found within captured container.", {
                expectedAttribute: '[data-price-comparison]',
                containerFound: capturedContainer,
                containerOuterHTML: capturedContainer.outerHTML // Log the container's structure
              });
            }
          } else {
            // Error if the container [data-twitter-image="true"] is not found in the body
            console.error("Captured container '[data-twitter-image=\"true\"]' NOT found within cloned document body.", {
              expectedAttribute: '[data-twitter-image="true"]',
              clonedBodyOuterHTML: clonedDoc.body.outerHTML // Log the entire body structure
            });
          }
        }
      });

      // Restore original styles
      // ... (restore styles logic remains the same) ...
      element.style.visibility = originalStyles.visibility;
      element.style.position = originalStyles.position;
      // ... restore other styles ...

      
      console.log('Canvas generated successfully');

      // Return blob promise (no changes needed here)
      return new Promise<Blob>((resolve, reject) => {
          try { // Add try...catch inside the promise executor
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  console.log('Blob created successfully');
                  resolve(blob);
                } else {
                  console.error('Blob creation failed: canvas.toBlob returned null');
                  reject(new Error('Blob creation failed: canvas.toBlob returned null'));
                }
              },
              'image/png', // Or your desired format
              1.0 // Optional quality
            );
          } catch (error) {
            console.error('Error during canvas.toBlob call:', error);
            reject(error); // Reject the promise if blob creation throws
          }
      });
    } catch (error) {
      console.error('Detailed error in generatePriceImage:', error);
      // Restore styles in case of error before canvas generation
      if (priceComparisonRef.current) {
          // ... restore styles ...
      }
      return null;
    }
  };


  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  // --- Update readiness check ---
  const isDataReadyForShare = spxPrice !== null && spxMarketCap !== null && snpData !== null && isParseHubDataLoaded; // Use snpData

  const handleShareToX = async () => {
    setIsGeneratingImage(true);

    if (!isDataReadyForShare) { // Uses updated check
        console.error('Attempted to share before all data was loaded.');
        setIsGeneratingImage(false);
        return;
    }

    try {
      const imageBlob = await generatePriceImage(); // generatePriceImage uses updated snpData
      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      // ... (rest of the image upload and Twitter intent logic - NO CHANGES NEEDED HERE) ...
      const formData = new FormData();
      formData.append('image', imageBlob, 'price-comparison.png');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
         // ... error handling ...
         throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const blobUrl = data.imageUrl;
      const filename = blobUrl.substring(blobUrl.lastIndexOf('/') + 1);
      const siteUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
      const sharePageUrl = `${siteUrl}/share/${filename}`;
       const tweetText = `#SPX #SPX6900\n`; // Add more dynamic text if needed

      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(sharePageUrl)}`,
        '_blank'
      );

    } catch (error) {
      console.error('Error sharing to X:', error);
      // toast.error(error instanceof Error ? error.message : 'Failed to share'); // Removed toast
    } finally {
      setIsGeneratingImage(false);
    }
    // --- Update dependencies ---
  };

  // Helper function to get S&P 500 Market Cap from ParseHub data
  const parseSnpMarketCap = (data: any): number | null => {
    const mcStr = data?.slickchart?.marketcap; // Still use slickchart data
    if (typeof mcStr === 'string') {
      const value = Number.parseFloat(mcStr.replace(/[^0-9.]/g, ''));
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

  // Callback function for when confetti animation completes
  const handleConfettiComplete = () => {
      console.log('Confetti animation complete, hiding confetti.');
      setShowConfetti(false);
      confettiImage.current = null; // Optional: clear the image ref after use
  };

  return (
    <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden relative">
      {/* Fixed background MOVED OUTSIDE main */}
      <div className="fixed inset-0 z-0 bg-[#131827] pointer-events-none"></div>

      {/* Fixed Hamburger Menu MOVED OUTSIDE main */}
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
          {/* Wallet functionality removed */}
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

      <main className="flex-1 w-full px-4 sm:px-6 py-8 pb-4">
        {/* Removed fixed background div from here */}
        {/* Removed fixed hamburger menu div from here */}

        {/* Main content wrapper */}
        <div className="relative z-10 pt-20 sm:pt-24 w-full max-w-6xl mx-auto">
          {showConfetti && confettiImage.current && createPortal(
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 10000 }}>
              <Confetti
                width={windowDimensions.width}
                height={windowDimensions.height}
                recycle={false} // Keep recycle false so it eventually completes
                numberOfPieces={200} // Adjust if needed
                gravity={0.5} // Adjust if needed
                initialVelocityY={5} // Adjust if needed
                confettiSource={{
                  x: 0,
                  y: 0,
                  w: windowDimensions.width,
                  h: 0
                }}
                onConfettiComplete={handleConfettiComplete} // Add the completion handler
                drawShape={ctx => {
                  if (confettiImage.current) {
                    const size = 40;
                    ctx.drawImage(confettiImage.current, -size / 2, -size / 2, size, size);
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[100%] bg-gradient-to-r from-[#FFD700]/10 via-[#FFA500]/10 to-[#FFFF99]/10 rounded-[40px] blur-[20px]"></div>
              </div>
              
              {/* Text with gradient */}
              <h1 className="relative z-10 text-7xl sm:text-8xl md:text-9xl font-bold text-center p-4 header-text">
                <span className="flip-word">flip</span> the stock market
              </h1>
            </div>
            
            {/* Price Comparison Section - Pass updated props */}
            <div className="flex flex-row w-full max-w-4xl gap-4 justify-center mx-auto">
              <div className="flex-1 p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl">
                <VisiblePriceComparison 
                  spxPrice={spxPrice}
                  spxChange={spx24hChange}
                  spxMarketCap={spxMarketCap}
                  // Use data from renamed state
                  snpPrice={snpData?.price ?? null}
                  snpChange={snpData?.changePercent ?? null}
                  snpMarketCap={parseSnpMarketCap(parseHubData)} // Still from ParseHub
                />
              </div>
            </div>

            {/* Post to X Button - Use updated readiness check */}
            <button
              onClick={handleShareToX}
              disabled={!isDataReadyForShare || isGeneratingImage} // Uses updated check
              className={`w-full max-w-[450px] mx-auto bg-[#1B2236] hover:bg-[#1B2236]/80 text-white rounded-md p-3 flex items-center justify-center gap-3 transition-all duration-200 backdrop-blur-sm mt-3 border border-white/10 ${
                !isDataReadyForShare || isGeneratingImage ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-base font-medium">
                {isDataReadyForShare ? isGeneratingImage ? (
                  <>
                    Preparing image... 
                    {/* ... spinner svg ... */}
                  </>
                ) : (
                  <>
                    Post to <img src="/x-logo.svg" alt="X Logo" className="w-5 h-5" />
                  </>
                ) : ( // Check combined state
                  'Loading market data...'
                )}
              </span>
            </button>

            {/* Market Cap Calculator Section - Ensure data dependencies */}
            <div className="w-full max-w-4xl mx-auto p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl mt-4">
              <h2 className="text-2xl font-bold text-white text-center mb-4">
                <span className="gold-text">SPX6900</span> WITH THE MARKET CAP OF <span className="gold-text">S&P500</span>
              </h2>
              {/* Check for spxPrice, spxMarketCap and parseHubData.slickchart */}
              {isParseHubDataLoaded && parseHubData?.slickchart?.marketcap && spxPrice && spxMarketCap && spxMarketCap > 0 && (
                <div className="text-xl font-bold text-white text-center mb-4">
                   {/* ... calculation logic using parseSnpMarketCap(parseHubData) ... */}
                    <img src="/spx6900.png" alt="SPX6900" className="w-8 h-8 inline-block mr-2 align-middle"/>
                  <span id="calculatedValue">
                      ${(() => {
                          const snpMC = parseSnpMarketCap(parseHubData);
                          if (snpMC === null) return 'N/A';
                          return (snpMC * (spxPrice / spxMarketCap)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                  </span>
                  <span className="text-green-400 ml-2">
                     ({(() => {
                         const snpMC = parseSnpMarketCap(parseHubData);
                         if (snpMC === null) return 'N/A';
                         return (snpMC / spxMarketCap).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                     })()}x)
                  </span>
                </div>
              )}
              {/* Calculator Input - Ensure data dependencies */}
               {isParseHubDataLoaded && parseHubData?.slickchart?.marketcap && spxPrice && spxMarketCap && spxMarketCap > 0 && (
                <div className="flex flex-col items-center gap-2">
                  {/* ... input field and onChange logic using parseSnpMarketCap(parseHubData) ... */}
                  <div className="flex w-full max-w-[400px]">
                    <input
                      type="number"
                       placeholder="Amount (SPX)"
                      className="w-full px-4 py-3 rounded-l-lg bg-[#131827] text-white placeholder-white/50 border border-white/10 focus:outline-none focus:border-white/30 text-lg"
                      onChange={(e) => {
                        const value = e.target.value;
                        const element = document.getElementById('calculatedValue');
                        if (element) {
                          const amount = Number.parseFloat(value);
                           const snpMC = parseSnpMarketCap(parseHubData);
                           if (snpMC === null) {
                              element.textContent = 'N/A';
                              return;
                           }
                           const baseValue = snpMC * (spxPrice / spxMarketCap);
                          if (!value || !amount || amount <= 0) {
                             element.textContent = `$${baseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          } else {
                             const multiplier = snpMC / spxMarketCap;
                             element.textContent = `$${(amount * spxPrice * multiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            <div className="w-full max-w-4xl mx-auto items-center justify-center rounded-xl bg-transparent mt-4 mb-4">
              <div className="flex flex-col items-center w-full">
                <h1 className="text-5xl font-bold text-center text-white mb-6">
                  Buy SPX6900
                </h1>
                  <div className="w-full bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md px-8 py-8 mb-4">
                    {/* Recommended heading */}
                    <h3 className="text-xl font-bold text-white mb-4">Recommended</h3>
                    
                    {/* DCASPX.COM Link */}
                    <a 
                      href="https://dcaspx.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-4 mb-6 flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer"
                    >
                      <img src="/spx6900.png" alt="SPX6900" className="h-8" />
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-lg font-medium">DCASPX.COM</span>
                        <p className="text-sm opacity-75 text-center">(DCA Strategy)</p>
                      </div>
                    </a>

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
                        { name: 'INFINEX', url: 'https://app.infinex.xyz/?r=1ES7E678', icon: '/Infinex_Logo_Cantaloupe.svg' },
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
          {/* SPX6900 Holders Chart - Standalone */}
          <div className="w-full max-w-4xl mx-auto mb-4 p-2">
            <div className="bg-[#1B2236]/40 backdrop-blur-md p-4 rounded-xl">
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
          </div>

          {/* Sentiment and Engagement Section */}
          <div className="w-full max-w-4xl mx-auto space-y-4 p-2">
                {/* Sentiment by Network */}
                <div className="bg-[#1B2236]/40 backdrop-blur-md p-4 rounded-xl">
                  <h2 className="text-xl font-bold mb-4 text-center text-white">Sentiment by Network</h2>
                  {/* Use isParseHubDataLoaded */}
                  {isParseHubDataLoaded && parseHubData?.['lunarcrush.com']?.sentiment ? (
                    <div className="space-y-4">
                      {parseHubData?.['lunarcrush.com']?.sentiment?.[0]?.name && 
                        parsePlatformsFromHtml(parseHubData?.['lunarcrush.com']?.sentiment[0].name).map((platform: any, index: number) => {
                          let svgContent = platform.svgContent;
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
                                  <div className="h-full bg-[#f6506c] hover:brightness-125 hover:shadow-[0_0_15px_rgba(246,80,108,0.5)] transition-all duration-300" style={{ width: `${platform.negative}%` }} />
                                  <div className="h-full bg-[#ff844a] hover:brightness-125 hover:shadow-[0_0_15px_rgba(255,132,74,0.5)] transition-all duration-300" style={{ width: `${platform.neutral}%` }} />
                                  <div className="h-full bg-[#00b892] hover:brightness-125 hover:shadow-[0_0_15px_rgba(0,184,146,0.5)] transition-all duration-300" style={{ width: `${platform.positive}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400">Loading sentiment data...</p>
                  )}
                </div>

                {/* Engagements by Network */}
                <div className="bg-[#1B2236]/40 backdrop-blur-md p-4 rounded-xl">
                  <h2 className="text-xl font-bold mb-4 text-center text-white">Engagements by Network</h2>
                  {/* Use isParseHubDataLoaded */}
                  {isParseHubDataLoaded && parseHubData?.['lunarcrush.com']?.engagement ? (
                    <div className="space-y-4">
                      {parseHubData?.['lunarcrush.com']?.engagement?.[0]?.name && 
                        parseEngagementFromHtml(parseHubData?.['lunarcrush.com']?.engagement[0].name).map((platform: any, index: number) => {
                          let svgContent = platform.svgContent;
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
                                  style={{ width: `${platform.width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400">Loading engagement data...</p>
                  )}
                </div>
          </div>
        </div>

      </main>

      {/* Footer positioned outside of main */}
      <Footer />

      {/* Hidden element for Twitter image generation - Pass updated props */}
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
          padding: '20px 40px', // Reduced vertical padding from 30px to 20px
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        className="force-horizontal" // Keep the class for CSS targeting if needed
        data-twitter-image="true"
      >
         {/* Render PriceComparison with data from state */}
         {/* It's okay if data is initially null, the onclone function will update it */}
        <PriceComparison
          spxPrice={spxPrice}
          spxChange={spx24hChange}
          spxMarketCap={spxMarketCap}
          snpPrice={snpData?.price ?? null}
          snpChange={snpData?.changePercent ?? null}
          snpMarketCap={parseSnpMarketCap(parseHubData)} // Still from ParseHub
          showExtraSection={true}
        />
      </div>
    </div> // End root div
  );
}
