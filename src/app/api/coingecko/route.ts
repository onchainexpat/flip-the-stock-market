export const runtime = 'nodejs';

export async function GET() {
  console.log('=== CoinGecko API Debug Start ===');
  
  try {
    const apiKey = process.env.COINGECKO_API;
    
    // Debug logging
    const debugInfo = {
      apiKeyPresent: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 3),
      environment: process.env.NODE_ENV,
      keyType: 'demo' // All keys are demo unless explicitly upgraded to pro
    };
    console.log('Debug info:', debugInfo);

    if (!apiKey) {
      throw new Error('CoinGecko API key is missing');
    }

    // All keys should use the regular API endpoint unless explicitly upgraded to pro
    const baseUrl = 'https://api.coingecko.com';
    const apiPath = '/api/v3/simple/price';
    
    const params = new URLSearchParams({
      ids: 'spx6900',
      vs_currencies: 'usd',
      include_24hr_change: 'true',
      include_market_cap: 'true',
      x_cg_demo_api_key: apiKey // Add API key as query parameter
    });

    const fullUrl = `${baseUrl}${apiPath}?${params}`;
    console.log('Making API request to:', fullUrl.replace(apiKey, '[HIDDEN]'));
    
    // Set basic headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('Using headers:', headers);
    
    const response = await fetch(fullUrl, {
      headers,
      signal: AbortSignal.timeout(5000)
    });

    console.log('API Response Status:', response.status);
    console.log('API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('API Raw Response:', responseText);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${responseText}`);
    }

    try {
      // Verify the response is valid JSON
      const jsonData = JSON.parse(responseText);
      
      return new Response(JSON.stringify(jsonData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (parseError: unknown) {
      console.error('Failed to parse API response:', parseError);
      throw new Error('Invalid JSON response from API');
    }

  } catch (error: unknown) {
    console.error('Error:', error);
    
    const errorResponse = {
      error: 'CoinGecko API Error',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        apiKeyPresent: !!process.env.COINGECKO_API,
        apiKeyPrefix: process.env.COINGECKO_API?.substring(0, 3),
        environment: process.env.NODE_ENV
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    console.log('=== CoinGecko API Debug End ===');
  }
} 