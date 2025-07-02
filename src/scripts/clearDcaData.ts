#!/usr/bin/env bun

/**
 * Script to clear all DCA order data from the database
 * This will remove all orders, executions, and user mappings from Redis
 * and can also clear localStorage data when run in browser context
 */

import { Redis } from '@upstash/redis';

// Load environment variables if running locally
if (process.env.NODE_ENV !== 'production') {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });
}

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function clearDcaData() {
  console.log('🧹 Starting DCA data cleanup...');

  try {
    // Get all DCA-related keys
    const dcaKeys = await redis.keys('dca:*');

    if (dcaKeys.length === 0) {
      console.log('✅ No DCA data found to clear');
      return;
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

    console.log(`\n📊 Found ${dcaKeys.length} DCA keys to delete:`);
    console.log(`   - Orders: ${orderKeys.length}`);
    console.log(`   - Executions: ${executionKeys.length}`);
    console.log(`   - User mappings: ${userKeys.length}`);
    console.log(`   - Other keys: ${otherKeys.length}`);

    // Show sample keys
    if (orderKeys.length > 0) {
      console.log(`\n📝 Sample order keys:`);
      orderKeys.slice(0, 3).forEach((key) => console.log(`   - ${key}`));
      if (orderKeys.length > 3)
        console.log(`   ... and ${orderKeys.length - 3} more`);
    }

    // Confirm deletion
    console.log('\n⚠️  This will permanently delete all DCA data from Redis!');
    console.log('Press Ctrl+C to cancel, or Enter to continue...');

    // Wait for user input (only in interactive mode)
    if (process.stdin.isTTY) {
      await new Promise((resolve) => {
        process.stdin.once('data', resolve);
      });
    }

    // Delete all DCA keys in batches
    const batchSize = 50;
    let deletedCount = 0;

    console.log('\n🗑️  Deleting keys...');
    for (let i = 0; i < dcaKeys.length; i += batchSize) {
      const batch = dcaKeys.slice(i, i + batchSize);
      const results = await redis.del(...batch);
      deletedCount += results;

      const progress = Math.round(((i + batch.length) / dcaKeys.length) * 100);
      console.log(
        `   Batch ${Math.floor(i / batchSize) + 1}: Deleted ${results} keys (${progress}%)`,
      );
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} DCA keys`);
    console.log('\n📋 Summary:');
    console.log(`   - Total keys deleted: ${deletedCount}`);
    console.log(`   - Orders cleared: ${orderKeys.length}`);
    console.log(`   - Executions cleared: ${executionKeys.length}`);
    console.log(`   - User mappings cleared: ${userKeys.length}`);
    console.log(`   - Other DCA data cleared: ${otherKeys.length}`);

    console.log('\n🎉 DCA database cleanup completed successfully!');
    console.log(
      '\n💡 Note: To clear client-side localStorage data, run this in your browser console:',
    );
    console.log('   localStorage.removeItem("dca-database");');
  } catch (error) {
    console.error('\n❌ Failed to clear DCA data:', error);
    process.exit(1);
  }
}

// Function to preview what would be deleted without actually deleting
async function previewDcaData() {
  console.log('👀 Previewing DCA data to be cleared...');

  try {
    const dcaKeys = await redis.keys('dca:*');

    if (dcaKeys.length === 0) {
      console.log('✅ No DCA data found');
      return;
    }

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

    console.log(`\n📊 DCA Data Summary:`);
    console.log(`   - Total keys: ${dcaKeys.length}`);
    console.log(`   - Orders: ${orderKeys.length}`);
    console.log(`   - Executions: ${executionKeys.length}`);
    console.log(`   - User mappings: ${userKeys.length}`);
    console.log(`   - Other keys: ${otherKeys.length}`);

    // Show sample keys by category
    if (orderKeys.length > 0) {
      console.log(
        `\n📝 Sample Order Keys (${Math.min(5, orderKeys.length)} of ${orderKeys.length}):`,
      );
      orderKeys.slice(0, 5).forEach((key) => console.log(`   - ${key}`));
    }

    if (executionKeys.length > 0) {
      console.log(
        `\n🔄 Sample Execution Keys (${Math.min(5, executionKeys.length)} of ${executionKeys.length}):`,
      );
      executionKeys.slice(0, 5).forEach((key) => console.log(`   - ${key}`));
    }

    if (userKeys.length > 0) {
      console.log(
        `\n👤 Sample User Mapping Keys (${Math.min(5, userKeys.length)} of ${userKeys.length}):`,
      );
      userKeys.slice(0, 5).forEach((key) => console.log(`   - ${key}`));
    }

    if (otherKeys.length > 0) {
      console.log(
        `\n🔧 Other DCA Keys (${Math.min(5, otherKeys.length)} of ${otherKeys.length}):`,
      );
      otherKeys.slice(0, 5).forEach((key) => console.log(`   - ${key}`));
    }
  } catch (error) {
    console.error('\n❌ Failed to preview DCA data:', error);
    process.exit(1);
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'preview':
    await previewDcaData();
    break;
  case 'clear':
    await clearDcaData();
    break;
  default:
    console.log('🔧 DCA Data Management Script');
    console.log('\nUsage:');
    console.log(
      '  bun run src/scripts/clearDcaData.ts preview  # Preview data to be cleared',
    );
    console.log(
      '  bun run src/scripts/clearDcaData.ts clear    # Clear all DCA data',
    );
    console.log(
      '\nWarning: The clear command will permanently delete all DCA orders and execution data!',
    );
    break;
}

process.exit(0);
