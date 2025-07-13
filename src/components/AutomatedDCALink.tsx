'use client';
import { ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

export default function AutomatedDCALink() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        href="/dca-automated"
        className="
          bg-gradient-to-r from-green-600 to-blue-600 
          hover:from-green-700 hover:to-blue-700 
          text-white font-semibold py-3 px-4 rounded-lg 
          flex items-center gap-2 transition-all duration-200
          shadow-lg hover:shadow-xl transform hover:scale-105
          animate-pulse
        "
      >
        <Zap size={16} className="text-yellow-300" />
        <span>True Automated DCA</span>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}