'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

type LoginButtonParams = {
  text?: string;
  className?: string;
};

export default function LoginButton({
  className,
  text = 'Log in or sign up',
}: LoginButtonParams) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address } = useAccount();

  if (!ready) {
    return (
      <div className="min-w-[120px] bg-[#1B2335] py-2 px-4 text-white rounded-lg opacity-50">
        Loading...
      </div>
    );
  }

  if (authenticated && user) {
    return (
      <button
        onClick={logout}
        type="button"
        className={`flex items-center gap-2 px-3 py-2 bg-[#1B2236] hover:bg-[#1B2236]/80 rounded-lg transition-colors ${className || ''}`}
      >
        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <span className="text-white text-sm max-w-[120px] truncate">
          {user.email?.address || user.phone?.number || 'User'}
        </span>
        {address && <div className="text-xs text-blue-400 ml-1">Connected</div>}
      </button>
    );
  }

  return (
    <button
      onClick={login}
      type="button"
      className={`px-4 py-2 bg-[#1B2236] hover:bg-[#1B2236]/80 text-white rounded-lg transition-colors ${className || ''}`}
    >
      {text}
    </button>
  );
}
