'use client';
import { usePrivy } from '@privy-io/react-auth';

type WalletWrapperParams = {
  text?: string;
  className?: string;
};

export default function WalletWrapper({
  className,
  text,
}: WalletWrapperParams) {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <button
        disabled
        className="min-w-[120px] bg-[#1B2335]/50 py-2 px-4 text-white/50 rounded-lg cursor-not-allowed"
      >
        Loading...
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        type="button"
        className="min-w-[120px] bg-[#1B2335] hover:bg-[#1B2335]/80 py-2 px-4 text-white rounded-lg transition-colors"
      >
        {text || 'Connect Wallet'}
      </button>
    );
  }

  const displayName = user?.wallet?.address 
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : 'Connected';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={logout}
        type="button"
        className="flex items-center gap-2 bg-[#1B2335] hover:bg-[#1B2335]/80 py-2 px-3 text-white rounded-lg transition-colors"
      >
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
          <span className="max-w-[100px] truncate">{displayName}</span>
        </div>
      </button>
    </div>
  );
}