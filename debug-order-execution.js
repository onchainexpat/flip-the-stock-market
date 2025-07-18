// Debug order execution issue
const BASE_URL = 'http://localhost:3000';

async function debugOrderExecution() {
  console.log('🔍 Debugging DCA order execution...\n');
  
  try {
    // First, let's check what orders exist
    console.log('1️⃣ Checking all orders in the system...');
    
    // Try different addresses to find orders
    const addresses = [
      '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE', // Smart wallet
      '0x55E911B8cF82A2657ff6f6cB57A5c8D83ea4D45A', // Gelato deployer (mistakenly used)
      '0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7', // From agent key data
    ];
    
    let foundOrder = null;
    
    for (const addr of addresses) {
      const response = await fetch(`${BASE_URL}/api/unified-dca-orders?userAddress=${addr}`);
      const data = await response.json();
      
      if (data.orders && data.orders.length > 0) {
        console.log(`✅ Found ${data.orders.length} order(s) for address: ${addr}`);
        foundOrder = data.orders[0];
        break;
      }
    }
    
    if (!foundOrder) {
      console.log('❌ No orders found in the system');
      return;
    }
    
    console.log('\n2️⃣ Order details:');
    console.log('   Order ID:', foundOrder.id);
    console.log('   User Address:', foundOrder.userAddress);
    console.log('   Smart Wallet:', foundOrder.sessionKeyAddress);
    console.log('   Status:', foundOrder.status);
    console.log('   Amount per order:', foundOrder.amountPerOrder);
    console.log('   Created at:', new Date(foundOrder.createdAt).toISOString());
    
    // Parse session key data
    const sessionData = JSON.parse(foundOrder.sessionKeyData);
    console.log('\n3️⃣ Session key data:');
    console.log('   Server managed:', sessionData.serverManaged);
    console.log('   Agent key ID:', sessionData.agentKeyId);
    console.log('   Smart wallet address:', sessionData.smartWalletAddress);
    
    // Check agent key details
    if (sessionData.agentKeyId) {
      console.log('\n4️⃣ Checking agent key details...');
      const agentResponse = await fetch(`${BASE_URL}/api/debug-agent-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKeyId: sessionData.agentKeyId }),
      });
      
      const agentData = await agentResponse.json();
      if (agentData.success) {
        console.log('   Agent address:', agentData.agentAddress);
        console.log('   Has private key:', agentData.hasPrivateKey);
        console.log('   Has session approval:', agentData.hasSessionKeyApproval);
        console.log('   Is active:', agentData.isActive);
        console.log('   User address in agent key:', agentData.userAddress);
      }
    }
    
    // Check balances
    console.log('\n5️⃣ Checking balances...');
    const balanceResponse = await fetch(`${BASE_URL}/api/check-wallet-balance?address=${sessionData.smartWalletAddress}`);
    const balances = await balanceResponse.json();
    console.log('   Smart wallet USDC:', balances.balances.usdc.formatted, 'USDC');
    console.log('   Smart wallet ETH:', balances.balances.eth.formatted, 'ETH');
    
    // Try to understand the execution error
    console.log('\n6️⃣ Attempting execution to see detailed error...');
    const execResponse = await fetch(`${BASE_URL}/api/test-force-dca-execution`);
    const execResult = await execResponse.json();
    
    if (!execResult.success) {
      console.log('❌ Execution failed:');
      console.log('   Order ID:', execResult.orderId);
      
      // Parse the error
      const errorLines = execResult.result.error.split('\n');
      console.log('\n   Error details:');
      errorLines.forEach(line => {
        if (line.includes('UserOperation reverted')) {
          console.log('   🔴', line);
        } else if (line.includes('0x')) {
          console.log('   📍', line);
        }
      });
      
      // Extract UserOp details from error
      if (execResult.result.error.includes('Request body:')) {
        try {
          const match = execResult.result.error.match(/Request body: ({.*})/);
          if (match) {
            const requestBody = JSON.parse(match[1]);
            const userOp = requestBody.params[0].userOp;
            console.log('\n7️⃣ UserOperation details:');
            console.log('   Sender:', userOp.sender);
            console.log('   Nonce:', userOp.nonce);
            console.log('   Call data length:', userOp.callData.length);
            console.log('   Max fee per gas:', userOp.maxFeePerGas);
            console.log('   Max priority fee:', userOp.maxPriorityFeePerGas);
            
            // Decode callData to understand what it's trying to do
            console.log('\n8️⃣ Analyzing call data...');
            if (userOp.callData.startsWith('0xe9ae5c53')) {
              console.log('   ✅ Call is to executeBatch function');
              // The callData seems to be for an Aerodrome swap
              console.log('   🔄 Appears to be executing a swap transaction');
            }
          }
        } catch (e) {
          console.log('   ❌ Could not parse request body');
        }
      }
    } else {
      console.log('✅ Execution succeeded!');
      console.log('   Transaction hash:', execResult.result.txHash);
    }
    
    console.log('\n💡 Diagnosis:');
    console.log('1. UserOperation is reverting with empty reason (0x)');
    console.log('2. This usually means:');
    console.log('   - Permission issues with session key');
    console.log('   - Invalid transaction data');
    console.log('   - Smart wallet not deployed');
    console.log('   - Gas estimation issues');
    
  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
  }
}

debugOrderExecution();