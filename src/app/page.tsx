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
} from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';
import { FundButton, getOnrampBuyUrl } from '@coinbase/onchainkit/fund';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TransactionReceipt } from 'viem';
import Confetti from 'react-confetti';
import { NEXT_PUBLIC_CDP_PROJECT_ID } from 'src/config';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const FALLBACK_DEFAULT_MAX_SLIPPAGE = 3;
const defaultMaxSlippage = 3;

type DuneDataPoint = {
  date: string;
  holders: number;
  percentChange: number;
};

export default function Page() {
  const [openDropdown, setOpenDropdown] = useState<'tenets' | 'priceChart' | 'sponsoredBuys' | 'howToBuyVideo' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const confettiImage = useRef<HTMLImageElement | null>(null);

  // Add this new state for background videos
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);

  // Near the top of the component, add this state
  const [copyClicked, setCopyClicked] = useState(false);

  const [holdersData, setHoldersData] = useState<DuneDataPoint[]>([]);

//  const projectId = NEXT_PUBLIC_CDP_PROJECT_ID;
const projectId = 'cc2411f3-9ed7-4da8-a005-711f71b8e8dc';
  const { address } = useAccount();

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
    const images = Array.from({length: 11}, (_, i) => `/background/sticker${i}_web.gif`);
    setBackgroundImages(images);

    const updateWindowDimensions = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);

    // Load the confetti image
    const img = new Image();
    img.src = 'spx6900.png'; // Replace with your actual image path
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

  const toggleDropdown = (dropdown: 'tenets' | 'priceChart' | 'sponsoredBuys' | 'howToBuyVideo') => {
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

  return (
    <>
      {/* Anti-phishing warning */}
      <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 px-2 py-2 text-xs sm:text-sm z-50 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center text-center">
          <span className="mb-1 sm:mb-0 sm:mr-2">Don't get phished! Please confirm you are FlipTheStockMarket.com. Verify SPX Token Address:</span>
          <a 
            href="https://basescan.org/address/0x50da645f148798f68ef2d7db7c1cb22a6819bb2c" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-bold underline mx-1 break-all sm:break-normal"
          >
            0x50da645f148798f68ef2d7db7c1cb22a6819bb2c
          </a> 
          <span className="mt-1 sm:mt-0 sm:ml-2">
           with <a href="https://www.coingecko.com/en/coins/spx6900" target="_blank" rel="noopener noreferrer" className="underline font-bold">CoinGecko</a>.
          </span>
        </div>
      </div>

      {/* Background div */}
      <div className="fixed inset-0 z-0 opacity-30 overflow-hidden">
        <div className="fixed inset-0" style={{ 
          width: 'calc(100vw + 200px)', 
          height: 'calc(100vh + 200px)',
          left: '-100px',
          top: '-100px'
        }}>
          {[...Array(Math.ceil((windowDimensions.width * windowDimensions.height) / (80 * 80)) * 2)].map((_, index) => (
            <img
              key={index}
              src={backgroundImages[index % backgroundImages.length]}
              alt={`Sticker ${(index % backgroundImages.length) + 1}`}
              className="w-[100px] h-[100px] object-contain inline-block"
              style={{ margin: '1px' }}
            />
          ))}
        </div>
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
          <h1 className="text-3xl font-bold text-white text-center mb-4 bg-blue-600 bg-opacity-70 rounded-md p-4 backdrop-blur-sm">
            The <span className="word-rotation"></span> Way to Buy  <span className="gold-text">$SPX6900</span>
          </h1>
          
          <div className="flex h-[450px] w-full max-w-[450px] items-center justify-center rounded-xl bg-transparent">
            {address ? (
              <Swap
                className="w-full border sm:w-[500px] pt-2 bg-white bg-opacity-10 backdrop-blur-md"
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
                 <SwapToggleButton className='border-white'/>
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
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-full relative">
                  <div className="gif-container">
                    <img src="spinLogo.gif" alt="Spinning Logo" className="rounded-gif" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* New message */}
          <div className="w-full flex justify-center mt-4">
            <div className="text-white bg-blue-600 bg-opacity-70 rounded-md p-4 inline-block">
              <h3 className="font-bold text-lg mb-2 text-center">How to Buy $SPX6900</h3>
              <ol className="list-decimal list-inside space-y-2 text-left">
                <li><strong>Generate a Coinbase Smart Wallet</strong></li>
                <li><strong>Get USDC on Coinbase (0% fee)</strong></li>
                <li><strong>Swap USDC for $SPX (0% fee)</strong></li>
                <li>
                  <strong>
                    Join the Fam on X by adding 💹🧲
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText('💹🧲');
                        setCopyClicked(true);
                        setTimeout(() => setCopyClicked(false), 2000); // Reset after 2 seconds
                      }}
                      className={`ml-2 px-2 py-1 text-xs rounded-md border transition-all duration-200 ${
                        copyClicked 
                          ? 'bg-green-500 text-white border-green-600' 
                          : 'bg-white text-blue-600 border-blue-400 hover:bg-gray-100'
                      }`}
                      title="Copy emojis"
                    >
                      {copyClicked ? '📋' : 'Copy'}
                    </button>
                  </strong>
                </li>
                <li><strong>Like and Retweet all <a 
                  href="https://x.com/search?q=%23SPX6900" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:underline hover:text-blue-300 underline decoration-dotted transition-colors duration-200"
                >#SPX6900</a> posts.</strong></li>
              </ol>
            </div>
          </div>
          
          {/* Dropdown buttons */}
          <div className="w-full flex flex-col items-center gap-4 mt-4">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a 
                href="https://spx6900.com/"
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
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
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md text-center hover:bg-opacity-80 transition-colors flex items-center justify-center backdrop-blur-sm"
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
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
              >
                <span className="mr-2">🎥 How to Buy (Video Guide)</span>
                <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'howToBuyVideo' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <button 
                onClick={() => toggleDropdown('tenets')}
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
              >
                <span className="mr-2">📖 Tenets of SPX</span>
                <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'tenets' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <button 
                onClick={() => toggleDropdown('priceChart')}
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
              >
                <span className="mr-2">📈 Price Chart</span>
                <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'priceChart' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <button 
                onClick={() => toggleDropdown('sponsoredBuys')}
                className="px-4 py-2 bg-blue-600 bg-opacity-70 text-white rounded-md flex items-center justify-center relative hover:bg-opacity-80 transition-colors backdrop-blur-sm"
              >
                <span className="mr-2">🎁 How are there no fees?</span>
                <span className={`absolute right-2 transition-transform duration-300 ${openDropdown === 'sponsoredBuys' ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          </div>
          
          {/* Tenets of SPX content */}
          <div 
            className={`w-full md:w-[450px] overflow-hidden transition-all duration-300 ease-in-out ${
              openDropdown === 'tenets' ? 'max-h-[500px]' : 'max-h-0'
            }`}
          >
            <div className="bg-white bg-opacity-50 backdrop-blur-md p-4 rounded-md shadow-md">
              <ul className="list-disc pl-5 space-y-1">
                <li>Stop Trading</li>
                <li>Believe In Something</li>
                <li>DCA Is The Way</li>
                <li>We Logged On And Won The Stock Market</li>
                <li>There Is No Chart</li>
                <li>Price Is Binary, Have We Flipped The Stock Market Or Not?</li>
                <li>One Goal, Flip The Stock Market</li>
                <li>One Target, 69 Trillion</li>
              </ul>
            </div>
          </div>
          
          {/* Price Chart content */}
          <div 
            className={`w-full md:w-[450px] overflow-hidden transition-all duration-300 ease-in-out ${
              openDropdown === 'priceChart' ? 'max-h-96' : 'max-h-0'
            }`}
          >
            <div className="bg-white bg-opacity-50 backdrop-blur-md p-4 rounded-md shadow-md text-center">
              <p className="font-bold text-xl mb-4">There is no chart</p>
              <img src="/nopricechart.jpg" alt="No Price Chart" className="w-full h-auto" />
            </div>
          </div>
          
          {/* Sponsored Buys content */}
          <div 
            className={`w-full md:w-[450px] overflow-hidden transition-all duration-300 ease-in-out ${
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
            className={`w-full md:w-[450px] overflow-hidden transition-all duration-300 ease-in-out ${
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
        </section>
        <div className="w-full max-w-[1200px] mx-auto mb-8 p-4">
          <div className="bg-white bg-opacity-50 backdrop-blur-md p-4 rounded-md shadow-md">
            <h2 className="text-xl font-bold mb-4 text-center">$SPX6900 Holders Over Time</h2>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={holdersData}>
                  <XAxis 
                    dataKey="date" 
                    stroke="#1a1a1a"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#1a1a1a"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'holders') {
                        const dataPoint = holdersData.find(d => d.holders === value);
                        return [`${value} (${dataPoint?.percentChange ?? 0 >= 0 ? '+' : ''}${dataPoint?.percentChange ?? 0}%)`, 'Holders'];
                      }
                      return [value, name];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="holders" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
