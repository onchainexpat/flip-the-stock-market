'use client';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, User } from 'lucide-react';

interface LoginButtonProps {
  className?: string;
}

export default function LoginButton({ className = '' }: LoginButtonProps) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div
        className={`animate-pulse bg-gray-200 rounded-lg h-10 w-32 ${className}`}
      />
    );
  }

  if (authenticated) {
    return null; // Don't show login button when already authenticated
  }

  return (
    <button
      onClick={login}
      className={`
        bg-gradient-to-r from-blue-600 to-purple-600 
        hover:from-blue-700 hover:to-purple-700 
        text-white font-semibold py-2 px-4 rounded-lg 
        flex items-center gap-2 transition-all duration-200
        shadow-lg hover:shadow-xl transform hover:scale-105
        ${className}
      `}
    >
      <div className="flex items-center gap-2">
        <User size={16} />
        <span>Sign In</span>
        <ArrowRight size={14} className="text-blue-300" />
      </div>
    </button>
  );
}
