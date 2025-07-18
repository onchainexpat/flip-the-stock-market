// Test deserialization with the fixed approach
const { serverAgentKeyService } = require('./src/services/serverAgentKeyService');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');
const { getEntryPoint } = require('@zerodev/sdk/constants');
const { KERNEL_V3_1 } = require('@zerodev/sdk/constants');

async function testDeserialization() {
  console.log('🧪 Testing deserialization with fixed approach...');
  
  try {
    // Use the most recent order
    const orderId = 'order_1752771326790_f2irbshtg';
    const agentKeyId = 'agent_key_1752771326790_f2irbshtg';
    
    console.log('Testing with order:', orderId);
    console.log('Testing with agent key:', agentKeyId);
    
    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
    
    if (!agentKeyData) {
      console.error('❌ Agent key not found');
      return;
    }
    
    console.log('✅ Agent key found');
    console.log('   Has session approval:', !!agentKeyData.sessionKeyApproval);
    console.log('   Approval length:', agentKeyData.sessionKeyApproval?.length);
    
    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453'),
    });
    
    // Try to deserialize using the new approach
    const { deserializePermissionAccount } = await import('@zerodev/permissions');
    
    console.log('🔓 Attempting deserialization...');
    
    const smartWallet = await deserializePermissionAccount(
      publicClient,
      getEntryPoint('0.7'),
      KERNEL_V3_1,
      agentKeyData.sessionKeyApproval,
    );
    
    console.log('✅ Deserialization successful!');
    console.log('   Smart wallet address:', smartWallet.address);
    console.log('   Expected address:', agentKeyData.smartWalletAddress);
    console.log('   Addresses match:', smartWallet.address.toLowerCase() === agentKeyData.smartWalletAddress.toLowerCase());
    
  } catch (error) {
    console.error('❌ Deserialization failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testDeserialization();