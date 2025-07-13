'use client';

import { ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';

export default function ZeroDevTestLink() {
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Link
        href="/dca-zerodev"
        className="
          bg-gradient-to-r from-purple-600 to-pink-600 
          hover:from-purple-700 hover:to-pink-700 
          text-white font-semibold py-3 px-4 rounded-lg 
          flex items-center gap-2 transition-all duration-200
          shadow-lg hover:shadow-xl transform hover:scale-105
        "
      >
        <Shield size={16} className="text-yellow-300" />
        <span>Test ZeroDev DCA</span>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
