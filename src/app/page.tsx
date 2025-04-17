'use client';
import Footer from 'src/components/Footer';
import { useAccount, useBalance, useBlockNumber, useReadContracts } from 'wagmi';
import LoginButton from '../components/LoginButton';
import SignupButton from '../components/SignupButton';
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
import WalletWrapper from '../components/WalletWrapper';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import html2canvas from 'html2canvas';
import { toast } from 'react-hot-toast';

const FALLBACK_DEFAULT_MAX_SLIPPAGE = 3;
const defaultMaxSlippage = 3;

type DuneDataPoint = {
  date: string;
  holders: number;
  percentChange: number;
};

export default function Page() {
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

  // Add a ref for the price comparison section
  const priceComparisonRef = useRef<HTMLDivElement>(null);

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

    // Load the confetti image
    const img = new Image();
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
 
  const SPXToken: Token = {
    address: "0x50da645f148798f68ef2d7db7c1cb22a6819bb2c",
    chainId: 8453,
    decimals: 8,
    name: "SPX6900",
    symbol: "SPX",
    image: "https://assets.coingecko.com/coins/images/31401/standard/sticker_%281%29.jpg?1702371083"

  };

  const USDCToken: Token = {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: 8453,
    decimals: 6,
    name: "USDC",
    symbol: "USDC",
    image: "https://dynamic-assets.coinbase.com/3c15df5e2ac7d4abbe9499ed9335041f00c620f28e8de2f93474a9f432058742cdf4674bd43f309e69778a26969372310135be97eb183d91c492154176d455b8/asset_icons/9d67b728b6c8f457717154b3a35f9ddc702eae7e76c4684ee39302c4d7fd0bb8.png",
  };

  const swappableTokens: Token[] = [SPXToken, USDCToken];

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
        setParseHubData(combinedData);
      } catch (error) {
        console.error('Error fetching ParseHub data:', error);
      }
    };

    fetchParseHubProjects();
    const interval = setInterval(fetchParseHubProjects, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCoinbaseWalletClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent the original click from triggering the wallet connection
    event.preventDefault();
    event.stopPropagation();
    
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Wait for the scroll to complete (smooth scroll takes about 500ms)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find and click the login button at the top
    const loginButton = document.querySelector('[data-testid="ockConnectWallet_Container"]') as HTMLElement;
    if (loginButton) {
      loginButton.click();
    }
  };

  const generatePriceImage = async () => {
    if (!priceComparisonRef.current) return null;

    try {
      // Create canvas from the price comparison div
      const canvas = await html2canvas(priceComparisonRef.current, {
        backgroundColor: '#1B2236',
        scale: 3, // Higher resolution
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          // Get the cloned element that will be rendered
          const clonedElement = clonedDoc.querySelector('[data-price-comparison]');
          if (clonedElement) {
            // Force image dimensions and alignment in the cloned DOM
            const images = clonedElement.getElementsByTagName('img');
            for (const img of images) {
              img.style.width = '24px';
              img.style.height = '24px';
              img.style.display = 'block';
              img.style.objectFit = 'contain';
              img.style.verticalAlign = 'middle';
            }
          }
        }
      });

      // Get the canvas context for adding the watermark
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Set up the gradient for the text
      const gradient = ctx.createLinearGradient(
        canvas.width - 300, // Start x
        canvas.height - 30, // Start y
        canvas.width - 20,  // End x
        canvas.height - 30  // End y
      );
      gradient.addColorStop(0, '#ff69b4');   // Pink
      gradient.addColorStop(0.5, '#ff8c00');  // Orange
      gradient.addColorStop(1, '#4caf50');    // Green

      // Configure text style
      ctx.font = 'bold 24px Inter, system-ui, sans-serif';
      ctx.fillStyle = gradient;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      // Add the watermark text
      ctx.fillText(
        'Source: FlipTheStockMarket.com', 
        canvas.width - 20,  // x position (20px from right)
        canvas.height - 20  // y position (20px from bottom)
      );

      // Convert canvas to blob
      return new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          }
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  };

  const handleShareToX = useCallback(async () => {
    const loadingToast = toast.loading('Generating image...');

    try {
      const imageBlob = await generatePriceImage();
      if (!imageBlob) {
        throw new Error('Failed to generate image');
      }

      // Create form data for the image
      const formData = new FormData();
      formData.append('image', imageBlob, 'price-comparison.png');

      // Upload to temporary storage
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

      // Construct the URL for your new share page
      // Make sure NEXT_PUBLIC_URL is set correctly in your env
      const siteUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
      const sharePageUrl = `${siteUrl}/share/${filename}`;

      // Create tweet text with a line break
      const tweetText = `#SPX #SPX6900\n`;

      // Open Twitter Web Intent with the *share page* URL
      window.open(
        // Use sharePageUrl instead of blobUrl (data.imageUrl)
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(sharePageUrl)}`,
        '_blank'
      );

      toast.success('Ready to post!', {
        id: loadingToast,
      });
    } catch (error) {
      console.error('Error sharing to X:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate image', {
        id: loadingToast,
      });
    }
  }, [priceComparisonRef]);

  return (
    <>
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
          <SignupButton />
          {!address && <LoginButton />}
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

      {/* Existing content wrapper */}
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
          <div className="relative w-full max-w-3xl mx-auto mb-8">
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
          
          <div className="flex flex-row w-full gap-4 justify-center">
            {/* Price Comparison Section */}
            <div className="flex-1 p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl">
              {/* Price comparison content - this will be captured in the screenshot */}
              <div 
                ref={priceComparisonRef}
                data-price-comparison
                className="flex flex-row w-full gap-4 justify-center"
              >
                {/* SPX6900 Price Card */}
                <div className="flex-1 text-white bg-[#1B2236] bg-opacity-70 rounded-md p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <img 
                      src="/spx6900.png" 
                      alt="SPX6900" 
                      className="w-6 h-6"
                    />
                    <span className="text-xl font-bold">S&P 6900</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold">$0.4649</span>
                    <span className="text-red-400">(-4.92%)</span>
                  </div>
                  <div className="text-sm mt-0.5">
                    Market Cap: <span className="text-green-400">$429.55M</span>
                  </div>
                </div>

                {/* S&P 500 Price Card */}
                <div className="flex-1 text-white bg-[#1B2236] bg-opacity-70 rounded-md p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <img 
                      src="/spx500-logo-circle.png" 
                      alt="S&P 500" 
                      className="w-6 h-6"
                    />
                    <span className="text-xl font-bold">S&P 500</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold">$5,396.52</span>
                    <span className="text-red-400">(-4.84%)</span>
                  </div>
                  <div className="text-sm mt-0.5">
                    Market Cap: <span className="text-green-400">$45.388T</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Post to X Button - moved outside the screenshot section */}
          <button
            onClick={handleShareToX}
            className="w-full max-w-[450px] mx-auto bg-[#1B2236] hover:bg-[#1B2236]/80 text-white rounded-md p-2.5 flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm mt-3"
          >
            <span className="flex items-center gap-2">
              Post to <img src="/x-logo.svg" alt="X Logo" className="w-4 h-4" />
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
          <div className="w-full items-center justify-center rounded-xl bg-transparent mt-4 mb-8">
            {address ? (
              <div className="w-full max-w-[450px] mx-auto relative">
                {address && onrampBuyUrl && (
                  <div className="absolute right-4 top-4 z-[1]">
                    <FundButton
                      fundingUrl={onrampBuyUrl}
                      text="BUY USDC"
                      className="!bg-white/5 hover:!bg-white/10 !text-white !text-[24px] !font-semibold !py-1 !px-3 !rounded-lg !leading-none transition-all duration-200"
                    />
                  </div>
                )}
                <Swap
                  className="w-full bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md text-white [&_*]:text-white [&_p]:text-white [&_span]:text-white [&_div]:text-white [&_input]:bg-[#1B2236] [&_button]:bg-[#1B2236] [&_.swap-input]:!bg-[#1B2236] [&_.swap-input-container]:!bg-[#1B2236] [&_.swap-button]:!bg-[#1B2236] [&_.swap-message]:!bg-[#1B2236] [&_*]:!bg-[#1B2236] [&_*]:!bg-opacity-70 [&_.token-selector]:!bg-[#1B2236] [&_.token-selector-button]:!bg-[#1B2236] [&_.token-list]:!bg-[#1B2236] [&_.input-container]:!bg-[#1B2236] [&_button]:!flex [&_button]:!justify-center [&_button]:!items-center [&_svg]:!text-white [&_svg]:!fill-white [&_[data-testid='ockSwap_title']]:!bg-transparent"
                  onStatus={handleOnStatus}
                  onSuccess={handleOnSuccess}
                  onError={handleOnError}
                  config={{
                    maxSlippage: defaultMaxSlippage || FALLBACK_DEFAULT_MAX_SLIPPAGE,
                  }}
                  isSponsored={true}
                >
                  <SwapAmountInput
                    label="Sell"
                    swappableTokens={swappableTokens}
                    token={USDCToken}
                    type="from"
                  />
                  <SwapToggleButton className="!border-0 !bg-transparent !text-white [&_svg]:!text-white [&_svg]:!fill-white [&_path]:!stroke-white scale-100 !p-1 hover:!bg-[#1B2236] transition-all duration-200 !z-0 !w-8 !h-8 rounded-lg"/>
                  <SwapAmountInput
                    label="Buy"
                    swappableTokens={swappableTokens}
                    token={SPXToken}
                    type="to"
                  />
                  <SwapButton />
                  <SwapMessage />
                  <SwapToast position="bottom-center" durationMs={10000}/>
                </Swap>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                <h1 className="text-5xl font-bold text-center text-white mb-6">
                  Buy SPX6900
                </h1>
                <div className="w-full bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md px-8 py-10 mb-8">
                  {/* Recommended heading */}
                  <h3 className="text-xl font-bold text-white mb-4">Recommended</h3>
                  
                  {/* Replace the existing Coinbase Wallet button section with this */}
                  <div className="w-full bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-4 mb-8 flex items-center justify-center gap-3 transition-all duration-200">
                    <img src="/Coinbase_Coin_Primary.png" alt="Coinbase" className="h-8" />
                    <div className="flex flex-col items-center justify-center">
                      <WalletWrapper
                        text="Coinbase Wallet"
                        withWalletAggregator={false}
                        className="w-full bg-transparent hover:bg-transparent !p-0 !m-0 flex justify-center items-center"
                      />
                      <p className="text-sm opacity-75 text-center">(0% fees)</p>
                    </div>
                  </div>

                  {/* Centralized Exchanges */}
                  <h3 className="text-xl font-bold text-white mb-4">Centralized Exchanges</h3>
                  <div className="grid grid-cols-3 gap-4 w-full mb-8">
                    {[
                      { name: 'Bybit', url: 'https://www.bybit.com/trade/spot/SPX/USDT/', icon: '/bybit.svg' },
                      { name: 'Kraken', url: 'https://pro.kraken.com/app/trade/SPX-USD', icon: '/kraken.svg' },
                      { name: 'KuCoin', url: 'https://www.kucoin.com/trade/SPX-USDT', icon: '/kukoin.svg' }
                    ].map((exchange) => (
                      <a
                        key={exchange.name}
                        href={exchange.url}
                        className="bg-[#1B2236]/70 hover:bg-[#1B2236]/90 text-white rounded-xl p-3 flex items-center justify-center transition-all duration-200"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="h-10 w-24 flex items-center justify-center">
                          <img src={exchange.icon} alt={exchange.name} className="max-h-8 max-w-full object-contain" />
                        </div>
                      </a>
                    ))}
                  </div>

                  {/* Onchain Exchanges */}
                  <h3 className="text-xl font-bold text-white mb-4">Onchain Exchanges</h3>
                  <div className="grid grid-cols-3 gap-4 w-full mb-8">
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
                        <div className="flex flex-col items-center justify-center h-10">
                          <div className="flex items-center justify-center">
                            <img src={exchange.icon} alt={exchange.name} className="max-h-8 max-w-[75px] object-contain" />
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
                  <div className="grid grid-cols-3 gap-4 w-full">
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
                        <div className="h-10 w-24 flex items-center justify-center">
                          <img src={wallet.icon} alt={wallet.name} className="max-h-8 max-w-full object-contain" />
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
        <div className="w-full max-w-[1200px] mx-auto mb-8 p-4 mt-0">
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

        {/* Links and Dropdowns Section */}
        <div className="w-full max-w-[1200px] mx-auto mb-8 p-4">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a 
              href="https://spx6900.com/"
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#1B2236] bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
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
              className="px-4 py-2 bg-[#1B2236] bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
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
              className="px-4 py-2 bg-[#1B2236] bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
            >
              <span className="mr-2">🎥 How to Buy (Video Guide)</span>
              <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'howToBuyVideo' ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <button 
              onClick={() => toggleDropdown('sponsoredBuys')}
              className="px-4 py-2 bg-[#1B2236] bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
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

        <Footer />
      </div>
    </>
  );
}
