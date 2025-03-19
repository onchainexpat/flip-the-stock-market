'use client';

import {
  GITHUB_LINK,
} from 'src/links';
import ArrowSvg from 'src/svg/ArrowSvg';

const docLinks = [
  { href: GITHUB_LINK, title: 'Github' },
];

export default function Footer() {
  return (
    <footer className="w-full bg-[#131827] text-white py-4 px-6 flex flex-col items-center gap-2">
      <a 
        href="https://github.com/coinbase/onchainkit" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 hover:underline"
      >
        Open Source and Built with OnchainKit ↗
      </a>
      <a 
        href="https://x.twitter.com/onchainexpat" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 hover:underline"
      >
        Have feedback? DM me on X ↗
      </a>
    </footer>
  );
}
