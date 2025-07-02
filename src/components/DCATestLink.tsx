'use client';
import { ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

export default function DCATestLink() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        href="/dca-v2"
        className="
          bg-gradient-to-r from-blue-600 to-purple-600 
          hover:from-blue-700 hover:to-purple-700 
          text-white font-semibold py-3 px-4 rounded-lg 
          flex items-center gap-2 transition-all duration-200
          shadow-lg hover:shadow-xl transform hover:scale-105
        "
      >
        <Zap size={16} className="text-yellow-300" />
        <span>Test DCA v2</span>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
