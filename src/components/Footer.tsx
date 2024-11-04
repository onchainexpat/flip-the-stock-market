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
    <footer className="mt-8 p-4 text-center text-white bg-blue-600 bg-opacity-70 backdrop-blur-sm rounded-md">
      <ul className="flex justify-center">
        {docLinks.map(({ href, title }) => (
          <li className="flex" key={href}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              title={title}
              className="flex items-center gap-1 text-base font-bold text-white hover:text-gray-200"
            >
              <p>Open Source and Built with OnchainKit</p>
              <ArrowSvg />
            </a>
          </li>
        ))}
      </ul>
      
      <div className="mt-4 border-t border-white/20 pt-4">
        <p className="text-sm">
          Have feedback? DM me on{' '}
          <a 
            href="https://x.com/OnchainExpat" 
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-200 transition-colors"
          >
            X/Twitter 🐦
          </a>
        </p>
      </div>
    </footer>
  );
}
