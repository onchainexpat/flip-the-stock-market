#!/usr/bin/env node

/**
 * Session Key Test Runner
 *
 * This script helps you run the session key tests easily.
 *
 * Usage:
 *   node run-session-key-tests.js [test-name]
 *
 * Available tests:
 *   - diagnose: Diagnose address mismatch issue
 *   - full: Run complete session key test
 *   - solution: Demonstrate DCA solution
 *   - all: Run all tests
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS = {
  diagnose: 'src/test/diagnose-address-mismatch.ts',
  basic: 'src/test/base-sepolia-session-key-test.ts',
  eth: 'src/test/session-key-eth-transfer-test.ts',
  swap: 'src/test/session-key-eth-to-usdc-test.ts',
  complete: 'src/test/complete-dca-flow-test.ts',
  uniswap: 'src/test/session-key-uniswap-test.ts',
  solution: 'src/test/dca-session-key-solution.ts',
};

function checkEnvironment() {
  const envPath = path.join(__dirname, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.log('❌ No .env.local file found!');
    console.log(
      '📝 Please copy .env.test.example to .env.local and configure it:',
    );
    console.log('   cp .env.test.example .env.local');
    console.log('   # Edit .env.local with your values');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');

  if (
    !envContent.includes('NEXT_PUBLIC_ZERODEV_PROJECT_ID') ||
    envContent.includes('your_zerodev_project_id_here')
  ) {
    console.log(
      '❌ Please configure NEXT_PUBLIC_ZERODEV_PROJECT_ID in .env.local',
    );
    return false;
  }

  if (
    !envContent.includes('BASE_SEPOLIA_TEST_PRIVATE_KEY') ||
    envContent.includes(
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    )
  ) {
    console.log('❌ Please set BASE_SEPOLIA_TEST_PRIVATE_KEY in .env.local');
    console.log(
      '💡 Generate a new test private key at: https://vanity-eth.tk/',
    );
    return false;
  }

  return true;
}

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running: ${testFile}`);
    console.log('=' * 50);

    const child = spawn('bun', ['run', testFile], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Test completed: ${testFile}\n`);
        resolve();
      } else {
        console.log(`❌ Test failed: ${testFile} (exit code: ${code})\n`);
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.log(`❌ Error running test: ${error.message}\n`);
      reject(error);
    });
  });
}

async function main() {
  const testName = process.argv[2] || 'help';

  if (testName === 'help' || testName === '--help' || testName === '-h') {
    console.log('Session Key Test Runner\n');
    console.log('Usage: node run-session-key-tests.js [test-name]\n');
    console.log('Available tests:');
    console.log(
      `  ${'diagnose'.padEnd(12)} - ${TESTS.diagnose} (diagnose address issues)`,
    );
    console.log(
      `  ${'basic'.padEnd(12)} - ${TESTS.basic} (basic session key test)`,
    );
    console.log(
      `  ${'eth'.padEnd(12)} - ${TESTS.eth} (ETH transfer with limits)`,
    );
    console.log(`  ${'swap'.padEnd(12)} - ${TESTS.swap} (ETH → USDC swaps)`);
    console.log(
      `  ${'complete'.padEnd(12)} - ${TESTS.complete} (🚀 COMPLETE DCA FLOW)`,
    );
    console.log(
      `  ${'uniswap'.padEnd(12)} - ${TESTS.uniswap} (USDC → WETH swaps)`,
    );
    console.log(
      `  ${'solution'.padEnd(12)} - ${TESTS.solution} (DCA implementation)`,
    );
    console.log('  all          - Run all tests');
    console.log('\nSetup:');
    console.log('1. Copy .env.test.example to .env.local');
    console.log('2. Configure your ZeroDev project ID');
    console.log('3. Generate a test private key');
    console.log('4. Fund the test EOA with Base Sepolia ETH');
    return;
  }

  // Check environment
  if (!checkEnvironment()) {
    process.exit(1);
  }

  try {
    if (testName === 'all') {
      for (const [name, file] of Object.entries(TESTS)) {
        await runTest(file);
      }
    } else if (TESTS[testName]) {
      await runTest(TESTS[testName]);
    } else {
      console.log(`❌ Unknown test: ${testName}`);
      console.log('Available tests:', Object.keys(TESTS).join(', '));
      process.exit(1);
    }

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.log('💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Notification function
function playNotification() {
  if (process.platform === 'win32') {
    spawn('powershell.exe', [
      '-c',
      '[console]::beep(800,300); Start-Sleep -Milliseconds 80; [console]::beep(800,300); Start-Sleep -Milliseconds 80; [console]::beep(800,300)',
    ]);
  } else {
    console.log('\x07\x07\x07'); // Terminal bell
  }
}

main()
  .then(() => {
    playNotification();
  })
  .catch(() => {
    process.exit(1);
  });
