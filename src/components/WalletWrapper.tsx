'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';

type WalletWrapperParams = {
  text?: string;
  className?: string;
};

export default function WalletWrapper({
  className,
  text,
}: WalletWrapperParams) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="min-w-[120px] bg-[#1B2335] hover:bg-[#1B2335]/80 py-2 px-4 text-white rounded-lg"
                  >
                    Connect Wallet
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="flex items-center gap-2 bg-[#1B2335] hover:bg-[#1B2335]/80 py-2 px-3 text-white rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="max-w-[100px] truncate">
                        {account.displayName}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
