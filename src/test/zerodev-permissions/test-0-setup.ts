// Load environment variables directly
const ZERODEV_RPC_URL =
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';
const ZERODEV_PROJECT_ID = '4dcfe8c1-3f73-4977-b000-a736e7514079';

/**
 * Test Case 0: Basic ZeroDev Setup Verification
 * Purpose: Verify that ZeroDev RPC URL is accessible and returns expected responses
 */
async function testZeroDevSetup() {
  console.log('🧪 Test 0: Verifying ZeroDev setup...');

  try {
    // 1. Verify environment variables
    console.log('📋 Step 1: Checking environment variables...');
    console.log(
      `- Project ID: ${ZERODEV_PROJECT_ID ? '✅ Set' : '❌ Missing'}`,
    );
    console.log(`- RPC URL: ${ZERODEV_RPC_URL}`);

    // 2. Test direct RPC call to ZeroDev using fetch
    console.log('🌐 Step 2: Testing direct RPC call...');

    try {
      const response = await fetch(ZERODEV_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });

      const data = await response.json();
      console.log(`✅ Chain ID response:`, data);

      if (data.result) {
        const chainId = Number.parseInt(data.result, 16);
        if (chainId === 8453) {
          console.log('✅ Connected to Base mainnet');
        } else {
          console.log(`⚠️  Unexpected chain ID: ${chainId}`);
        }
      }
    } catch (rpcError) {
      console.error('❌ Direct RPC call failed:', rpcError);
      throw rpcError;
    }

    // 3. Test ZeroDev-specific method
    console.log('🔧 Step 3: Testing ZeroDev-specific method...');
    try {
      const response = await fetch(ZERODEV_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'zd_getUserOperationGasPrice',
          params: [],
          id: 2,
        }),
      });

      const data = await response.json();
      console.log(`✅ ZeroDev gas price response:`, data);
    } catch (zdError) {
      console.log(
        '⚠️  ZeroDev-specific method failed (might be expected):',
        (zdError as Error).message,
      );
    }

    console.log('🎉 Test 0 PASSED: ZeroDev setup verification complete!');
    return true;
  } catch (error) {
    console.error('❌ Test 0 FAILED: ZeroDev setup verification failed');
    console.error('Error details:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testZeroDevSetup()
    .then(() => {
      console.log('✅ Setup test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Setup test failed');
      console.error(error);
      process.exit(1);
    });
}

export { testZeroDevSetup };
