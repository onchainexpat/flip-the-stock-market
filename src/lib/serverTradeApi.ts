const OPENOCEAN_API_KEY = process.env.OPENOCEAN_API_KEY;
const BASE_API_URL = 'https://open-api.openocean.finance/v4';

// A simple map for chain IDs to chain names
const getChainName = (chainId: string) => {
  const chainMap: { [key: string]: string } = {
    '8453': 'base',
    '1': 'ethereum',
    // Add other chains as needed
  };
  return chainMap[chainId] || 'base'; // Default to base
};

export async function fetchTradeDetails(txHash: string, chainId = '8453') {
  if (!OPENOCEAN_API_KEY) {
    throw new Error('Missing OPENOCEAN_API_KEY environment variable');
  }

  const chainName = getChainName(chainId);

  const response = await fetch(
    `${BASE_API_URL}/${chainName}/getTransaction?hash=${txHash}`,
    {
      headers: {
        'Api-key': OPENOCEAN_API_KEY,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenOcean API error:', errorText);
    throw new Error(
      `Failed to fetch trade details: ${response.status} ${errorText}`,
    );
  }

  return response.json();
}
