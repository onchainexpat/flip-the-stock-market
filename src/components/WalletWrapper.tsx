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
  const { isConnected } = useAccount();

  return (
    <>
      <Wallet>
        <ConnectWallet
          withWalletAggregator={withWalletAggregator}
          text={text}
          className={`${className} ${
            isConnected
              ? 'bg-blue-600 bg-opacity-70 backdrop-blur-sm hover:bg-blue-600 hover:bg-opacity-80 !text-white [&_*]:!text-white [&_svg]:!fill-white [&_svg_path]:!fill-white [&_svg_circle]:!fill-white [&_img]:!brightness-0 [&_img]:!invert-[1]'
              : ''
          }`}
        >
          <Avatar className="h-6 w-6 !text-white [&_svg]:!fill-white [&_svg_path]:!fill-white [&_svg_circle]:!fill-white [&_img]:!brightness-0 [&_img]:!invert-[1]" />
          <Name className="!text-white" />
        </ConnectWallet>
        <WalletDropdown>
          <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick={true}>
            <Avatar />
            <Name />
            <Address />
            <EthBalance />
          </Identity>
          <WalletDropdownBasename />
          <WalletDropdownLink icon="wallet" href="https://wallet.coinbase.com">
            Go to Wallet Dashboard
          </WalletDropdownLink>
          <WalletDropdownFundLink />
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>
    </>
  );
}
