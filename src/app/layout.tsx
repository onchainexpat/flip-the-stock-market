import type { Metadata } from 'next';
import { NEXT_PUBLIC_URL } from '../config';
import { Toaster } from 'react-hot-toast';

import './global.css';
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
  title: 'DCA SPX - Automated Dollar Cost Averaging for SPX6900',
  description: 'Automated, gas-free Dollar Cost Averaging for SPX6900 token using smart wallets.',
  openGraph: {
    title: 'DCA SPX - Automated Dollar Cost Averaging for SPX6900',
    description: 'Automated, gas-free Dollar Cost Averaging for SPX6900 token using smart wallets.',
    images: [{
      url: `${NEXT_PUBLIC_URL}/spx6900.png`,
      width: 1200,
      height: 630,
      alt: 'DCA SPX',
    }],
    url: 'https://dcaspx.com',
    type: 'website',
    siteName: 'DCA SPX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DCA SPX - Automated Dollar Cost Averaging for SPX6900',
    description: 'Automated, gas-free Dollar Cost Averaging for SPX6900 token using smart wallets.',
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