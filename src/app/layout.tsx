import type { Metadata } from 'next';
import { NEXT_PUBLIC_URL } from '../config';

import './global.css';
import '@coinbase/onchainkit/styles.css';
import '@rainbow-me/rainbowkit/styles.css';
import dynamic from 'next/dynamic';

const OnchainProviders = dynamic(
  () => import('src/components/OnchainProviders'),
  {
    ssr: false,
  },
);

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Flip The S&P500',
  description: 'Buy SPX6900 for 0% fees!',
  openGraph: {
    title: 'Flip The S&P500',
    description: 'Buy SPX6900 for 0% fees!',
    images: [`${NEXT_PUBLIC_URL}/spx6900.png`],
    url: 'https://flipthestockmarket.com', // Add the full URL of your site
    type: 'website', // Specify the type of your content
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flip The S&P500',
    description: 'Buy SPX6900 for 0% fees!',
    images: [`${NEXT_PUBLIC_URL}/spx6900.png`],
  },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center">
        <OnchainProviders>{children}</OnchainProviders>
      </body>
    </html>
  );
}
