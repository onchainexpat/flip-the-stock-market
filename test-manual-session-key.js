// Test manual session key creation and execution with existing smart wallet
import { http, createPublicClient, erc20Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Use our mainnet configuration
const ZERODEV_RPC =
  process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
  'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

// The existing smart wallet that has USDC balance
const EXISTING_SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const USER_WALLET = '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function testManualSessionKey() {
  console.log('🧪 Testing manual session key creation...');

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [EXISTING_SMART_WALLET],
    });

    console.log(
      '💰 Smart wallet USDC balance:',
      (Number(usdcBalance) / 1e6).toFixed(6),
      'USDC',
    );

    // Generate session key
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);

    console.log('🔑 Generated session key address:', sessionKeyAccount.address);

    // Create session key approval data in the format expected by our server
    const sessionKeyApprovalData = {
      privateKey: sessionPrivateKey,
      smartWalletAddress: EXISTING_SMART_WALLET,
      sessionKeyAddress: sessionKeyAccount.address,
      userAddress: USER_WALLET,
      createdAt: Date.now(),
    };

    // Convert to base64 (same format as our server expects)
    const serializedApproval = Buffer.from(
      JSON.stringify(sessionKeyApprovalData),
    ).toString('base64');

    console.log('📦 Session key approval created');
    console.log('   Serialized length:', serializedApproval.length);

    // Create agent key data manually
    const agentKeyId = `agent_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📝 Creating agent key data...');

    // Store agent key via API
    const storeResponse = await fetch(
      'http://localhost:3000/api/store-client-session-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: USER_WALLET,
          smartWalletAddress: EXISTING_SMART_WALLET,
          sessionPrivateKey: sessionPrivateKey,
          sessionKeyApproval: serializedApproval,
          agentAddress: sessionKeyAccount.address,
        }),
      },
    );

    const storeResult = await storeResponse.json();

    if (storeResult.success) {
      console.log('✅ Agent key stored successfully');
      console.log('   Response:', storeResult);

      // Get the actual agent key ID from the response
      const actualAgentKeyId = storeResult.agentKeyId || agentKeyId;

      // Create DCA order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('📝 Creating DCA order...');
      console.log('   Using agent key ID:', actualAgentKeyId);

      const orderResponse = await fetch(
        'http://localhost:3000/api/dca-orders-v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: USER_WALLET,
            smartWalletAddress: EXISTING_SMART_WALLET,
            totalAmount: '1000000', // 1 USDC
            frequency: 'daily',
            duration: 1,
            agentKeyId: actualAgentKeyId,
          }),
        },
      );

      const orderResult = await orderResponse.json();

      if (orderResult.success) {
        console.log('✅ DCA order created successfully');
        console.log('   Order response:', orderResult);

        const actualOrderId = orderResult.orderId || orderResult.order?.id;

        if (actualOrderId) {
          console.log('   Order ID:', actualOrderId);

          // Test execution immediately
          console.log('\\n🧪 Testing DCA execution...');

          const testResponse = await fetch(
            `http://localhost:3000/api/test-force-dca-execution?orderId=${actualOrderId}`,
          );

          if (testResponse.ok) {
            const testResult = await testResponse.json();
            console.log(
              '✅ DCA execution result:',
              testResult.success ? 'SUCCESS' : 'FAILED',
            );

            if (testResult.success) {
              console.log('🎉 Complete DCA execution successful!');
              console.log('   Transaction hash:', testResult.result?.txHash);
              console.log('   SPX received:', testResult.result?.spxReceived);
              console.log(
                '   All transactions:',
                testResult.result?.transactions,
              );
            } else {
              console.log(
                '❌ DCA execution failed:',
                testResult.result?.error?.substring(0, 500),
              );
            }
          } else {
            console.log('❌ DCA execution test failed:', testResponse.status);
          }
        } else {
          console.log('❌ No order ID found in response');
        }
      } else {
        console.log('❌ Failed to create DCA order:', orderResult.error);
      }
    } else {
      console.log('❌ Failed to store agent key:', storeResult.error);
    }
  } catch (error) {
    console.error('❌ Manual session key test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testManualSessionKey();
