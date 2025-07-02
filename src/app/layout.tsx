import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
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
  minimumScale: 1,
  maximumScale: 5,
  userScalable: 'yes',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'SPX6900 - Flip The Stock Market',
  description:
    'Track SPX6900 vs S&P500 price and market cap comparison in real-time.',
  openGraph: {
    title: 'SPX6900 - Flip The Stock Market',
    description:
      'Track SPX6900 vs S&P500 price and market cap comparison in real-time.',
    images: [
      {
        url: `${NEXT_PUBLIC_URL}/spx6900.png`,
        width: 1200,
        height: 630,
        alt: 'SPX6900 vs S&P500',
      },
    ],
    url: 'https://flipthestockmarket.com',
    type: 'website',
    siteName: 'Flip The Stock Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPX6900 - Flip The Stock Market',
    description:
      'Track SPX6900 vs S&P500 price and market cap comparison in real-time.',
    images: [`${NEXT_PUBLIC_URL}/spx6900.png`],
    creator: '@spx6900',
    site: '@spx6900',
  },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
        <OnchainProviders>{children}</OnchainProviders>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
