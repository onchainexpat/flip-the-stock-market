#!/usr/bin/env node

/**
 * DCA Test Orders Cleanup Script
 * Cleans up old paused/deleted DCA orders before running new tests
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('🧹 DCA Test Orders Cleanup Tool\n');

  console.log('Available cleanup options:');
  console.log('1. Preview what data exists (safe)');
  console.log('2. Clean up invalid/paused orders only (recommended)');
  console.log('3. Clear ALL DCA data (nuclear option)');
  console.log('4. Exit\n');

  const choice = await askQuestion('Choose option (1-4): ');

  switch (choice) {
    case '1':
      console.log('\n📊 To preview existing DCA data:');
      console.log('Visit: http://localhost:3000/admin/clear-dca');
      console.log('Or run: bun run src/scripts/clearDcaData.ts preview');
      break;

    case '2':
      console.log('\n🔧 To clean up invalid/paused orders:');
      console.log('Method 1 - API call:');
      console.log(
        'curl -X POST http://localhost:3000/api/admin/cleanup-invalid-orders \\',
      );
      console.log('  -H "Authorization: Bearer dev-cron-secret"');
      console.log('\nMethod 2 - Script:');
      console.log('bun run src/scripts/fix-dca-orders.ts');
      break;

    case '3':
      const confirm = await askQuestion(
        '\n⚠️  WARNING: This will delete ALL DCA data. Continue? (yes/no): ',
      );
      if (confirm.toLowerCase() === 'yes') {
        console.log('\n💥 To clear all DCA data:');
        console.log('Visit: http://localhost:3000/admin/clear-dca');
        console.log('Or run: bun run src/scripts/clearDcaData.ts clear');
      } else {
        console.log('❌ Cancelled');
      }
      break;

    case '4':
      console.log('👋 Goodbye!');
      break;

    default:
      console.log('❌ Invalid option');
  }

  rl.close();
}

main().catch(console.error);
