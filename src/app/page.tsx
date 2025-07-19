'use client';

import { useState } from 'react';
import WalletWrapper from '../components/WalletWrapper';

export default function DCAPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden relative">
      {/* Fixed background */}
      <div className="fixed inset-0 z-0 bg-[#131827]"></div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#131827]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/spx6900.png" 
              alt="SPX6900" 
              className="w-8 h-8"
            />
            <h1 className="text-xl font-bold text-white">DCA SPX</h1>
          </div>

          <div className="flex items-center gap-3">
            <WalletWrapper />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full">
        {/* Main content wrapper */}
        <div className="relative z-10 pt-28 sm:pt-32 px-4 sm:px-6 pb-8 mx-auto max-w-4xl">
          
          {/* Hero Section */}
          <section className="text-center mb-12">
            <div className="relative w-full max-w-2xl mx-auto mb-6">
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold">
                <span className="bg-gradient-to-r from-[#ff69b4] via-[#ff8c00] to-[#4caf50] text-transparent bg-clip-text">
                  DCA SPX
                </span>
              </h1>
            </div>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Automated Dollar Cost Averaging for SPX6900 token. Set it and forget it.
            </p>
          </section>

          {/* DCA Features */}
          <section className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#1B2236]/40 backdrop-blur-md rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-white mb-2">Automated</h3>
              <p className="text-gray-300">Set your schedule and let it run automatically</p>
            </div>
            
            <div className="bg-[#1B2236]/40 backdrop-blur-md rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-white mb-2">Gas-Free</h3>
              <p className="text-gray-300">All transactions sponsored - no ETH needed</p>
            </div>
            
            <div className="bg-[#1B2236]/40 backdrop-blur-md rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-white mb-2">Secure</h3>
              <p className="text-gray-300">Non-custodial with smart wallet technology</p>
            </div>
          </section>

          {/* Coming Soon Section */}
          <section className="bg-[#1B2236]/40 backdrop-blur-md rounded-xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Coming Soon</h2>
            <p className="text-lg text-gray-300 mb-6">
              DCA functionality is being migrated from the main platform. 
              Connect your wallet to get ready!
            </p>
            
            {/* Placeholder for future DCA interface */}
            <div className="bg-[#131827]/50 rounded-lg p-8 border-2 border-dashed border-gray-600">
              <p className="text-gray-400">DCA Interface Will Appear Here</p>
            </div>
          </section>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="relative z-10 bg-[#1B2236]/20 backdrop-blur-sm border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-gray-400">
            © 2024 DCA SPX. Automated investing for SPX6900.
          </p>
        </div>
      </footer>
    </div>
  );
}