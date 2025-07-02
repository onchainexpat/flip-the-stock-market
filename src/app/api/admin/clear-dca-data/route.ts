import { Redis } from '@upstash/redis';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Admin endpoint to clear all DCA data
export async function POST(request: NextRequest) {
  try {
    // Simple auth check - in production, you'd want proper authentication
    const body = await request.json();
    const { adminKey } = body;

    // Use a simple admin key for now (in production, use proper auth)
    const expectedAdminKey = process.env.ADMIN_KEY || 'dev-admin-clear-dca';

    if (adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Starting DCA data cleanup...');

    // Get all DCA-related keys
    const dcaKeys = await redis.keys('dca:*');

    if (dcaKeys.length === 0) {
      console.log('No DCA data found to clear');
      return NextResponse.json({
        success: true,
        message: 'No DCA data found to clear',
        deletedKeys: 0,
        details: {
          orders: 0,
          executions: 0,
          userMappings: 0,
          otherKeys: 0,
        },
      });
    }

    // Categorize keys for reporting
    const orderKeys = dcaKeys.filter(
      (key) => key.startsWith('dca:order:') && !key.includes(':executions'),
    );
    const executionKeys = dcaKeys.filter(
      (key) => key.includes(':executions') || key.startsWith('dca:execution:'),
    );
    const userKeys = dcaKeys.filter((key) => key.includes(':user:'));
    const otherKeys = dcaKeys.filter(
      (key) =>
        !key.startsWith('dca:order:') &&
        !key.includes(':executions') &&
        !key.startsWith('dca:execution:') &&
        !key.includes(':user:'),
    );

    console.log(`Found ${dcaKeys.length} DCA keys to delete:`);
    console.log(`- Orders: ${orderKeys.length}`);
    console.log(`- Executions: ${executionKeys.length}`);
    console.log(`- User mappings: ${userKeys.length}`);
    console.log(`- Other keys: ${otherKeys.length}`);

    // Delete all DCA keys in batches
    const batchSize = 50;
    let deletedCount = 0;

    for (let i = 0; i < dcaKeys.length; i += batchSize) {
      const batch = dcaKeys.slice(i, i + batchSize);
      const results = await redis.del(...batch);
      deletedCount += results;
      console.log(
        `Deleted batch ${Math.floor(i / batchSize) + 1}: ${results} keys`,
      );
    }

    console.log(`✅ Successfully deleted ${deletedCount} DCA keys`);

    return NextResponse.json({
      success: true,
      message: `Successfully cleared all DCA data`,
      deletedKeys: deletedCount,
      details: {
        orders: orderKeys.length,
        executions: executionKeys.length,
        userMappings: userKeys.length,
        otherKeys: otherKeys.length,
      },
      clearedKeys: dcaKeys.slice(0, 10), // Show first 10 keys as sample
    });
  } catch (error) {
    console.error('Failed to clear DCA data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// GET endpoint to preview what would be deleted
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('adminKey');

    // Simple auth check
    const expectedAdminKey = process.env.ADMIN_KEY || 'dev-admin-clear-dca';

    if (adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all DCA-related keys
    const dcaKeys = await redis.keys('dca:*');

    // Categorize keys
    const orderKeys = dcaKeys.filter(
      (key) => key.startsWith('dca:order:') && !key.includes(':executions'),
    );
    const executionKeys = dcaKeys.filter(
      (key) => key.includes(':executions') || key.startsWith('dca:execution:'),
    );
    const userKeys = dcaKeys.filter((key) => key.includes(':user:'));
    const otherKeys = dcaKeys.filter(
      (key) =>
        !key.startsWith('dca:order:') &&
        !key.includes(':executions') &&
        !key.startsWith('dca:execution:') &&
        !key.includes(':user:'),
    );

    return NextResponse.json({
      success: true,
      preview: true,
      totalKeys: dcaKeys.length,
      details: {
        orders: orderKeys.length,
        executions: executionKeys.length,
        userMappings: userKeys.length,
        otherKeys: otherKeys.length,
      },
      sampleKeys: {
        orders: orderKeys.slice(0, 5),
        executions: executionKeys.slice(0, 5),
        userMappings: userKeys.slice(0, 5),
        otherKeys: otherKeys.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Failed to preview DCA data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
