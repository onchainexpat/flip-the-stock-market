'use client';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

export default function Navigation() {
  const { authenticated, ready, logout, login } = usePrivy();

  if (!ready) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-white font-bold text-xl">
            SPX6900
          </Link>

          {/* Navigation items */}
          <div className="flex items-center space-x-4">
            {authenticated ? (
              <>
                <Link
                  href="/dca-v2"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  DCA
                </Link>
                <Link
                  href="/openocean-dca-test"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  DCA Test
                </Link>
                <button
                  onClick={logout}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
