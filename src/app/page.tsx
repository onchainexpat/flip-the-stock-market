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
import { ParseHubClient, type ParseHubProject } from '../utils/ParseHubClient';

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
        
        const formattedData = data.map((row: any, index: number, array: any[]) => {
          const prevDay = index > 0 ? array[index - 1].holder_count : row.holder_count;
          const percentChange = ((row.holder_count - prevDay) / prevDay * 100).toFixed(2);
          
          return {
            date: row.block_date.split(' ')[0],
            holders: row.holder_count,
            percentChange: Number(percentChange)
          };
        });
        
        setHoldersData(formattedData);
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

  return (
    <>
      {/* Replace the GIF background div with the new color */}
      <div className="fixed inset-0 z-0 bg-[#131827]"></div>

      {/* Hamburger Menu */}
      <div className="fixed top-4 left-4 z-50">
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
        
        {isMenuOpen && (
          <div className="absolute top-12 left-0 bg-black/90 backdrop-blur-md rounded-lg shadow-lg border border-white/10">
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
      <div className="relative z-10 pt-20 sm:pt-10">
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
        <section className="mt-6 mb-6 flex w-full flex-col">
          <div className="flex w-full flex-row items-center justify-between gap-2">
            <div>
              {address && onrampBuyUrl && (
                <FundButton
                  fundingUrl={onrampBuyUrl}
                  text="Get USDC"
                  className="bg-blue-500 hover:bg-blue-600 font-bold py-2 px-4 rounded"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <SignupButton />
              {!address && <LoginButton />}
            </div>
          </div>
        </section>
        <section className="templateSection flex w-full flex-col items-center justify-center gap-4 rounded-xl bg-transparent px-2 py-4">
          <h1 className="text-5xl font-bold text-center mb-4 p-4 relative">
            {/* Background gradient div */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#ff69b4]/20 via-[#ff8c00]/20 to-[#4caf50]/20 rounded-xl blur-lg"></div>
            
            {/* Text with gradient */}
            <span className="relative bg-gradient-to-r from-[#ff69b4] via-[#ff8c00] to-[#4caf50] text-transparent bg-clip-text">
              flip the stock market
            </span>
          </h1>
          
          <div className="flex flex-row w-full gap-4 justify-center">
            {/* Price Comparison Section */}
            <div className="flex-1 p-4 bg-[#1B2236]/40 backdrop-blur-md rounded-xl">
              <div className="flex flex-row w-full gap-4 justify-center">
                {/* SPX6900 Price Card */}
                <div className="flex-1 text-xl sm:text-2xl font-bold text-white text-center mb-2 bg-[#1B2236] bg-opacity-70 rounded-md p-2 sm:p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-2">
                    <img 
                      src="/spx6900.png" 
                      alt="SPX6900" 
                      className="w-6 h-6 sm:w-8 sm:h-8 mr-2"
                    />
                    <span>S&P 6900</span>
                  </div>
                  {spxPrice !== null && (
                    <>
                      <div className="text-lg sm:text-2xl">${spxPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4
                      })}
                      {spx24hChange !== null && (
                        <span className={spx24hChange >= 0 ? "text-green-400" : "text-red-400"}>
                          {' '}({spx24hChange >= 0 ? '+' : ''}{spx24hChange.toFixed(2)}%)
                        </span>
                      )}
                      </div>
                      {spxMarketCap !== null && (
                        <div className="text-sm sm:text-lg mt-1">
                          Market Cap: <span className="text-green-400">${(spxMarketCap / 1000000).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}M</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* S&P 500 Price Card */}
                <div className="flex-1 text-xl sm:text-2xl font-bold text-white text-center mb-2 bg-[#1B2236] bg-opacity-70 rounded-md p-2 sm:p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-2">
                    <span>S&P 500</span>
                  </div>
                  {parseHubData?.['investing.com'] && (
                    <>
                      <div className="text-lg sm:text-2xl">${parseHubData['investing.com'].lastprice}
                      {parseHubData['investing.com'].changepercent && (
                        <span className={!parseHubData['investing.com'].changepercent.startsWith('-') ? "text-green-400" : "text-red-400"}>
                          {' '}({parseHubData['investing.com'].changepercent})
                        </span>
                      )}
                      </div>
                      {parseHubData?.slickchart?.marketcap && (
                        <div className="text-sm sm:text-lg mt-1">
                          Market Cap: <span className="text-green-400">{parseHubData.slickchart.marketcap.replace(' trillion', 'T')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

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

          {/* Swap Section */}
          <div className="flex h-[450px] w-full max-w-[450px] items-center justify-center rounded-xl bg-transparent mt-4">
            {address ? (
              <Swap
                className="w-full sm:w-[500px] pt-2 bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md text-white [&_*]:text-white [&_p]:text-white [&_span]:text-white [&_div]:text-white [&_input]:bg-[#1B2236] [&_button]:bg-[#1B2236] [&_.swap-input]:!bg-[#1B2236] [&_.swap-input-container]:!bg-[#1B2236] [&_.swap-button]:!bg-[#1B2236] [&_.swap-message]:!bg-[#1B2236] [&_*]:!bg-[#1B2236] [&_*]:!bg-opacity-70 [&_.token-selector]:!bg-[#1B2236] [&_.token-selector-button]:!bg-[#1B2236] [&_.token-list]:!bg-[#1B2236] [&_.input-container]:!bg-[#1B2236] [&_button]:!flex [&_button]:!justify-center [&_button]:!items-center [&_svg]:!text-white [&_svg]:!fill-white"
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
                <SwapToggleButton className='border-white !text-white [&_svg]:!text-white [&_svg]:!fill-white [&_path]:!stroke-white scale-125 p-2'/>
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
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#1B2236] bg-opacity-70 backdrop-blur-md rounded-xl shadow-md">
                <div className="w-full relative">
                  <div className="gif-container">
                    <img src="spinLogo.gif" alt="Spinning Logo" className="rounded-gif" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* New message */}
          <div className="w-full flex flex-col gap-4 mt-4">
            {/* join the fam text */}
            <h1 className="text-5xl font-bold text-center text-white">
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
                <span className="text-2xl">💹🧲</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText('💹🧲');
                    setCopyClicked(true);
                    setTimeout(() => setCopyClicked(false), 2000);
                  }}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 border border-[#4299e1] bg-[#1B2236] bg-opacity-70 text-white hover:bg-opacity-80 backdrop-blur-sm`}
                >
                  {copyClicked ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="w-full max-w-[1200px] mx-auto mb-8 p-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SPX6900 Holders Over Time */}
            <div className="bg-[#1B2236] bg-opacity-70 backdrop-blur-md p-4 rounded-xl shadow-md">
              <h2 className="text-xl font-bold mb-4 text-center text-white">$SPX6900 Holders Over Time</h2>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={holdersData}>
                    <XAxis 
                      dataKey="date" 
                      stroke="#ffffff"
                      tick={{ fontSize: 12, fill: "#ffffff" }}
                    />
                    <YAxis 
                      stroke="#ffffff"
                      tick={{ fontSize: 12, fill: "#ffffff" }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'holders') {
                          const dataPoint = holdersData.find(d => d.holders === value);
                          const percentChange = dataPoint?.percentChange ?? 0;
                          const color = percentChange < 0 ? '#ef4444' : '#22c55e';
                          return [
                            <span style={{ color }}>
                              {value} ({percentChange >= 0 ? '+' : ''}{percentChange}%)
                            </span>,
                            'Holders'
                          ];
                        }
                        return [value, name];
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
