import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  // Get all environment variables that start with CDP
  const envVars = {
    CDP_API_KEY: process.env.NEXT_PUBLIC_CDP_API_KEY,
    CDP_PROJECT_ID: process.env.NEXT_PUBLIC_CDP_PROJECT_ID,
    HAS_CDP_API_KEY: !!process.env.NEXT_PUBLIC_CDP_API_KEY,
    HAS_CDP_PROJECT_ID: !!process.env.NEXT_PUBLIC_CDP_PROJECT_ID,
    CDP_API_KEY_LENGTH: process.env.NEXT_PUBLIC_CDP_API_KEY?.length || 0,
    CDP_PROJECT_ID_LENGTH: process.env.NEXT_PUBLIC_CDP_PROJECT_ID?.length || 0,
    // Try without NEXT_PUBLIC prefix
    ALT_CDP_API_KEY: process.env.CDP_API_KEY,
    ALT_CDP_PROJECT_ID: process.env.CDP_PROJECT_ID,
    HAS_ALT_CDP_API_KEY: !!process.env.CDP_API_KEY,
    HAS_ALT_CDP_PROJECT_ID: !!process.env.CDP_PROJECT_ID,
  };

  // Test direct CDP API call
  if (envVars.CDP_API_KEY && envVars.CDP_PROJECT_ID) {
    try {
      const response = await fetch(
        'https://api.cdp.coinbase.com/platform/v2/networks',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${envVars.CDP_API_KEY}`,
            'X-CDP-Project-ID': envVars.CDP_PROJECT_ID,
            'Content-Type': 'application/json',
          },
        },
      );

      const responseText = await response.text();

      return NextResponse.json({
        envVars,
        cdpTest: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          response: responseText.slice(0, 200), // First 200 chars
        },
      });
    } catch (error) {
      return NextResponse.json({
        envVars,
        cdpTest: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return NextResponse.json({ envVars });
}
