'use client';
import { usePrivy } from '@privy-io/react-auth';
import LoginButton from './LoginButton';
import UserProfile from './UserProfile';

interface HeaderProps {
  className?: string;
}

export default function Header({ className = '' }: HeaderProps) {
  const { ready, authenticated } = usePrivy();

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">SPX</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            Flip The Stock Market
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {ready && authenticated ? <UserProfile /> : <LoginButton />}
      </div>
    </div>
  );
}
