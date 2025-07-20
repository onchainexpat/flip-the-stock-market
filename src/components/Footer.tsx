'use client';

export default function Footer() {
  return (
    <footer className="w-full bg-[#131827] text-white py-2 px-4 sm:px-6 mt-[-12px] flex flex-col sm:flex-row justify-center items-center gap-3 relative z-20 border-t border-white/10">
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
