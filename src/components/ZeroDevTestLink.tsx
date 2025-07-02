'use client';

import Link from 'next/link';

export default function ZeroDevTestLink() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        href="/test-zerodev"
        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-lg transition-colors duration-200"
      >
        🧪 Test ZeroDev Smart Wallet
      </Link>
    </div>
  );
}
