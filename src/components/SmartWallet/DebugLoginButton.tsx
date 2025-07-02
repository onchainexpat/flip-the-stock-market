'use client';
import { usePrivy } from '@privy-io/react-auth';
import { Wallet, Zap } from 'lucide-react';
import { useState } from 'react';

interface DebugLoginButtonProps {
  className?: string;
}

export default function DebugLoginButton({
  className = '',
}: DebugLoginButtonProps) {
  const [debugInfo, setDebugInfo] = useState<string>('');

  let privyHookResult;
  let error = null;

  try {
    privyHookResult = usePrivy();
  } catch (e) {
    error = e;
  }

  const handleClick = () => {
    if (error) {
      alert(`Privy Error: ${error}`);
      return;
    }

    if (!privyHookResult) {
      alert('Privy hook not available');
      return;
    }

    const { ready, authenticated, login } = privyHookResult;

    setDebugInfo(`Ready: ${ready}, Authenticated: ${authenticated}`);

    if (!ready) {
      alert('Privy not ready yet');
      return;
    }

    if (authenticated) {
      alert('Already authenticated');
      return;
    }

    try {
      login();
    } catch (e) {
      alert(`Login error: ${e}`);
    }
  };

  if (error) {
    return (
      <button
        onClick={handleClick}
        className={`bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg ${className}`}
      >
        Debug: Privy Error
      </button>
    );
  }

  if (!privyHookResult) {
    return (
      <button
        onClick={handleClick}
        className={`bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg ${className}`}
      >
        Debug: No Privy
      </button>
    );
  }

  const { ready, authenticated } = privyHookResult;

  if (!ready) {
    return (
      <div
        className={`animate-pulse bg-gray-200 rounded-lg h-10 w-32 ${className}`}
      >
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (authenticated) {
    return (
      <button
        onClick={handleClick}
        className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg ${className}`}
      >
        <div className="flex items-center gap-2">
          <Wallet size={16} />
          <span>Authenticated</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
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
        <Wallet size={16} />
        <span>Login</span>
        <Zap size={14} className="text-yellow-300" />
      </div>
      {debugInfo && <div className="text-xs mt-1">{debugInfo}</div>}
    </button>
  );
}
