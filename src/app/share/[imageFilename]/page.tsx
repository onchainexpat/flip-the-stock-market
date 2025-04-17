import { Metadata } from 'next';
import Image from 'next/image'; // Optional: if you want to display the image

// Function to generate metadata dynamically
export async function generateMetadata({ params }: { params: { imageFilename: string } }): Promise<Metadata> {
  const imageFilename = params.imageFilename;

  // Construct the full Vercel Blob URL
  // You might need to get the base Blob URL part from env vars or construct it
  // Example: assuming your blobs are at https://<storeid>.public.blob.vercel-storage.com/
  const blobBaseUrl = `https://${process.env.BLOB_URL_SUBDOMAIN}.public.blob.vercel-storage.com`; // Adjust if needed
  const imageUrl = `${blobBaseUrl}/${imageFilename}`;

  // Basic check if the URL looks like a Vercel Blob URL (optional but good practice)
  if (!imageUrl.includes('.public.blob.vercel-storage.com')) {
     console.warn("Constructed image URL doesn't look like a Vercel Blob URL:", imageUrl);
     // Return default metadata or handle error
     return {
       title: 'Shared Image',
     };
  }

  const title = "SPX Price Comparison";
  const description = "Check out this SPX6900 vs S&P 500 price comparison from FlipTheStockMarket.com";

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: imageUrl, // The direct Vercel Blob URL
          // You might need to provide width/height if known, but often optional
          // width: 800,
          // height: 600,
        },
      ],
      type: 'website', // or 'article'
    },
    twitter: {
      card: 'summary_large_image', // Use 'summary_large_image' for prominent image
      title: title,
      description: description,
      images: [imageUrl], // The direct Vercel Blob URL
    },
  };
}


// The actual page component (can be simple)
export default function SharePage({ params }: { params: { imageFilename: string } }) {
  const imageFilename = params.imageFilename;
  const blobBaseUrl = `https://${process.env.BLOB_URL_SUBDOMAIN}.public.blob.vercel-storage.com`; // Adjust if needed
  const imageUrl = `${blobBaseUrl}/${imageFilename}`;

  // Optional: Display the image on this page
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#131827', flexDirection: 'column', color: 'white', padding: '20px', textAlign: 'center' }}>
       <h1>SPX Price Comparison</h1>
       <p>Share this on social media!</p>
       {imageUrl.includes('.public.blob.vercel-storage.com') ? (
         // Using a regular img tag might be simpler here if dimensions are unknown
         // eslint-disable-next-line @next/next/no-img-element
         <img
           src={imageUrl}
           alt="SPX Price Comparison"
           style={{ maxWidth: '90%', maxHeight: '70vh', marginTop: '20px', border: '1px solid #ccc' }}
         />
       ) : (
         <p>Error: Could not load image.</p>
       )}
       <p style={{marginTop: '20px'}}>
         <a href="/" style={{color: '#ff844a', textDecoration: 'underline'}}>Back to FlipTheStockMarket.com</a>
       </p>
       {/* Optional: You could add a meta refresh or JS redirect back to home */}
    </div>
  );
} 