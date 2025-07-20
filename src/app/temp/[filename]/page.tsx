import type { Metadata } from 'next';
import { NEXT_PUBLIC_URL } from '../../../config';

type Props = {
  params: { filename: string }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const imageUrl = `${NEXT_PUBLIC_URL}/temp/${params.filename}`;
  
  return {
    title: 'SPX6900 vs S&P500 Price Comparison',
    description: 'Real-time price and market cap comparison between SPX6900 and S&P500.',
    openGraph: {
      title: 'SPX6900 vs S&P500 Price Comparison',
      description: 'Real-time price and market cap comparison between SPX6900 and S&P500.',
      images: [{
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: 'SPX6900 vs S&P500 Price Comparison',
      }],
      type: 'website',
      siteName: 'Flip The Stock Market',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SPX6900 vs S&P500 Price Comparison',
      description: 'Real-time price and market cap comparison between SPX6900 and S&P500.',
      images: [imageUrl],
      creator: '@spx6900',
      site: '@spx6900',
    },
  };
}

export default function ImagePage({ params }: Props) {
  const imageUrl = `${NEXT_PUBLIC_URL}/temp/${params.filename}`;
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#131827]">
      <img src={imageUrl} alt="SPX6900 vs S&P500 Price Comparison" className="max-w-full h-auto" />
    </div>
  );
} 