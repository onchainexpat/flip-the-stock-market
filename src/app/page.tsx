'use client';
import Footer from 'src/components/Footer';
import { useAccount } from 'wagmi';
import LoginButton from '../components/LoginButton';
import SignupButton from '../components/SignupButton';
import { 
  type LifecycleStatus,
  Swap, 
  SwapAmountInput, 
  SwapButton, 
  SwapMessage, 
  SwapSettings,
  SwapSettingsSlippageDescription, 
  SwapSettingsSlippageInput, 
  SwapSettingsSlippageTitle,  
  SwapError,
  SwapToast 
} from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';
import { useCallback, useContext } from 'react';
import type { TransactionReceipt } from 'viem';

const FALLBACK_DEFAULT_MAX_SLIPPAGE = 3;

import { useState } from 'react';

export default function Page() {
  const { address } = useAccount();
  const [openDropdown, setOpenDropdown] = useState<'tenets' | 'priceChart' | null>(null);

  const toggleDropdown = (dropdown: 'tenets' | 'priceChart') => {
    if (openDropdown === dropdown) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(dropdown);
    }
  };
 
  const defaultMaxSlippage = 3;


  const SPXToken: Token = {
    address: "0x50da645f148798f68ef2d7db7c1cb22a6819bb2c",
    chainId: 8453,
    decimals: 18,
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
    },
    [],
  );

  const handleOnError = useCallback((swapError: SwapError) => {
    console.log('Error:', swapError);
  }, []);

  return (
    <div className="flex h-full w-96 max-w-full flex-col px-1 md:w-[1008px]">
      <section className="mt-6 mb-6 flex w-full flex-col md:flex-row">
        <div className="flex w-full flex-row items-center justify-end gap-2 md:gap-0">
          <div className="flex items-center gap-3">
            <SignupButton />
            {!address && <LoginButton />}
          </div>
        </div>
      </section>
      <section className="templateSection flex w-full flex-col items-center justify-center gap-4 rounded-xl bg-gray-100 px-2 py-4 md:grow">
        <div className="flex h-[450px] w-[450px] max-w-full items-center justify-center rounded-xl bg-[#030712]">
          {address ? (
            <Swap
              className="w-full border sm:w-[500px]"
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
                swappableTokens={swappableTokens}
                token={USDCToken}
                type="from"
              />
              <SwapAmountInput
                label="Buy"
                token={SPXToken}
                type="to"
              />
              <SwapButton />
              <SwapMessage className="text-red-500" />
              <SwapToast />
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
          <button 
            onClick={() => toggleDropdown('tenets')}
            className="flex items-center justify-between w-full md:w-[450px] px-4 py-2 bg-blue-500 text-white rounded-md"
          >
            <span>Tenets of SPX</span>
            <span className={`transition-transform duration-300 ${openDropdown === 'tenets' ? 'rotate-180' : ''}`}>▼</span>
          </button>
          <button 
            onClick={() => toggleDropdown('priceChart')}
            className="flex items-center justify-between w-full md:w-[450px] px-4 py-2 bg-green-500 text-white rounded-md"
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
  );
}