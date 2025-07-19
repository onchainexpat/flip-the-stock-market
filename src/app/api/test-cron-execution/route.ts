import { type NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

// Test endpoint to manually trigger cron execution
// This works on preview deployments for testing
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Manual cron test triggered');
    
    // In development/preview, we can test without auth
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.VERCEL_ENV === 'preview';
    
    if (!isDevelopment) {
      return NextResponse.json({ 
        error: 'This endpoint is only available in development/preview' 
      }, { status: 403 });
    }
    
    // Call the actual cron endpoint with proper auth
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const cronUrl = `${protocol}://${host}/api/cron/execute-dca-v2`;
    
    const response = await fetch(cronUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'dev-secret'}`
      }
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Cron execution triggered manually',
      cronResult: result,
      environment: process.env.VERCEL_ENV || 'development'
    });
    
  } catch (error) {
    console.error('Error in manual cron test:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}