'use client';
import Footer from 'src/components/Footer';
import { useAccount, useBalance } from 'wagmi';
import LoginButton from '../components/LoginButton';
import SignupButton from '../components/SignupButton';
import { 
  type LifecycleStatus,
  Swap, 
  SwapAmountInput, 
  SwapButton, 
  SwapMessage, 
  SwapToggleButton,
  SwapSettings,
  SwapSettingsSlippageDescription, 
  SwapSettingsSlippageInput, 
  SwapSettingsSlippageTitle,  
  SwapError,
  SwapToast 
} from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';
import { FundButton, getOnrampBuyUrl } from '@coinbase/onchainkit/fund';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TransactionReceipt } from 'viem';
import Confetti from 'react-confetti';
import { NEXT_PUBLIC_CDP_PROJECT_ID } from 'src/config';

const FALLBACK_DEFAULT_MAX_SLIPPAGE = 3;
const defaultMaxSlippage = 3;


export default function Page() {
  const [openDropdown, setOpenDropdown] = useState<'tenets' | 'priceChart' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });
  const confettiImage = useRef<HTMLImageElement | null>(null);

  // Add this new state for background videos
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);

  const projectId = NEXT_PUBLIC_CDP_PROJECT_ID;
  const { address } = useAccount();

  const onrampBuyUrl = address
    ? getOnrampBuyUrl({
        projectId,
        addresses: { [address]: ['base'] },
        assets: ['USDC'],
        presetFiatAmount: 20,
        fiatCurrency: 'USD'
      })
    : "undefined";

  useEffect(() => {
    const images = Array.from({length: 11}, (_, i) => `/background/sticker${i}_web.gif`);
    setBackgroundImages(images);

    const updateWindowDimensions = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowDimensions();
    window.addEventListener('resize', updateWindowDimensions);

    return () => window.removeEventListener('resize', updateWindowDimensions);
  }, []);

  const toggleDropdown = (dropdown: 'tenets' | 'priceChart') => {
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

  const { data: usdcBalance } = useBalance({
    address,
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  });

  const showFundWalletButton = !usdcBalance || parseFloat(usdcBalance.formatted) <= 1;

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
      <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 px-4 py-2 text-sm text-center z-50">
        Please confirm you are on the correct URL. Verify SPX Token Contract on Base:
        <a 
          href="https://basescan.org/address/0x50da645f148798f68ef2d7db7c1cb22a6819bb2c" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-bold underline mx-1"
        >
          0x50da645f148798f68ef2d7db7c1cb22a6819bb2c
        </a> 
        with <a href="https://www.coingecko.com/en/coins/spx6900" target="_blank" rel="noopener noreferrer" className="underline font-bold">CoinGecko</a>.
      </div>

      {/* Background div */}
      <div className="fixed inset-0 z-0 opacity-30 overflow-hidden">
        <div className="flex flex-wrap" style={{ 
          width: 'calc(100% + 100px)', 
          height: 'calc(100% + 100px)',
          margin: '-1px'
        }}>
          {[...Array(Math.ceil((windowDimensions.width * windowDimensions.height) / (100 * 100)))].map((_, index) => (
            <img
              key={index}
              src={backgroundImages[index % backgroundImages.length]}
              alt={`Sticker ${(index % backgroundImages.length) + 1}`}
              className="w-[100px] h-[100px] object-contain"
              style={{ margin: '1px' }}
            />
          ))}
        </div>
      </div>

      {/* Existing content wrapper */}
      <div className="relative z-10 pt-10">
        <div className="flex h-full w-full max-w-[450px] mx-auto flex-col px-1">
          {showConfetti && (
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
          )}
          <section className="mt-6 mb-6 flex w-full flex-col">
            <div className="flex w-full flex-row items-center justify-end gap-2">
              <div className="flex items-center gap-3">
                <SignupButton />
                {!address && <LoginButton />}
              </div>
            </div>
          </section>
          <section className="templateSection flex w-full flex-col items-center justify-center gap-4 rounded-xl bg-gray-100 px-2 py-4">
            <div className="flex h-[450px] w-full max-w-[450px] items-center justify-center rounded-xl bg-[#030712]">
              {address ? (
                <Swap
                  className="w-full border sm:w-[500px] pt-2"
                  onStatus={handleOnStatus}
                  onSuccess={handleOnSuccess}
                  onError={handleOnError}
                  config={{
                    maxSlippage: defaultMaxSlippage || FALLBACK_DEFAULT_MAX_SLIPPAGE,
                  }}
                  isSponsored={true}
                >
                  <SwapSettings>
                      <SwapSettingsSlippageTitle>
                        Max. slippage
                      </SwapSettingsSlippageTitle>
                      <SwapSettingsSlippageDescription>
                        Your swap will revert if the prices change by more than the selected
                        percentage.
                      </SwapSettingsSlippageDescription>
                      <SwapSettingsSlippageInput />
                    </SwapSettings>
                  <SwapAmountInput
                    label="Sell"
                    token={USDCToken}
                    type="from"
                  />
                  <SwapToggleButton />
                  <SwapAmountInput
                    label="Buy"
                    token={SPXToken}
                    type="to"
                  />
                  <SwapButton />
                  <SwapMessage />
                  <SwapToast position="top-center" durationMs={10000}/>
                </Swap>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="w-full h-full relative">
                    <video 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    >
                      <source src="sticker.webm" type="video/webm" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className="absolute z-10 text-center">
                    <SignupButton />
                  </div>
                </div>
              )}
            </div>
            
            {/* Dropdown buttons */}
            <div className="w-full flex flex-col items-center gap-4 mt-4">
              {address && showFundWalletButton && (
                <FundButton fundingUrl={onrampBuyUrl} text="Get USDC with Coinbase (0% fee)" />
              )}

              {/* Existing "How to buy" button and new button */}
              <div className="w-full flex flex-col sm:flex-row justify-between gap-2">
                <button 
                  className="w-full sm:w-1/2 px-4 py-2 bg-purple-500 text-white rounded-md text-center hover:bg-purple-600 transition-colors"
                >
                  How to Buy SPX
                </button>
                <a 
                  href="https://spx6900.com/"
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full sm:w-1/2 px-4 py-2 bg-orange-500 text-white rounded-md text-center hover:bg-orange-600 transition-colors"
                >
                  Official Website
                </a>
              </div>

              {/* Existing row of buttons */}
              <div className="w-full flex flex-col sm:flex-row justify-between gap-2 mb-4">
                <a 
                  href="https://t.me/SPX6900" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full sm:w-1/2 px-4 py-2 bg-blue-500 text-white rounded-md text-center hover:bg-blue-600 transition-colors"
                >
                  Community Chat
                </a>
                <a 
                  href="https://spx6900.com/"
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full sm:w-1/2 px-4 py-2 bg-green-500 text-white rounded-md text-center hover:bg-green-600 transition-colors"
                >
                  Meme Kit
                </a>
              </div>

              <button 
                onClick={() => toggleDropdown('tenets')}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md flex items-center justify-between"
              >
                <span>Tenets of SPX</span>
                <span className={`transition-transform duration-300 ${openDropdown === 'tenets' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <button 
                onClick={() => toggleDropdown('priceChart')}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-md flex items-center justify-between"
              >
                <span>Price Chart</span>
                <span className={`transition-transform duration-300 ${openDropdown === 'priceChart' ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
            
            {/* Tenets of SPX content */}
            <div 
              className={`w-full md:w-[450px] overflow-hidden transition-all duration-300 ease-in-out ${
                openDropdown === 'tenets' ? 'max-h-[500px]' : 'max-h-0'
              }`}
            >
              <div className="bg-white p-4 rounded-md shadow-md">
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
              <div className="bg-white p-4 rounded-md shadow-md text-center">
                <p className="font-bold text-xl mb-4">There is no chart</p>
                <img src="/nopricechart.jpg" alt="No Price Chart" className="w-full h-auto" />
              </div>
            </div>
          </section>
          <Footer />
        </div>
      </div>
    </>
  );
}
