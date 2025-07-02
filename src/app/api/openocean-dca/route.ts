import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const OPENOCEAN_BASE_URL = 'https://open-api.openocean.finance';

// OpenOcean DCA API endpoints (v1 with correct structure)
const DCA_ENDPOINTS = {
  create: '/v1/8453/dca/swap', // Base chain (8453)
  cancel: '/v1/8453/dca/cancel',
  list: '/v1/8453/dca/address', // Gets orders for a specific address
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log('OpenOcean DCA API request:', { action, params });

    let endpoint: string;
    let method = 'POST';

    switch (action) {
      case 'create':
        endpoint = DCA_ENDPOINTS.create;
        method = 'POST';
        break;
      case 'cancel':
        endpoint = DCA_ENDPOINTS.cancel;
        method = 'POST';
        break;
      case 'list':
        // For list action, append user address to the endpoint
        if (!params.userAddress) {
          return NextResponse.json(
            { error: 'User address is required for list action' },
            { status: 400 },
          );
        }
        endpoint = `${DCA_ENDPOINTS.list}/${params.userAddress}`;
        method = 'GET';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, cancel, or list' },
          { status: 400 },
        );
    }

    const url = new URL(endpoint, OPENOCEAN_BASE_URL);

    // For GET requests, add params as query parameters
    if (method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log('Calling OpenOcean API:', url.toString());

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    // For POST requests, add params as body
    if (method === 'POST') {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    console.log('OpenOcean API response:', {
      status: response.status,
      ok: response.ok,
      data,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'OpenOcean API error',
          status: response.status,
          message: data.message || data.error || 'Unknown error',
          details: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      data,
      action,
    });
  } catch (error) {
    console.error('OpenOcean DCA API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to call OpenOcean DCA API',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Handle GET requests for status and list operations
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json(
      { error: 'Missing action parameter' },
      { status: 400 },
    );
  }

  // Convert search params to object
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'action') {
      params[key] = value;
    }
  });

  // Create a POST request body and call the POST handler
  const body = { action, ...params };

  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return POST(postRequest as NextRequest);
}
