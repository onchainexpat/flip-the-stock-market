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
    <section className="mt-auto mb-2 flex w-full flex-col items-center justify-center md:mt-8 md:mb-6">
      <ul className="flex justify-center">
        {docLinks.map(({ href, title }) => (
          <li className="flex" key={href}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              title={title}
              className="flex items-center gap-1 text-base font-bold text-gray-600 hover:text-gray-800"
            >
              <p>{title}</p>
              <ArrowSvg />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
