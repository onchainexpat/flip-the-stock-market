'use client';

import {
  GITHUB_LINK,
} from 'src/links';

export default function Footer() {
  return (
    <footer className="w-full bg-[#131827] text-white py-2 px-4 sm:px-6 mt-[-12px] flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-3 relative z-20 border-t border-white/10">
      <a 
        href="https://github.com/onchainexpat/flip-the-stock-market" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 hover:underline text-sm sm:text-base"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
        Open Source and Built with OnchainKit
      </a>
      <a 
        href="https://x.com/onchainexpat" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 hover:underline text-sm sm:text-base"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
        </svg>
        Have feedback? DM me on X
      </a>
    </footer>
  );
}
