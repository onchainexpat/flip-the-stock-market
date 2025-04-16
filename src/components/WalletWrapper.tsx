'use client';
import { useAccount } from 'wagmi';
import {
  Address,
  Avatar,
  EthBalance,
  Identity,
  Name,
} from '@coinbase/onchainkit/identity';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownBasename,
  WalletDropdownDisconnect,
  WalletDropdownFundLink,
  WalletDropdownLink,
} from '@coinbase/onchainkit/wallet';
import { ReactNode } from 'react';

type WalletWrapperParams = {
  text?: string;
  className?: string;
  withWalletAggregator?: boolean;
};

export default function WalletWrapper({
  className,
  text,
  withWalletAggregator = false,
}: WalletWrapperParams) {
  const { isConnected, address } = useAccount();

  return (
    <>
      <Wallet>
        <ConnectWallet
          withWalletAggregator={withWalletAggregator}
          text={text}
          className={`${className} ${
            isConnected
              ? 'bg-[#1B2335] hover:bg-[#1B2335]/80 !py-2 !px-4 !text-white [&_*]:!text-white [&_svg]:!fill-white [&_svg_path]:!fill-white [&_svg_circle]:!fill-white [&_img]:!brightness-0 [&_img]:!invert-[1]'
              : 'bg-[#1B2335] hover:bg-[#1B2335]/80 !py-2 !px-4'
          } relative`}
        >
          {address && <Avatar address={address} className="h-6 w-6 !text-white [&_svg]:!fill-white [&_svg_path]:!fill-white [&_svg_circle]:!fill-white [&_img]:!brightness-0 [&_img]:!invert-[1]" />}
          {address && <Name address={address} className="!text-white" />}
        </ConnectWallet>
        <WalletDropdown className="!absolute !top-full !mt-2 !z-[99999] ![background:transparent] [&>div]:!bg-transparent">
          <div className="!bg-[#131827] ![background-color:#131827] !rounded-xl !shadow-xl !backdrop-blur-md !border !border-white/10 overflow-hidden [&_*]:!text-white [&_svg]:!fill-white [&_svg_path]:!fill-white [&_svg_circle]:!fill-white [&_img]:!brightness-0 [&_img]:!invert-[1]">
            {address && (
              <Identity 
                address={address} 
                className="px-4 pt-3 pb-2 !bg-[#131827] [&_button]:!bg-[#131827] [&_button]:!text-white [&_button]:!border-white/10 [&_button:hover]:!bg-[#1e2538] [&_.copy-button]:!bg-[#131827] [&_.copy-button:hover]:!bg-[#1e2538] [&_.copy-button]:!text-white [&_.copy-button_*]:!text-white [&_.copy-button]:!border-white/10 [&_[role='tooltip']]:!bg-[#131827] [&_[role='tooltip']]:!text-white [&_[role='tooltip']]:!border-white/10 [&_[data-radix-popper-content-wrapper]]:!bg-[#131827] [&_.address-tooltip]:!bg-[#131827] [&_div[style*='background-color']]:!bg-[#131827] [&_*[class*='tooltip']]:!bg-[#131827] [&_*[class*='Tooltip']]:!bg-[#131827] [&_*[class*='popover']]:!bg-[#131827] [&_*[class*='Popover']]:!bg-[#131827] [&_*[class*='copy']]:!bg-[#131827] [&_*[class*='Copy']]:!bg-[#131827] [&_*[class*='hover']]:!bg-[#131827] [&_*[class*='Hover']]:!bg-[#131827] [&_*]:![background-color:#131827] [&_*]:![background:#131827] [&_*]:!text-white [&_*[class*='tooltip']]:!border-white [&_*[class*='Tooltip']]:!border-white [&_*[class*='popover']]:!border-white [&_*[class*='Popover']]:!border-white [&_*[class*='copy']]:!border-white [&_*[class*='Copy']]:!border-white [&_*[class*='hover']]:!border-white [&_*[class*='Hover']]:!border-white" 
                hasCopyAddressOnClick={true}
              >
                <Avatar address={address} />
                <Name address={address} />
                <Address address={address} />
                <EthBalance address={address} />
              </Identity>
            )}
            <div className="[&>*]:!bg-[#131827] [&>*:hover]:!bg-[#1e2538] [&>*]:transition-colors [&>*]:duration-200">
              <WalletDropdownBasename />
              <WalletDropdownLink 
                icon="wallet" 
                href="https://wallet.coinbase.com"
                className="[&_svg]:!text-white [&_svg]:!stroke-white"
              >
                Go to Wallet Dashboard
              </WalletDropdownLink>
              <WalletDropdownFundLink className="[&_svg]:!text-white [&_svg]:!stroke-white" />
              <WalletDropdownDisconnect className="[&_svg]:!text-white [&_svg]:!stroke-white cursor-pointer hover:!bg-[#1e2538] !py-2 !px-4 !w-full !text-left !flex !items-center !gap-2" />
            </div>
          </div>
        </WalletDropdown>
      </Wallet>
    </>
  );
}
